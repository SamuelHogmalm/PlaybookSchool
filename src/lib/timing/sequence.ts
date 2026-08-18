import type { Action, Beat, Vec } from "@/lib/play/types";
import type { TimedAction } from "./types";

type ActionKind =
  | "screen"
  | "cut"
  | "cut_off_screen"
  | "dribble"
  | "roll"
  | "handoff"
  | "pass";

function isMovement(action: Action): boolean {
  return (
    action.type === "cut" ||
    action.type === "dribble" ||
    action.type === "screen"
  );
}

function classifyAction(action: Action, actions: Action[]): ActionKind {
  if (action.type === "screen") return "screen";
  if (action.type === "pass") return "pass";
  if (action.type === "handoff") return "handoff";
  if (action.type === "dribble") return "dribble";
  if (action.type === "cut") {
    const screenedFor = actions.some(
      (a) => a.type === "screen" && a.for === action.by,
    );
    if (screenedFor) return "cut_off_screen";
    const screenerRoll = actions.some(
      (a) => a.type === "screen" && a.by === action.by,
    );
    if (screenerRoll) return "roll";
    return "cut";
  }
  return "cut";
}

function defaultLane(kind: ActionKind): [number, number] {
  switch (kind) {
    case "screen":
      return [0, 0.3];
    case "cut":
      return [0.1, 0.7];
    case "cut_off_screen":
      return [0.25, 0.7];
    case "dribble":
      return [0.25, 0.85];
    case "roll":
      return [0.45, 1];
    case "handoff":
      return [0.4, 0.6];
    case "pass":
      return [0.75, 0.9];
    default:
      return [0.1, 0.7];
  }
}

function cloneTimed(action: Action, startAt: number, endAt: number): TimedAction {
  return {
    ...action,
    path: action.path?.map((p) => ({ x: p.x, y: p.y })),
    startAt,
    endAt,
  };
}

function applyDependencies(timed: TimedAction[], actions: Action[]): void {
  for (const screen of timed.filter((a) => a.type === "screen")) {
    const cutter = screen.for;
    if (!cutter) continue;
    for (const a of timed) {
      if (a.by === cutter && isMovement(a)) {
        a.startAt = Math.max(a.startAt, screen.endAt);
        if (a.endAt <= a.startAt) a.endAt = a.startAt + 0.25;
      }
    }
  }

  for (const screen of timed.filter((a) => a.type === "screen")) {
    const cutter = screen.for;
    const roll = timed.find(
      (a) =>
        a.type === "cut" &&
        a.by === screen.by &&
        classifyAction(a, actions) === "roll",
    );
    const cutterCut = timed.find((a) => a.by === cutter && isMovement(a));
    if (roll && cutterCut) {
      roll.startAt = Math.max(roll.startAt, cutterCut.endAt);
      if (roll.endAt <= roll.startAt) roll.endAt = roll.startAt + 0.45;
    }
  }

  /*
   * A passer's dribble comes *before* the pass; their cut or screen comes *after*.
   *
   * The notation settles this. A player travelling with the ball is drawn as a dribble
   * — squiggle, not a solid arrow. So a *cut* attributed to the passer can only be the
   * move they make once their hands are empty, and forcing the pass to wait for it (as
   * this rule used to) had the ball arrive after the passer had already left.
   *
   * You still throw from where you stand: it is the dribble that decides where that is.
   */
  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const dribble = timed.find(
      (a) => a.by === pass.by && a.type === "dribble",
    );
    if (dribble) {
      pass.startAt = Math.max(pass.startAt, dribble.endAt);
      if (pass.endAt <= pass.startAt) pass.endAt = pass.startAt + 0.15;
    }
  }


  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const recv = pass.for;
    if (!recv) continue;
    const recvMove = timed.find((a) => a.by === recv && isMovement(a));
    if (recvMove) {
      const releaseAt =
        recvMove.startAt + 0.6 * (recvMove.endAt - recvMove.startAt);
      pass.startAt = Math.max(pass.startAt, releaseAt);
      if (pass.endAt <= pass.startAt) pass.endAt = pass.startAt + 0.15;
    }
  }

  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const recv = pass.for;
    if (!recv) continue;
    for (const a of timed) {
      if (
        a.by === recv &&
        (a.type === "pass" || a.type === "dribble" || a.type === "handoff") &&
        a.id !== pass.id
      ) {
        a.startAt = Math.max(a.startAt, pass.endAt);
        if (a.endAt <= a.startAt) a.endAt = a.startAt + 0.15;
      }
    }
  }

  for (const a of timed) {
    if (classifyAction(a, actions) === "cut_off_screen") {
      const screen = timed.find(
        (s) => s.type === "screen" && s.for === a.by,
      );
      if (screen) {
        a.startAt = Math.max(a.startAt, screen.endAt);
        a.endAt = Math.max(a.endAt, a.startAt + 0.45);
      }
    }
  }

  // Last, because the rules above move passes later — a receiver has to be open before
  // the ball is thrown. Placing the passer's cut against a pass time that then shifts
  // would put them moving before they had released it.
  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    for (const move of timed) {
      if (move.by !== pass.by) continue;
      if (move.type !== "cut" && move.type !== "screen") continue;
      move.startAt = Math.max(move.startAt, pass.endAt);
      if (move.endAt <= move.startAt) move.endAt = move.startAt + 0.45;
    }
  }

  serialisePerPlayer(timed);
}

/**
 * Nobody is in two places at once.
 *
 * A player's own movements run one after another. Screen-then-roll already came out
 * ordered because their lanes differ and the rules above stagger them, but two cuts
 * shared the identical default lane and animated on top of each other — the player
 * travelled one route and snapped to the other's endpoint at the end of the beat.
 *
 * Each movement keeps its duration and is pushed to start no earlier than the previous
 * one ends. `normalizeEndAtOne` rescales afterwards, so the beat still finishes at 1.
 */
function serialisePerPlayer(timed: TimedAction[]): void {
  const byPlayer = new Map<string, TimedAction[]>();
  for (const a of timed) {
    if (!isMovement(a)) continue;
    const list = byPlayer.get(a.by) ?? [];
    list.push(a);
    byPlayer.set(a.by, list);
  }

  for (const movements of byPlayer.values()) {
    if (movements.length < 2) continue;
    // Drawn order breaks ties, which is what makes a second stroke read as "then".
    movements.sort(
      (a, b) =>
        a.startAt - b.startAt ||
        a.endAt - b.endAt ||
        timed.indexOf(a) - timed.indexOf(b),
    );

    for (let i = 1; i < movements.length; i++) {
      const prev = movements[i - 1];
      const cur = movements[i];
      if (cur.startAt >= prev.endAt) continue;
      const duration = Math.max(0.05, cur.endAt - cur.startAt);
      cur.startAt = prev.endAt;
      cur.endAt = cur.startAt + duration;
    }
  }
}

function normalizeEndAtOne(timed: TimedAction[]): void {
  const maxEnd = Math.max(0.001, ...timed.map((a) => a.endAt));
  if (maxEnd === 1) return;
  const scale = 1 / maxEnd;
  for (const a of timed) {
    a.startAt *= scale;
    a.endAt *= scale;
  }
}

/** Distinct step numbers on a beat, ascending. Empty when the beat has no steps. */
export function beatSteps(beat: Beat): number[] {
  const steps = new Set<number>();
  for (const a of beat.actions ?? []) {
    if (typeof a.step === "number" && Number.isFinite(a.step)) steps.add(a.step);
  }
  return [...steps].sort((x, y) => x - y);
}

/**
 * Step mode: each step owns an equal slice of the beat, in order.
 *
 * Everything in a step starts and ends together; nothing spans two steps. That is the
 * whole point — a player learning the play sees one thing happen, then the next, and
 * "these two cut together" is something the coach states rather than something the
 * engine infers from geometry.
 *
 * Equal slices rather than duration-weighted ones: a step is a beat the viewer counts,
 * and steps that varied in length by route length would be harder to follow, not easier.
 */
function sequenceBySteps(beat: Beat, steps: number[]): TimedAction[] {
  const actions = beat.actions ?? [];
  const slice = 1 / steps.length;

  const timed = actions.map((action) => {
    // An action with no step of its own belongs to the first — it predates stepping.
    const index = Math.max(0, steps.indexOf(action.step ?? steps[0]));
    return cloneTimed(action, index * slice, (index + 1) * slice);
  });

  timeHandoffs(beat, timed);
  return timed;
}

/** A handoff is an instant, not a journey. */
const HANDOFF_WINDOW = 0.08;

/** Straight-line fallback when an action carries no drawn path. */
function routeOf(beat: Beat, action: Action): Vec[] {
  if (action.path && action.path.length >= 2) return action.path;
  const from = beat.startPos[action.by];
  const to = beat.pos[action.by];
  return from && to ? [from, to] : [];
}

/**
 * Put a handoff at the moment the two players are actually together.
 *
 * Given its own slice of the beat, a handoff plays *after* both players have finished
 * running — so they cross, separate, and only then does the ball change hands, which
 * reads as a late pass rather than an exchange.
 *
 * The receiver's route is sampled for its closest approach to the handler, and the
 * handoff is pinned to a brief window there. It stays inside the receiver's own step, so
 * the ordering the coach set is untouched.
 */
function timeHandoffs(beat: Beat, timed: TimedAction[]): void {
  for (const handoff of timed) {
    if (handoff.type !== "handoff" || !handoff.for) continue;

    const receiverMove = timed.find(
      (a) => a.by === handoff.for && isMovement(a),
    );
    if (!receiverMove) continue;

    const at = beat.pos[handoff.by] ?? beat.startPos[handoff.by];
    const route = routeOf(beat, receiverMove);
    if (!at || route.length < 2) continue;

    let bestU = 0.5;
    let bestDist = Infinity;
    const samples = 40;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const point = pointAlong(route, u);
      const d = Math.hypot(point.x - at.x, point.y - at.y);
      if (d < bestDist) {
        bestDist = d;
        bestU = u;
      }
    }

    const span = receiverMove.endAt - receiverMove.startAt;
    const meeting = receiverMove.startAt + bestU * span;
    const half = Math.min(HANDOFF_WINDOW, span) / 2;

    handoff.startAt = Math.max(receiverMove.startAt, meeting - half);
    handoff.endAt = Math.min(receiverMove.endAt, meeting + half);
    if (handoff.endAt <= handoff.startAt) {
      handoff.endAt = Math.min(receiverMove.endAt, handoff.startAt + 0.02);
    }
  }
}

/** Point at arc-length fraction u along a polyline. */
function pointAlong(points: Vec[], u: number): Vec {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (total === 0) return { ...points[0] };

  let target = total * Math.max(0, Math.min(1, u));
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    if (target <= seg) {
      const f = seg === 0 ? 0 : target / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * f,
      };
    }
    target -= seg;
  }
  return { ...points[points.length - 1] };
}

/**
 * Derive startAt/endAt for every action on a beat.
 *
 * The coach never sets milliseconds. They may set *order* — see `beatSteps` — and when
 * they have, that wins over the derived lanes, because a stated intent beats a guess.
 */
export function sequenceBeat(beat: Beat): TimedAction[] {
  const actions = beat.actions ?? [];
  const steps = beatSteps(beat);

  const timed: TimedAction[] = steps.length
    ? sequenceBySteps(beat, steps)
    : actions.map((action) => {
        const kind = classifyAction(action, actions);
        const [startAt, endAt] = defaultLane(kind);
        return cloneTimed(action, startAt, endAt);
      });

  if (!steps.length) {
    applyDependencies(timed, actions);
    normalizeEndAtOne(timed);
  }

  return timed.sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
}

/**
 * Every movement a player makes in a beat, in the order they make them.
 *
 * A screener who screens and then rolls has two. Taking only the first drops the
 * roll and leaves them standing at the screen for the rest of the beat.
 */
export function movementActionsForPlayer(
  timed: TimedAction[],
  playerId: string,
): TimedAction[] {
  return timed
    .filter(
      (a) =>
        a.by === playerId &&
        (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
    )
    .sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
}

export { classifyAction, isMovement };
