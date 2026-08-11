import { dist } from "./geometry";
import type { ActionType, Beat, PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";

export const PLAYER_HIT_RADIUS = 22;
export const ACTION_HIT_RADIUS = 14;
export const MIN_DRAW_LENGTH = 12;

export type BuilderTool = "move" | ActionType;

export const DRAW_TOOLS: ActionType[] = [
  "cut",
  "dribble",
  "pass",
  "screen",
  "handoff",
];

export type DrawActionGate = {
  allowed: boolean;
  tooltip: string;
};

function requiresBallHolder(type: ActionType): boolean {
  return type === "pass" || type === "dribble" || type === "handoff";
}

/**
 * Single gate for palette disable state and draw rejection.
 * Pass the selected player for palette checks; pass the token owner when drawing.
 */
export function canDrawAction(
  beat: Beat,
  playerId: PlayerId | null,
  tool: BuilderTool,
): DrawActionGate {
  if (tool === "move") {
    return { allowed: false, tooltip: "" };
  }

  if (requiresBallHolder(tool)) {
    if (!playerId) {
      return {
        allowed: false,
        tooltip: "Select a player first, then draw from their token.",
      };
    }
    if (playerId !== beat.startBall) {
      return {
        allowed: false,
        tooltip: `Only player ${beat.startBall} has the ball at the start of this beat.`,
      };
    }
  }

  // Non-ball tools: palette may enable before a player is selected.
  if (!playerId) {
    return { allowed: true, tooltip: "" };
  }

  if (!beat.startPos[playerId]) {
    return { allowed: false, tooltip: "Player not on court." };
  }

  return { allowed: true, tooltip: "" };
}

export function nearestPlayerAt(
  positions: Record<PlayerId, Vec>,
  point: Vec,
  maxDist = PLAYER_HIT_RADIUS,
  exclude?: PlayerId,
): PlayerId | null {
  let best: PlayerId | null = null;
  let bestD = maxDist;
  for (const id of PLAYER_IDS) {
    if (id === exclude) continue;
    const p = positions[id];
    if (!p) continue;
    const d = dist(p, point);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function pathLength(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

/** Sample path for hit-testing — returns true if point is near any segment. */
export function hitTestPath(point: Vec, path: Vec[], threshold = ACTION_HIT_RADIUS): boolean {
  for (let i = 1; i < path.length; i++) {
    if (distToSegment(point, path[i - 1], path[i]) <= threshold) return true;
  }
  return false;
}

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function actionHitPaths(beat: Beat): Array<{ id: string; points: Vec[] }> {
  const out: Array<{ id: string; points: Vec[] }> = [];
  for (const action of beat.actions) {
    const points = action.path?.length
      ? action.path
      : fallbackActionLine(beat, action);
    if (points.length >= 2) out.push({ id: action.id, points });
  }
  return out;
}

function fallbackActionLine(
  beat: Beat,
  action: { type: ActionType; by: PlayerId; for?: PlayerId },
): Vec[] {
  const from = beat.startPos[action.by];
  if (!from) return [];
  if (action.type === "pass" || action.type === "handoff") {
    const to = action.for ? beat.startPos[action.for] : beat.pos[action.by];
    return to ? [from, to] : [];
  }
  const to = beat.pos[action.by];
  return to ? [from, to] : [];
}
