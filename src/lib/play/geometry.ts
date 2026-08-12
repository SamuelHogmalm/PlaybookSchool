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
