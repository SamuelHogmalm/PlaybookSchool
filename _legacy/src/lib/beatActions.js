import { IDS } from "./playModel.js";
import { beatEndPositions, beatStartPositions } from "./playModel.js";
import { sortBeatActions } from "./breakdownUtils.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function playerMovedOnBeat(prevFrame, frame, playerId, threshold = 22) {
  const start = beatStartPositions(prevFrame, frame);
  const end = beatEndPositions(prevFrame, frame);
  if (!start[playerId] || !end[playerId]) return false;
  return dist(start[playerId], end[playerId]) > threshold;
}

/** Who holds the ball after actions run in order (pass/handoff transfer; dribble keeps it). */
export function ballHolderAfterActions(startBall, actions = []) {
  let holder = startBall ?? null;
  for (const a of sortBeatActions(actions)) {
    if (a.type === "pass" || a.type === "handoff") {
      if (a.for) holder = a.for;
    } else if (a.type === "dribble" && a.by) {
      holder = a.by;
    }
  }
  return holder;
}

/** Who has the ball at the start of this beat (= end of previous beat). */
export function ballAtBeatStart(prevFrame) {
  if (!prevFrame) return null;
  return prevFrame.ball ?? null;
}

/**
 * Keep only actions that respect ball possession.
 * Multiple passes from the same player = diagram reads/options — never animate those.
 * At most one pass chain per beat (A→B→C only if each passer has the ball).
 */
export function filterActionsByBallPossession(actions, startBall, endBall) {
  const sorted = sortBeatActions(actions);
  const openerPasses = sorted.filter(
    (a) => (a.type === "pass" || a.type === "handoff") && a.by === startBall,
  );

  let holder = startBall ?? null;
  const out = [];

  for (const a of sorted) {
    if (a.type === "pass" || a.type === "handoff") {
      if (!a.by || !a.for || a.by === a.for) continue;
      if (a.by !== holder) continue;

      // Same player listed with multiple receivers = reads on the diagram, not sequence
      if (openerPasses.length > 1 && a.by === startBall) continue;

      out.push(a);
      holder = a.for;
      continue;
    }

    out.push(a);
    if (a.type === "dribble" && a.by) holder = a.by;
  }

  return out;
}

function hasBallTransferAction(actions, from, to) {
  return actions.some(
    (a) => (a.type === "pass" || a.type === "handoff") && a.by === from && a.for === to
  );
}

function lastPassAction(actions) {
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.type === "pass" || a.type === "handoff") return a;
  }
  return null;
}

/** Drop pass-back pairs and self-passes — not real basketball beats. */
export function dedupePassActions(actions = []) {
  const out = [];
  for (const a of sortBeatActions(actions)) {
    if (a.type !== "pass" && a.type !== "handoff") {
      out.push(a);
      continue;
    }
    if (!a.by || !a.for || a.by === a.for) continue;
    const prev = lastPassAction(out);
    if (prev && prev.by === a.for && prev.for === a.by) continue;
    out.push(a);
  }
  return out;
}

/** Insert a pass after any dribbles and before other passes/handoffs. */
function insertOpeningPass(actions, by, forPlayer) {
  if (!by || !forPlayer || by === forPlayer) return actions;
  if (hasBallTransferAction(actions, by, forPlayer)) return actions;

  const pass = { type: "pass", by, for: forPlayer, order: 2 };
  const out = [...actions];
  const passIdx = out.findIndex((a) => a.type === "pass" || a.type === "handoff");
  if (passIdx >= 0) {
    out.splice(passIdx, 0, pass);
  } else {
    const dribbleCount = out.filter((a) => a.type === "dribble").length;
    out.splice(dribbleCount, 0, pass);
  }
  return out;
}

/**
 * Ensure every ball change is covered by a pass/handoff.
 * Inserts an opening pass when the beat inherits a different holder from the
 * previous frame, and a closing pass when actions end on the wrong player.
 */
export function ensureBallContinuity(prev, cur, actions = []) {
  let result = dedupePassActions(sortBeatActions(actions));
  const startBall = ballAtBeatStart(prev);
  const target = cur?.ball ?? startBall;

  if (!target || !IDS.includes(String(target))) return result;
  if (!startBall || !IDS.includes(String(startBall))) return result;

  // Cross-beat / opener: inherit startBall but no pass chain begins there
  if (
    startBall !== target &&
    !hasBallTransferAction(result, startBall, target) &&
    !result.some((a) => (a.type === "pass" || a.type === "handoff") && a.by === startBall)
  ) {
    result = insertOpeningPass(result, startBall, target);
  }

  let holder = ballHolderAfterActions(startBall, result);

  // Closing pass: actions finish on wrong player vs frame end ball
  if (holder !== target) {
    const lastPass = lastPassAction(result);
    const wouldPassBack = lastPass && lastPass.by === target && lastPass.for === holder;

    if (
      !wouldPassBack &&
      holder &&
      holder !== target &&
      !hasBallTransferAction(result, holder, target)
    ) {
      result = [...result, { type: "pass", by: holder, for: target, order: 2 }];
    }
  }

  return dedupePassActions(result);
}

/**
 * Add cuts/dribbles/passes for players who moved but have no explicit action.
 * Used after AI import when vision misses lines — flagged uncertain for coach review.
 */
export function fillMissingActionsFromMovement(prev, cur, actions = []) {
  if (!prev?.pos || !cur?.pos) return actions;

  const startBall = ballAtBeatStart(prev);
  const covered = new Set(actions.map((a) => a.by).filter(Boolean));
  const filled = [...actions];

  if (
    startBall &&
    cur.ball &&
    startBall !== cur.ball &&
    !hasBallTransferAction(filled, startBall, cur.ball)
  ) {
    filled.push({
      type: "pass",
      by: startBall,
      for: cur.ball,
      order: 2,
      uncertain: true,
      reason: "Ball changed from previous beat but no pass line was detected",
    });
    covered.add(startBall);
  }

  for (const id of IDS) {
    if (covered.has(id)) continue;
    if (!playerMovedOnBeat(prev, cur, id, 22)) continue;
    const type =
      id === startBall && (!cur.ball || cur.ball === id) ? "dribble" : "cut";
    filled.push({
      type,
      by: id,
      order: type === "dribble" ? 1 : 4,
      uncertain: true,
      reason: "Player moved but no line was detected on the diagram",
    });
    covered.add(id);
  }

  return sortBeatActions(filled);
}

export function beatHasPositionMovement(prev, cur, threshold = 22) {
  if (!prev?.pos || !cur?.pos) return false;
  return IDS.some((id) => playerMovedOnBeat(prev, cur, id, threshold));
}

/** Strip read-style duplicate passes when loading or interpreting a beat. */
export function sanitizeFrameActions(actions = [], ball = null) {
  const sorted = sortBeatActions(actions);
  const seenPassBy = new Set();
  const out = [];

  for (const a of sorted) {
    if (a.type === "pass" || a.type === "handoff") {
      if (!a.by || !a.for || a.by === a.for) continue;
      if (seenPassBy.has(a.by)) continue;
      seenPassBy.add(a.by);
    }
    out.push(a);
  }

  return out;
}

export function inferBeatActions(prev, cur) {
  const explicit = sortBeatActions(cur.actions ?? []);
  if (explicit.length) {
    const start = ballAtBeatStart(prev);
    return sortBeatActions(sanitizeFrameActions(explicit, start));
  }

  return inferBeatActionsFromMovement(prev, cur);
}

/** For quiz sequential playback — explicit actions + ball continuity fixes. */
export function prepareBeatActions(prev, cur) {
  return ensureBallContinuity(prev, cur, inferBeatActions(prev, cur));
}

function inferBeatActionsFromMovement(prev, cur) {
  const inferred = [];
  const ballChanged = cur.ball && prev.ball && cur.ball !== prev.ball;

  if (prev.ball && playerMovedOnBeat(prev, cur, prev.ball, 35)) {
    inferred.push({ type: "dribble", by: prev.ball, order: 1 });
  }

  if (ballChanged) {
    inferred.push({ type: "pass", by: prev.ball, for: cur.ball, order: 2 });
  }

  for (const cutter of IDS) {
    if (cutter === prev.ball && ballChanged) continue;
    if (!playerMovedOnBeat(prev, cur, cutter, 40)) continue;
    for (const screener of IDS) {
      if (screener === cutter) continue;
      const endS = beatEndPositions(prev, cur)[screener];
      const startC = beatStartPositions(prev, cur)[cutter];
      if (endS && startC && dist(endS, startC) < 55) {
        inferred.push({ type: "screen", by: screener, for: cutter, order: 3 });
      }
    }
  }

  for (const id of IDS) {
    if (!playerMovedOnBeat(prev, cur, id, 40)) continue;
    const tagged = inferred.some((a) => a.by === id || a.for === id);
    if (tagged) continue;
    const vacated = IDS.find((other) => {
      if (other === id) return false;
      if (!playerMovedOnBeat(prev, cur, other, 40)) return false;
      const oldSpot = prev.pos[other];
      const newSpot = cur.pos[id];
      return oldSpot && newSpot && dist(oldSpot, newSpot) < 50;
    });
    inferred.push({ type: vacated ? "fill" : "cut", by: id, order: 4 });
  }

  return ensureBallContinuity(prev, cur, inferred);
}
