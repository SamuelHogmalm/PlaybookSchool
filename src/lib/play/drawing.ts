import { dist } from "./geometry";
import { currentHolder } from "./possession";
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
    // Possession as it stands *now*, not at the start of the beat. Draw a pass to 4 and
    // 4 has the ball — refusing to let them dribble next, while the arrow saying so is
    // on screen, is the tool disagreeing with the drawing.
    const holder = currentHolder(beat);
    if (playerId !== holder) {
      return {
        allowed: false,
        tooltip:
          holder === beat.startBall
            ? `Only player ${holder} has the ball on this beat.`
            : `Player ${holder} has the ball now — ${beat.startBall} passed it away.`,
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

/**
 * Where each player is once the actions already drawn on this beat have happened.
 *
 * A player who has been given a cut is at the end of it, not back at the start — so a
 * pass drawn to where they are going has to find them there. Aiming at a player's
 * destination and having the pass silently dropped, because the only positions searched
 * were start-of-beat ones, is the tool refusing to read its own diagram.
 *
 * Players with no movement have not gone anywhere, so their start position is current.
 */
export function targetPositions(beat: Beat): Record<PlayerId, Vec> {
  const out = {} as Record<PlayerId, Vec>;
  for (const id of PLAYER_IDS) {
    const moved = beat.actions.some(
      (a) =>
        a.by === id &&
        (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
    );
    const spot = (moved ? beat.pos[id] : beat.startPos[id]) ?? beat.startPos[id];
    if (spot) out[id] = { x: spot.x, y: spot.y };
  }
  return out;
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

/** Most points a stored action path keeps after simplification. */
export const MAX_PATH_POINTS = 12;

/** Perpendicular distance from p to the line through a and b. */
function perpendicularDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  const cross = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return cross / Math.sqrt(lenSq);
}

/** Ramer–Douglas–Peucker. Always keeps the first and last point. */
function rdp(points: Vec[], epsilon: number): Vec[] {
  if (points.length <= 2) return points.slice();

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let pivot = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      pivot = i;
    }
  }

  if (maxDist <= epsilon) return [first, last];

  const left = rdp(points.slice(0, pivot + 1), epsilon);
  const right = rdp(points.slice(pivot), epsilon);
  return left.slice(0, -1).concat(right);
}

/**
 * Reduce a freehand stroke to at most `maxPoints`, keeping its shape.
 *
 * Pointer input lands a point every 8 court units, which is both jittery to look at
 * and more detail than the motion engine needs. Paths already within budget are
 * returned untouched — imported and AI-read paths are usually two or three points
 * and must not be reshaped by a builder concern.
 *
 * The endpoints are the action's real start and finish, so RDP is used precisely
 * because it can never move or drop them.
 */
export function simplifyPath(points: Vec[], maxPoints = MAX_PATH_POINTS): Vec[] {
  const copy = points.map((p) => ({ x: p.x, y: p.y }));
  if (copy.length <= Math.max(2, maxPoints)) return copy;

  // Smallest epsilon that meets the budget keeps the most shape. 64 units is wider
  // than any real stroke deviation, so it always collapses to the two endpoints.
  let lo = 0;
  let hi = 64;
  let best = rdp(copy, hi);

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = rdp(copy, mid);
    if (candidate.length <= maxPoints) {
      best = candidate;
      hi = mid;
    } else {
      lo = mid;
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
