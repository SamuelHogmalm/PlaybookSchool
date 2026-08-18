import type { Action, Beat, PlayerId, Play, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";

import {
  easeInOutCut,
  easeInOutDribble,
  easeInRoll,
  easeOutScreen,
  linear,
} from "./easing";
import { lerpVec, samplePolyline } from "./pathSample";
import {
  classifyAction,
  movementActionsForPlayer,
  sequenceBeat,
} from "./sequence";
import type { Phase, PositionsSnapshot, TimedAction } from "./types";

/** Below this a route's start and the player's position are the same point. */
const CONTINUITY_EPSILON = 1;

function safeVec(v: Vec | undefined, fallback: Vec): Vec {
  if (!v || Number.isNaN(v.x) || Number.isNaN(v.y)) return { ...fallback };
  return { x: v.x, y: v.y };
}

/** The route a player travels for an action: drawn path, else a straight line. */
export function buildActionRoute(beat: Beat, action: Action): Vec[] {
  if (action.path && action.path.length >= 2) {
    return action.path.map((p) => ({ x: p.x, y: p.y }));
  }
  const start = beat.startPos[action.by];
  const end = beat.pos[action.by];
  if (!start || !end) return [];
  return [{ ...start }, { ...end }];
}

/** Easing curve for an action, by its classified kind. */
export function easeForAction(
  action: TimedAction,
  actions: Action[],
): (u: number) => number {
  const kind = classifyAction(action, actions);
  if (action.type === "screen") return easeOutScreen;
  if (action.type === "dribble") return easeInOutDribble;
  if (kind === "roll") return easeInRoll;
  return easeInOutCut;
}

/**
 * Where a player is at time t, walked across *all* their movements in order.
 *
 * Between two movements they hold at the end of the previous one — that is what
 * makes a screener set the screen, wait, and then roll.
 */
function playerPosAtT(
  beat: Beat,
  timed: TimedAction[],
  playerId: PlayerId,
  t: number,
): Vec {
  const fallback = safeVec(beat.startPos[playerId], { x: 250, y: 235 });
  const movements = movementActionsForPlayer(timed, playerId);

  if (!movements.length) {
    return safeVec(beat.startPos[playerId], fallback);
  }

  let held = fallback;

  for (const movement of movements) {
    // Without a drawn path, travel runs from wherever they currently stand to the
    // beat's end position — never from startPos again, which would rewind them.
    let route =
      movement.path && movement.path.length >= 2
        ? buildActionRoute(beat, movement)
        : [held, safeVec(beat.pos[playerId], held)];

    if (route.length < 2) continue;

    // A movement begins where the player is, whatever its stored path claims. The
    // builder guarantees this by chaining on write, but imported plays do not go
    // through those ops — Alabama beat 3 carries the same cut twice, flattened and
    // bent, and playing the second from its own start snapped the player back to
    // where they began. Nobody teleports mid-beat.
    if (dist(route[0], held) > CONTINUITY_EPSILON) {
      route = [held, ...route.slice(1)];
    }

    if (t <= movement.startAt) return held;

    if (t >= movement.endAt) {
      held = safeVec(route[route.length - 1], held);
      continue;
    }

    const local = (t - movement.startAt) / (movement.endAt - movement.startAt);
    const eased = easeForAction(movement, beat.actions)(local);
    return samplePolyline(route, eased);
  }

  return held;
}

function handOffset(playerPos: Vec, side = 1): Vec {
  return { x: playerPos.x + 14 * side, y: playerPos.y - 4 };
}

function dribbleBallPos(playerPos: Vec, t: number): Vec {
  const bounce = Math.abs(Math.sin(t * Math.PI * 6));
  return { x: playerPos.x + 16, y: playerPos.y + 6 + bounce * 10 };
}

function possessionAtT(
  startBall: PlayerId,
  timed: TimedAction[],
  t: number,
): PlayerId {
  let holder = startBall;
  const transfers = timed
    .filter((a) => a.type === "pass" || a.type === "handoff")
    .sort((a, b) => a.endAt - b.endAt);

  for (const tr of transfers) {
    if (t >= tr.endAt && tr.for) holder = tr.for;
  }
  return holder;
}

function activePassFlight(
  timed: TimedAction[],
  t: number,
): TimedAction | null {
  for (const a of timed) {
    if (a.type !== "pass" && a.type !== "handoff") continue;
    if (t >= a.startAt && t <= a.endAt) return a;
  }
  return null;
}

function computeBall(
  beat: Beat,
  timed: TimedAction[],
  players: Record<PlayerId, Vec>,
  t: number,
): { ball: Vec; possession: PlayerId; ballInFlight: boolean } {
  const startBall = beat.startBall;
  const flight = activePassFlight(timed, t);

  if (flight?.for) {
    const passer = flight.by;
    const receiver = flight.for;
    const releaseT = flight.startAt;
    const catchT = flight.endAt;
    const from = playerPosAtT(beat, timed, passer, releaseT);
    const to = playerPosAtT(beat, timed, receiver, catchT);
    const u = linear((t - flight.startAt) / (flight.endAt - flight.startAt));
    return {
      ball: lerpVec(from, to, u),
      possession: t >= catchT ? receiver : passer,
      ballInFlight: true,
    };
  }

  const possession = possessionAtT(startBall, timed, t);
  const carrier = safeVec(players[possession], { x: 250, y: 235 });

  const dribbling = timed.find(
    (a) =>
      a.type === "dribble" &&
      a.by === possession &&
      t >= a.startAt &&
      t <= a.endAt,
  );

  if (dribbling) {
    return {
      ball: dribbleBallPos(carrier, t),
      possession,
      ballInFlight: false,
    };
  }

  return {
    ball: handOffset(carrier),
    possession,
    ballInFlight: false,
  };
}

function holdSnapshot(beat: Beat): PositionsSnapshot {
  const players = {} as Record<PlayerId, Vec>;
  for (const id of PLAYER_IDS) {
    const end = beat.pos[id] ?? beat.startPos[id];
    players[id] = safeVec(end, { x: 250, y: 235 });
  }
  const possession = beat.ball;
  const carrier = players[possession];
  return {
    players,
    ball: handOffset(carrier),
    possession,
    ballInFlight: false,
  };
}

function moveSnapshot(beat: Beat, t: number): PositionsSnapshot {
  const timed = sequenceBeat(beat);
  const clamped = Math.max(0, Math.min(1, t));
  const players = {} as Record<PlayerId, Vec>;

  for (const id of PLAYER_IDS) {
    players[id] = playerPosAtT(beat, timed, id, clamped);
  }

  const { ball, possession, ballInFlight } = computeBall(
    beat,
    timed,
    players,
    clamped,
  );

  return { players, ball, possession, ballInFlight };
}

/**
 * Pure position engine — single source of truth for player and ball positions.
 * Out-of-range beat indexes return null instead of crashing.
 */
export function positionsAt(
  play: Play,
  beatIndex: number,
  t: number,
  phase: Phase,
): PositionsSnapshot | null {
  if (!play?.beats?.length) return null;
  if (beatIndex < 0 || beatIndex >= play.beats.length) return null;

  const beat = play.beats[beatIndex];
  if (phase === "hold") return holdSnapshot(beat);
  return moveSnapshot(beat, t);
}

/** Guard helper — never emit NaN coords. */
export function validateSnapshot(snap: PositionsSnapshot): boolean {
  const ok = (v: Vec) =>
    Number.isFinite(v.x) && Number.isFinite(v.y);
  if (!ok(snap.ball)) return false;
  for (const id of PLAYER_IDS) {
    if (!ok(snap.players[id])) return false;
  }
  return true;
}

/** Distance ball travels during a pass (for speed checks). */
export function passTravelDistance(beat: Beat, pass: TimedAction): number {
  const timed = sequenceBeat(beat);
  if (!pass.for) return 0;
  const from = playerPosAtT(beat, timed, pass.by, pass.startAt);
  const to = playerPosAtT(beat, timed, pass.for, pass.endAt);
  return dist(from, to);
}

export { playerPosAtT, sequenceBeat };
