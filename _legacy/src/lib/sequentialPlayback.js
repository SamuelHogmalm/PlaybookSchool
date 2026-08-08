import { IDS } from "./playModel.js";
import { BEAT_HOLD_MS, SEQ_ACTION_MS, SEQ_PASS_MS, SEQ_BEAT_HOLD_MS, SEQ_PAUSE_MS } from "./animation/constants.js";
import { easeInOut, samplePolyline } from "./playback.js";
import { dedupePassActions, ballAtBeatStart, sanitizeFrameActions } from "./beatActions.js";
import { actionsHaveExplicitOrder, sortBeatActions, actionTimingRows } from "./breakdownUtils.js";

/** Hold formation before the first beat's actions */
export { SEQ_BEAT_HOLD_MS, SEQ_PAUSE_MS, SEQ_ACTION_MS, SEQ_PASS_MS } from "./animation/constants.js";

const MIN_ROUTE_PX = 18;
const MIN_PASS_PX = 20;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

function routeForAction(action, from, cur) {
  if (action.path?.length >= 2) {
    const route = action.path.map((p) => ({ x: p.x, y: p.y }));
    route[0] = { ...from };
    return route;
  }
  const to = cur.pos[action.by];
  if (!to) return null;
  return [{ ...from }, { ...to }];
}

function tierFor(type) {
  if (type === "dribble") return 1;
  if (type === "pass" || type === "handoff") return 2;
  if (type === "screen") return 3;
  return 4;
}

function copyPos(frame) {
  const out = {};
  for (const id of IDS) {
    if (frame?.pos?.[id]) out[id] = { ...frame.pos[id] };
  }
  return out;
}

function validPlayer(id) {
  return id != null && IDS.includes(String(id));
}

function snapPos(pos, frame) {
  if (!frame?.pos) return;
  for (const id of IDS) {
    if (frame.pos[id]) pos[id] = { ...frame.pos[id] };
  }
}

function buildPassStep(action, pos, beatIdx) {
  if (!validPlayer(action.by) || !validPlayer(action.for)) return null;
  const from = pos[action.by];
  const to = pos[action.for];
  if (!from || !to) return null;
  if (dist(from, to) < MIN_PASS_PX) return null;

  return {
    type: action.type === "handoff" ? "handoff" : "pass",
    by: action.by,
    for: action.for,
    route: [{ ...from }, { ...to }],
    duration: SEQ_PASS_MS,
    beatIdx,
  };
}

function buildMoveStep(action, pos, prev, cur, beatIdx) {
  if (!validPlayer(action.by)) return null;
  const from = pos[action.by] ?? prev.pos[action.by];
  if (!from) return null;

  const route = routeForAction(action, from, cur);
  if (!route || polylineLength(route) < MIN_ROUTE_PX) return null;

  const type =
    action.type === "dribble" ? "dribble" : action.type === "screen" ? "screen" : "cut";

  return {
    type,
    by: action.by,
    for: action.for,
    route,
    duration: SEQ_ACTION_MS,
    beatIdx,
  };
}

function applyStepEnd(step, pos, ball) {
  if (step.type === "pass" || step.type === "handoff") {
    if (step.for) {
      ball.carrier = step.for;
      ball.ball = step.for;
    }
    return;
  }
  if (step.by && step.route?.length) {
    pos[step.by] = { ...step.route[step.route.length - 1] };
  }
  if (step.type === "dribble" && step.by) {
    ball.carrier = step.by;
    ball.ball = step.by;
  }
}

function playerAtTarget(pos, cur, id, threshold = 12) {
  const a = pos[id];
  const b = cur.pos[id];
  if (!a || !b) return true;
  return dist(a, b) <= threshold;
}

function pushMoveGroup(groups, steps, beatIdx, cur) {
  if (!steps.length) return;
  groups.push({
    parallel: steps.length > 1,
    steps,
    duration: SEQ_ACTION_MS,
    beatIdx,
    curFrame: cur,
  });
}

function holdGroup(beatIdx, duration = SEQ_BEAT_HOLD_MS) {
  return {
    parallel: false,
    steps: [],
    duration,
    beatIdx,
    phase: "hold",
  };
}

function buildBeatGroupsInSequence(prev, cur, beatIdx, actions) {
  const pos = copyPos(prev);
  const ball = { carrier: ballAtBeatStart(prev), ball: ballAtBeatStart(prev) };
  const groups = [];
  const rows = actionTimingRows(actions);
  const handled = new Set();

  for (const row of rows) {
    const moveSteps = [];

    for (const action of row.items) {
      if (action.type === "pass" || action.type === "handoff") {
        const carrier = ball.carrier ?? ball.ball;
        if (action.by !== carrier) continue;
        const step = buildPassStep(action, pos, beatIdx);
        if (step) {
          groups.push({ parallel: false, steps: [step], duration: step.duration, beatIdx, curFrame: cur });
          applyStepEnd(step, pos, ball);
          handled.add(action.by);
        } else if (validPlayer(action.for)) {
          ball.carrier = action.for;
          ball.ball = action.for;
        }
        continue;
      }

      const step = buildMoveStep(action, pos, prev, cur, beatIdx);
      if (step) {
        moveSteps.push(step);
        if (action.by) handled.add(action.by);
      }
    }

    if (moveSteps.length) {
      pushMoveGroup(groups, moveSteps, beatIdx, cur);
      for (const step of moveSteps) applyStepEnd(step, pos, ball);
    }
  }

  snapPos(pos, cur);
  ball.ball = cur.ball;
  ball.carrier = cur.ball;
  return groups;
}

function explicitBeatActions(prev, cur) {
  return sortBeatActions(sanitizeFrameActions(cur.actions ?? [], ballAtBeatStart(prev)));
}

function buildBeatGroups(prev, cur, beatIdx) {
  const actions = explicitBeatActions(prev, cur);
  if (actionsHaveExplicitOrder(actions)) {
    return buildBeatGroupsInSequence(prev, cur, beatIdx, actions);
  }

  const pos = copyPos(prev);
  const ball = { carrier: ballAtBeatStart(prev), ball: ballAtBeatStart(prev) };
  const groups = [];

  const byTier = { 1: [], 2: [], 3: [], 4: [] };
  for (const a of actions) {
    byTier[tierFor(a.type)].push(a);
  }

  for (const action of byTier[1]) {
    const step = buildMoveStep(action, pos, prev, cur, beatIdx);
    if (!step) continue;
    groups.push({ parallel: false, steps: [step], duration: step.duration, beatIdx, curFrame: cur });
    applyStepEnd(step, pos, ball);
  }

  const passActions = dedupePassActions(byTier[2]);

  for (const action of passActions) {
    const carrier = ball.carrier ?? ball.ball;
    if (action.by !== carrier) continue;
    const step = buildPassStep(action, pos, beatIdx);
    if (step) {
      groups.push({ parallel: false, steps: [step], duration: step.duration, beatIdx, curFrame: cur });
      applyStepEnd(step, pos, ball);
    } else if (validPlayer(action.for)) {
      ball.carrier = action.for;
      ball.ball = action.for;
    }
  }

  const handled = new Set();

  const screenSteps = [];
  for (const action of byTier[3]) {
    const step = buildMoveStep(action, pos, prev, cur, beatIdx);
    if (step) {
      screenSteps.push(step);
      handled.add(action.by);
    }
  }
  pushMoveGroup(groups, screenSteps, beatIdx, cur);
  for (const step of screenSteps) applyStepEnd(step, pos, ball);

  const cutSteps = [];
  for (const action of byTier[4]) {
    const step = buildMoveStep(action, pos, prev, cur, beatIdx);
    if (step) {
      cutSteps.push(step);
      handled.add(action.by);
    }
  }

  if (!actions.length) {
    for (const id of IDS) {
      if (handled.has(id) || playerAtTarget(pos, cur, id)) continue;
      const from = pos[id] ?? prev.pos[id];
      const to = cur.pos[id];
      if (!from || !to || dist(from, to) < MIN_ROUTE_PX) continue;

      const isCarrier = (ball.carrier ?? ball.ball) === id;
      cutSteps.push({
        type: isCarrier ? "dribble" : "cut",
        by: id,
        route: [{ ...from }, { ...to }],
        duration: SEQ_ACTION_MS,
        beatIdx,
      });
      handled.add(id);
    }
  }

  pushMoveGroup(groups, cutSteps, beatIdx, cur);
  for (const step of cutSteps) applyStepEnd(step, pos, ball);

  snapPos(pos, cur);
  ball.ball = cur.ball;
  ball.carrier = cur.ball;

  return groups;
}

export function buildSequentialTimeline(frames, stopBeatIdx = null, startBeatIdx = 1) {
  if (!frames?.length) {
    return { setupPos: {}, setupBall: null, groups: [], frames: [] };
  }

  const maxBeat = stopBeatIdx ?? frames.length - 1;
  const minBeat = Math.max(1, Math.min(startBeatIdx, frames.length - 1));
  const setupIdx = minBeat - 1;
  const groups = [];

  if (minBeat === 1 && setupIdx === 0) {
    groups.push(holdGroup(0, Math.round(SEQ_BEAT_HOLD_MS * 0.5)));
  }

  for (let beatIdx = minBeat; beatIdx <= maxBeat && beatIdx < frames.length; beatIdx++) {
    groups.push(...buildBeatGroups(frames[beatIdx - 1], frames[beatIdx], beatIdx));
    const note = frames[beatIdx]?.note?.trim();
    if (note) {
      groups.push(holdGroup(beatIdx, SEQ_BEAT_HOLD_MS));
    }
  }

  return {
    setupPos: copyPos(frames[setupIdx]),
    setupBall: frames[setupIdx]?.ball ?? null,
    groups,
    frames,
  };
}

function applyBeatEnd(pos, ball, frames, beatIdx) {
  const frame = frames[beatIdx];
  if (!frame) return;
  snapPos(pos, frame);
  ball.ball = frame.ball;
  ball.carrier = frame.ball;
  ball.inAir = null;
}

function frameNote(frames, beatIdx) {
  const frame = frames[beatIdx];
  return frame?.note ?? null;
}

function routeForStep(step, progress) {
  return {
    type: step.type,
    route: step.route,
    progress,
    playerId: step.by,
    passTarget: step.for,
  };
}

function withNote(state, frames) {
  return { ...state, note: frameNote(frames, state.beatIdx) };
}

function stateForHold(group, pos, ball, frames) {
  const carrier = ball.carrier ?? ball.ball;
  return withNote(
    {
      pos: { ...pos },
      ball: carrier,
      ballCarrier: carrier,
      ballInAir: null,
      activeRoute: null,
      activeRoutes: [],
      beatIdx: group.beatIdx,
      inTransition: false,
      phase: "hold",
    },
    frames,
  );
}

function stateForPass(step, progress, pos, ball, curFrame) {
  const releaseAt = 0.18;
  const catchAt = 0.8;
  let carrier = step.by;
  let inAir = null;

  if (progress >= releaseAt && progress < catchAt) {
    carrier = null;
    const t = (progress - releaseAt) / (catchAt - releaseAt);
    const pt = samplePolyline(step.route, easeInOut(t));
    const arc = Math.sin(t * Math.PI) * 12;
    inAir = pt ? { x: pt.x, y: pt.y - arc } : null;
  } else if (progress >= catchAt) {
    carrier = step.for;
  }

  const p = { ...pos };

  return {
    pos: p,
    ball: step.for ?? ball.ball,
    ballCarrier: carrier,
    ballInAir: inAir,
    activeRoute: routeForStep(step, progress),
    activeRoutes: [routeForStep(step, progress)],
    beatIdx: step.beatIdx,
    inTransition: true,
    phase: "action",
  };
}

function stateForMove(step, progress, pos, ball, curFrame) {
  const p = { ...pos };
  const head = samplePolyline(step.route, progress);
  if (step.by && head) p[step.by] = head;

  const route = routeForStep(step, progress);
  return {
    pos: p,
    ball: ball.ball,
    ballCarrier: ball.carrier,
    ballInAir: null,
    activeRoute: route,
    activeRoutes: [route],
    beatIdx: step.beatIdx,
    inTransition: true,
    phase: "action",
  };
}

function stateForParallel(group, progress, pos, ball) {
  const p = { ...pos };
  const activeRoutes = [];

  for (const step of group.steps) {
    if (step.type === "pass" || step.type === "handoff") continue;
    const head = samplePolyline(step.route, progress);
    if (step.by && head) p[step.by] = head;
    if (polylineLength(step.route) >= MIN_ROUTE_PX) {
      activeRoutes.push(routeForStep(step, progress));
    }
  }

  const carrier = ball.carrier ?? ball.ball;

  return {
    pos: p,
    ball: carrier,
    ballCarrier: carrier,
    ballInAir: null,
    activeRoute: activeRoutes[0] ?? null,
    activeRoutes,
    beatIdx: group.beatIdx,
    inTransition: true,
    phase: "action",
  };
}

function stateForGroup(group, progress, pos, ball, frames) {
  if (group.phase === "hold" || !group.steps?.length) {
    return stateForHold(group, pos, ball, frames);
  }

  const curFrame = group.curFrame;
  const step = group.steps[0];
  if (group.parallel) return withNote(stateForParallel(group, progress, pos, ball, curFrame), frames);
  if (step.type === "pass" || step.type === "handoff") {
    return withNote(stateForPass(step, progress, pos, ball, curFrame), frames);
  }
  return withNote(stateForMove(step, progress, pos, ball, curFrame), frames);
}

export function getSequentialPlaybackState(timeline, elapsedMs) {
  const { setupPos, setupBall, groups = [], frames = [] } = timeline;
  const pos = { ...setupPos };
  const ball = { ball: setupBall, carrier: setupBall, inAir: null };

  let t = 0;
  let lastBeatIdx = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    if (elapsedMs < t + group.duration) {
      const progress = group.phase === "hold" ? 0 : easeInOut((elapsedMs - t) / group.duration);
      return { ...stateForGroup(group, progress, pos, ball, frames), done: false };
    }

    t += group.duration;

    if (group.phase !== "hold") {
      for (const step of group.steps) {
        applyStepEnd(step, pos, ball);
      }
    } else {
      applyBeatEnd(pos, ball, frames, group.beatIdx);
    }

    lastBeatIdx = group.beatIdx;
  }

  if (lastBeatIdx > 0) {
    applyBeatEnd(pos, ball, frames, lastBeatIdx);
  }

  return withNote(
    {
      pos,
      ball: ball.ball,
      ballCarrier: ball.carrier,
      ballInAir: null,
      activeRoute: null,
      activeRoutes: [],
      beatIdx: lastBeatIdx,
      inTransition: false,
      phase: "done",
      done: true,
    },
    frames,
  );
}

export function sequentialTimelineDuration(timeline, speed = 1) {
  const { groups = [] } = timeline;
  if (!groups.length) return 500 / speed;
  let ms = 0;
  for (let i = 0; i < groups.length; i++) {
    ms += groups[i].duration;
    const next = groups[i + 1];
    const g = groups[i];
    if (g.beatIdx > 0 && (!next || next.beatIdx !== g.beatIdx)) {
      ms += SEQ_PAUSE_MS;
    }
  }
  return ms / speed;
}

export function routeRemainingAhead(route, progress) {
  if (!route?.length || route.length < 2) return [];
  const head = samplePolyline(route, progress ?? 0);
  if (!head) return [];

  const end = route[route.length - 1];
  if (dist(head, end) < MIN_ROUTE_PX * 0.5) return [];

  return [head, end];
}

/** @deprecated use groups — kept for any legacy callers */
export function groupStepsIntoTimeline(flatSteps) {
  return flatSteps.map((step) => ({
    parallel: false,
    steps: [step],
    duration: step.duration,
    beatIdx: step.beatIdx,
  }));
}
