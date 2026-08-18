import type { Action, PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";

/** Court: 500 × 470, baseline at top (y = 0). */
export const COURT_WIDTH = 500;
export const COURT_HEIGHT = 470;

/** Allowed margin outside bounds — “on or near the court”. */
export const COURT_MARGIN = 18;

export const MAX_BEAT_MOVE = 500;
export const MAX_IDLE_MOVE = 25;
export const MAX_SCREENER_MOVE = 60;

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isPlayerId(id: string): id is PlayerId {
  return PLAYER_IDS.includes(id as PlayerId);
}

export function isOnCourt(p: Vec, margin = COURT_MARGIN): boolean {
  return (
    p.x >= -margin &&
    p.x <= COURT_WIDTH + margin &&
    p.y >= -margin &&
    p.y <= COURT_HEIGHT + margin
  );
}

/** Distance moved by a player between consecutive beat end positions. */
export function playerMove(
  prev: Record<PlayerId, Vec> | null | undefined,
  cur: Record<PlayerId, Vec>,
  id: PlayerId,
): number {
  if (!prev?.[id] || !cur[id]) return 0;
  return dist(prev[id], cur[id]);
}

/** Max segment along an action path, or straight-line move if no path. */
export function playerBeatMove(
  prev: Record<PlayerId, Vec> | null | undefined,
  cur: Record<PlayerId, Vec>,
  id: PlayerId,
  actions: Action[],
): number {
  const action = actions.find(
    (a) => a.by === id && (a.type === "cut" || a.type === "dribble"),
  );
  if (action?.path && action.path.length >= 2) {
    let maxSeg = 0;
    for (let i = 1; i < action.path.length; i++) {
      maxSeg = Math.max(maxSeg, dist(action.path[i - 1], action.path[i]));
    }
    return maxSeg;
  }
  return playerMove(prev, cur, id);
}

/** Drawn radius of a player token, in court units. */
export const TOKEN_RADIUS = 15;

/** Closest two tokens may sit: touching, not overlapping. */
export const MIN_TOKEN_GAP = TOKEN_RADIUS * 2;

/**
 * Stop a movement at the edge of anyone standing in the way.
 *
 * Two tokens on the same spot cannot be told apart or selected, so a route that ends on
 * top of a team-mate has to stop short. It stops where it *entered* their space, keeping
 * the direction of travel — backing straight away from the other player instead would
 * bend the route somewhere the coach did not draw.
 *
 * Returns `end` unchanged when nothing is in the way, which is the common case.
 */
export function stopAtPerimeter(
  start: Vec,
  end: Vec,
  occupied: Vec[],
  minGap = MIN_TOKEN_GAP,
): Vec {
  let result = { x: end.x, y: end.y };

  for (const other of occupied) {
    if (dist(result, other) >= minGap) continue;

    const dx = result.x - start.x;
    const dy = result.y - start.y;
    const a = dx * dx + dy * dy;

    if (a < 1e-9) {
      // No travel to speak of — push straight out of their space instead.
      const away = dist(result, other) || 1;
      const ux = (result.x - other.x) / away;
      const uy = (result.y - other.y) / away;
      result = { x: other.x + ux * minGap, y: other.y + uy * minGap };
      continue;
    }

    const fx = start.x - other.x;
    const fy = start.y - other.y;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - minGap * minGap;
    const disc = b * b - 4 * a * c;

    if (disc <= 0) {
      const away = dist(result, other) || 1;
      const ux = (result.x - other.x) / away;
      const uy = (result.y - other.y) / away;
      result = { x: other.x + ux * minGap, y: other.y + uy * minGap };
      continue;
    }

    // Where the route first crosses into their space.
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t <= 0) {
      // Started inside already — back out along the line they came in on.
      const away = dist(result, other) || 1;
      const ux = (result.x - other.x) / away;
      const uy = (result.y - other.y) / away;
      result = { x: other.x + ux * minGap, y: other.y + uy * minGap };
      continue;
    }

    result = { x: start.x + dx * t, y: start.y + dy * t };
  }

  return result;
}
