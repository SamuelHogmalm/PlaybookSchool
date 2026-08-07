import { IDS } from "./playModel.js";
import { effectivePositions } from "./playModel.js";
import { sortBeatActions, stageKeyForType } from "./breakdownUtils.js";

import { BEAT_DURATION_MS, BEAT_HOLD_MS } from "./animation/constants.js";

export { BEAT_DURATION_MS, BEAT_HOLD_MS };
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5];
export const QUIZ_BEAT_HOLD_MS = BEAT_HOLD_MS;
export const QUIZ_BEAT_TRANS_MS = BEAT_DURATION_MS;

/** Legacy smooth-lerp playback — not used by quiz or editor Run Play */

/** Staged action order within one beat transition (quiz / learning playback only) */
const STAGE = {
  dribble: [0, 0.24],
  ball: [0.24, 0.54],
  screen: [0.54, 0.74],
  move: [0.74, 1],
};

function stageProgress(f, [start, end]) {
  if (f <= start) return 0;
  if (f >= end) return 1;
  return easeInOut((f - start) / (end - start));
}

function actionStage(type) {
  const key = stageKeyForType(type);
  if (key === "dribble") return STAGE.dribble;
  if (key === "ball") return STAGE.ball;
  if (key === "screen") return STAGE.screen;
  return STAGE.move;
}

function localProgressInStage(f, stageWindow, index, count) {
  const [start, end] = stageWindow;
  const len = end - start;
  const slotStart = start + (index / count) * len;
  const slotEnd = start + ((index + 1) / count) * len;
  return stageProgress(f, [slotStart, slotEnd]);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function timelineDuration(frames, speed) {
  const n = frames.length;
  if (n <= 1) return BEAT_HOLD_MS / speed;
  return (n * BEAT_HOLD_MS + (n - 1) * BEAT_DURATION_MS) / speed;
}

export function quizTimelineDuration(frames, speed) {
  const n = frames.length;
  if (n <= 1) return QUIZ_BEAT_HOLD_MS / speed;
  return (n * QUIZ_BEAT_HOLD_MS + (n - 1) * QUIZ_BEAT_TRANS_MS) / speed;
}

function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

export function samplePolyline(pts, t) {
  if (!pts?.length) return null;
  if (pts.length === 1) return { ...pts[0] };
  const total = polylineLength(pts);
  if (total === 0) return { ...pts[0] };
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const u = seg === 0 ? 1 : target / seg;
      return {
        x: lerp(pts[i - 1].x, pts[i].x, u),
        y: lerp(pts[i - 1].y, pts[i].y, u),
      };
    }
    target -= seg;
  }
  return { ...pts[pts.length - 1] };
}

function frameActions(nextFrame) {
  return sortBeatActions(nextFrame.actions ?? []);
}

function passRoute(action, prevFrame, nextFrame, actions) {
  const idx = actions.indexOf(action);
  const prior = idx >= 0 ? actions.slice(0, idx) : [];
  const atPos = effectivePositions(prevFrame.pos, nextFrame.pos, prior);
  if (action.path?.length >= 2) return action.path.map((p) => ({ ...p }));
  const from = atPos[action.by] ?? prevFrame.pos[action.by];
  const to = atPos[action.for] ?? nextFrame.pos[action.for];
  if (!from || !to) return [];
  return [{ ...from }, { ...to }];
}

/** Default — all players drift smoothly to their next spots (original feel). */
export function getSmoothTransitionPositions(prevFrame, nextFrame, f) {
  const a = prevFrame.pos;
  const b = nextFrame.pos;
  const out = {};
  IDS.forEach((id) => {
    if (a[id] && b[id]) {
      out[id] = { x: lerp(a[id].x, b[id].x, f), y: lerp(a[id].y, b[id].y, f) };
    }
  });
  return out;
}

/** Quiz learning playback — dribble, then ball, then screens, then cuts/movement */
export function getStagedTransitionPositions(prevFrame, nextFrame, f) {
  const actions = frameActions(nextFrame);
  const actionMovers = new Set(actions.filter((a) => a.by).map((a) => a.by));
  const moveF = stageProgress(f, STAGE.move);
  const out = {};

  IDS.forEach((id) => {
    const from = prevFrame.pos[id];
    const to = nextFrame.pos[id];
    if (!from || !to) return;
    if (!actionMovers.has(id)) {
      out[id] = { x: lerp(from.x, to.x, moveF), y: lerp(from.y, to.y, moveF) };
    } else {
      out[id] = { ...from };
    }
  });

  const stageBuckets = { dribble: [], ball: [], screen: [], move: [] };
  for (const a of actions) {
    if (!["cut", "dribble", "screen", "handoff", "fill", "relocate"].includes(a.type)) continue;
    stageBuckets[stageKeyForType(a.type)].push(a);
  }

  for (const stageKey of ["dribble", "ball", "screen", "move"]) {
    const group = stageBuckets[stageKey];
    for (let gi = 0; gi < group.length; gi++) {
      const a = group[gi];
      const prior = actions.slice(0, actions.indexOf(a));
      const atPos = effectivePositions(prevFrame.pos, nextFrame.pos, prior);
      const from = atPos[a.by] ?? prevFrame.pos[a.by];
      const end = a.path?.length ? a.path[a.path.length - 1] : nextFrame.pos[a.by];
      const route = a.path?.length >= 2 ? a.path : [from, end];
      const window = actionStage(a.type);
      const localF = localProgressInStage(f, window, gi, group.length);
      out[a.by] = samplePolyline(route, localF);
    }
  }

  return out;
}

export function getTransitionPositions(prevFrame, nextFrame, f, opts = {}) {
  if (opts.staged) return getStagedTransitionPositions(prevFrame, nextFrame, f);
  return getSmoothTransitionPositions(prevFrame, nextFrame, f);
}

const HANDOFF_BALL_MEET = 0.88;

function animatePassAlongRoute(route, ballF) {
  const releaseAt = 0.22;
  const catchAt = 0.78;

  if (ballF < releaseAt) {
    return { inAir: false, progress: 0, phase: "hold" };
  }
  if (ballF >= catchAt) {
    return { inAir: false, progress: 1, phase: "caught" };
  }

  const t = (ballF - releaseAt) / (catchAt - releaseAt);
  const eased = easeInOut(t);
  const p = samplePolyline(route, eased);
  const arc = Math.sin(t * Math.PI) * 16;
  return { inAir: true, point: { x: p.x, y: p.y - arc }, phase: "air" };
}

function resolveBall(prevFrame, nextFrame, f, opts = {}) {
  const actions = frameActions(nextFrame);
  const ballF = opts.staged ? stageProgress(f, STAGE.ball) : f;
  const startBall = prevFrame.ball;

  const handoff = actions.find((a) => a.type === "handoff");
  if (handoff) {
    if (ballF < HANDOFF_BALL_MEET) {
      return { ballCarrier: handoff.by, ballInAir: null };
    }
    return { ballCarrier: handoff.for, ballInAir: null };
  }

  const ballActions = actions.filter((a) => a.type === "pass" || a.type === "handoff");

  if (ballActions.length) {
    const slot = Math.min(ballActions.length - 1, Math.floor(ballF * ballActions.length));
    const localF =
      ballActions.length === 1 ? ballF : ballF * ballActions.length - slot;
    const activePass = ballActions[slot];
    const route = passRoute(activePass, prevFrame, nextFrame, actions);
    if (route.length >= 2) {
      const anim = animatePassAlongRoute(route, localF);
      if (anim.phase === "hold") return { ballCarrier: activePass.by, ballInAir: null };
      if (anim.phase === "caught") return { ballCarrier: activePass.for, ballInAir: null };
      return { ballCarrier: null, ballInAir: anim.point };
    }
  }

  const dribble = actions.find((a) => a.type === "dribble" && a.by === startBall);
  if (dribble) {
    const dribF = opts.staged ? stageProgress(f, STAGE.dribble) : f;
    if (dribF < 1) return { ballCarrier: dribble.by, ballInAir: null };
  }

  if (startBall && nextFrame.ball && startBall !== nextFrame.ball) {
    const from = prevFrame.pos[startBall];
    const to = prevFrame.pos[nextFrame.ball] ?? nextFrame.pos[nextFrame.ball];
    if (from && to && dist(from, to) >= 14) {
      const anim = animatePassAlongRoute([from, to], ballF);
      if (anim.phase === "hold") return { ballCarrier: startBall, ballInAir: null };
      if (anim.phase === "caught") return { ballCarrier: nextFrame.ball, ballInAir: null };
      return { ballCarrier: null, ballInAir: anim.point };
    }
  }

  const carrier = f < 0.5 ? startBall ?? prevFrame.ball : nextFrame.ball;
  return { ballCarrier: carrier, ballInAir: null };
}

export function getPlaybackState(frames, elapsedMs, speed, opts = {}) {
  if (!frames.length) return null;
  const staged = opts.staged ?? false;
  const hold = (staged ? QUIZ_BEAT_HOLD_MS : BEAT_HOLD_MS) / speed;
  const trans = (staged ? QUIZ_BEAT_TRANS_MS : BEAT_DURATION_MS) / speed;
  let t = 0;

  for (let i = 0; i < frames.length; i++) {
    if (elapsedMs < t + hold) {
      const frame = frames[i];
      return {
        pos: frame.pos,
        ball: frame.ball,
        ballCarrier: frame.ball,
        ballInAir: null,
        beatIdx: i,
        note: frame.note,
        inTransition: false,
        transitionF: 0,
        staged,
      };
    }
    t += hold;

    if (i < frames.length - 1) {
      if (elapsedMs < t + trans) {
        const raw = (elapsedMs - t) / trans;
        const f = easeInOut(raw);
        const out = getTransitionPositions(frames[i], frames[i + 1], f, { staged });
        const { ballCarrier, ballInAir } = resolveBall(frames[i], frames[i + 1], f, { staged });
        return {
          pos: out,
          ball: frames[i + 1].ball,
          ballCarrier,
          ballInAir,
          beatIdx: i + 1,
          note: frames[i + 1].note,
          inTransition: true,
          transitionF: f,
          staged,
        };
      }
      t += trans;
    }
  }

  const last = frames.length - 1;
  const frame = frames[last];
  return {
    pos: frame.pos,
    ball: frame.ball,
    ballCarrier: frame.ball,
    ballInAir: null,
    beatIdx: last,
    note: frame.note,
    inTransition: false,
    transitionF: 0,
    staged,
  };
}

export function playerHasBall(playback, frame, playerId) {
  if (playback?.ballInAir) return false;
  const carrier = playback?.ballCarrier ?? playback?.ball ?? frame?.ball;
  return carrier === playerId;
}

export function getBeatTransitionState(prevFrame, nextFrame, elapsedMs, opts = {}) {
  const staged = opts.staged ?? false;
  const hold = (opts.holdMs ?? (staged ? QUIZ_BEAT_HOLD_MS : BEAT_HOLD_MS)) / (opts.speed ?? 1);
  const trans = (opts.transMs ?? (staged ? QUIZ_BEAT_TRANS_MS : BEAT_DURATION_MS)) / (opts.speed ?? 1);
  const total = hold + trans;

  if (elapsedMs <= hold) {
    return {
      pos: prevFrame.pos,
      ball: prevFrame.ball,
      ballCarrier: prevFrame.ball,
      ballInAir: null,
      done: false,
      totalMs: total,
      staged,
    };
  }

  if (elapsedMs <= hold + trans) {
    const f = easeInOut((elapsedMs - hold) / trans);
    const out = getTransitionPositions(prevFrame, nextFrame, f, { staged });
    const { ballCarrier, ballInAir } = resolveBall(prevFrame, nextFrame, f, { staged });
    return {
      pos: out,
      ball: nextFrame.ball,
      ballCarrier,
      ballInAir,
      done: false,
      totalMs: total,
      staged,
    };
  }

  return {
    pos: nextFrame.pos,
    ball: nextFrame.ball,
    ballCarrier: nextFrame.ball,
    ballInAir: null,
    done: true,
    totalMs: total,
    staged,
  };
}

export const QUIZ_REVEAL_HOLD_MS = 350;
export const QUIZ_REVEAL_TRANS_MS = 900;
