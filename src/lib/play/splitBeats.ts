import { cloneBeats, linkBeatBall, linkBeatPositions } from "./beatOps";
import { holderAfterActions } from "./possession";
import type { Action, Beat, PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";

/** Steps present on a beat, ascending. */
function stepsOf(beat: Beat): number[] {
  const seen = new Set<number>();
  for (const a of beat.actions) {
    if (typeof a.step === "number" && Number.isFinite(a.step)) seen.add(a.step);
  }
  return [...seen].sort((x, y) => x - y);
}

function isMovement(action: Action): boolean {
  return (
    action.type === "cut" || action.type === "dribble" || action.type === "screen"
  );
}

/**
 * Where everyone stands once the given actions have played out.
 *
 * A player who moves ends at their last movement's final point; everyone else has not
 * gone anywhere. This is the whole trick behind splitting: a beat boundary is just a
 * moment, and a moment is a set of positions.
 */
export function positionsAfter(beat: Beat, actions: Action[]): Record<PlayerId, Vec> {
  const out = {} as Record<PlayerId, Vec>;
  for (const id of PLAYER_IDS) {
    const mine = actions.filter((a) => a.by === id && isMovement(a));
    const last = mine[mine.length - 1];
    const end = last?.path?.[last.path.length - 1];
    const from = beat.startPos[id];
    out[id] = end ? { x: end.x, y: end.y } : { x: from.x, y: from.y };
  }
  return out;
}

/** Renumber a beat's steps to 1, 2, 3… preserving order. */
function renumber(actions: Action[]): void {
  const used = [
    ...new Set(
      actions
        .map((a) => a.step)
        .filter((s): s is number => typeof s === "number"),
    ),
  ].sort((a, b) => a - b);
  const map = new Map(used.map((step, i) => [step, i + 1]));
  for (const a of actions) {
    if (typeof a.step === "number") a.step = map.get(a.step) ?? a.step;
  }
}

/**
 * Cut one beat into two at a step boundary.
 *
 * Everything up to and including `afterStep` stays; the rest becomes a new beat that
 * follows. Positions at the seam are computed from the actions themselves, so the two
 * halves join exactly — `beat[N].pos === beat[N+1].startPos` holds by construction
 * rather than by repair.
 *
 * This is what lets a coach draw a play as one continuous sequence and have it broken
 * into beats afterwards. Where the breaks go is a question about quizzing, not about
 * basketball, and it should not be asked while someone is drawing.
 */
export function splitBeatAtStep(
  beats: Beat[],
  beatIndex: number,
  afterStep: number,
): Beat[] {
  const next = cloneBeats(beats);
  const beat = next[beatIndex];
  const steps = stepsOf(beat);

  // Nothing to split if the cut lands before the first step or after the last.
  if (steps.length < 2) return next;
  if (afterStep < steps[0] || afterStep >= steps[steps.length - 1]) return next;

  const stepOf = (a: Action) => a.step ?? steps[0];
  const first = beat.actions.filter((a) => stepOf(a) <= afterStep);
  const rest = beat.actions.filter((a) => stepOf(a) > afterStep);

  const seam = positionsAfter(beat, first);
  const seamBall = holderAfterActions(beat.startBall, first);

  const head: Beat = {
    ...beat,
    pos: seam,
    ball: seamBall,
    actions: first,
  };

  const tail: Beat = {
    ...beat,
    id: `${beat.id}b`,
    startPos: { ...seam },
    pos: beat.pos,
    startBall: seamBall,
    ball: beat.ball,
    actions: rest,
  };

  // A movement in the tail begins at the seam, not where the player started the beat.
  for (const id of PLAYER_IDS) {
    const mine = rest.filter((a) => a.by === id && isMovement(a));
    const firstMove = mine[0];
    if (firstMove?.path && firstMove.path.length >= 2) {
      firstMove.path[0] = { ...seam[id] };
    }
  }

  renumber(head.actions);
  renumber(tail.actions);

  next.splice(beatIndex, 1, head, tail);
  return linkBeatBall(
    linkBeatPositions(next.map((b, i) => ({ ...b, id: `b${i + 1}` }))),
  );
}

/**
 * Fold a beat into the one before it, keeping the moves in order.
 *
 * The inverse of splitting: the seam positions are discarded because they were only ever
 * derived from the actions either side of them.
 */
export function mergeBeatWithPrevious(beats: Beat[], beatIndex: number): Beat[] {
  if (beatIndex <= 0 || beatIndex >= beats.length) return cloneBeats(beats);

  const next = cloneBeats(beats);
  const prev = next[beatIndex - 1];
  const cur = next[beatIndex];

  const offset = Math.max(0, ...prev.actions.map((a) => a.step ?? 0));
  for (const a of cur.actions) {
    a.step = (a.step ?? 1) + offset;
  }

  const merged: Beat = {
    ...prev,
    pos: cur.pos,
    ball: cur.ball,
    actions: [...prev.actions, ...cur.actions],
  };
  renumber(merged.actions);

  next.splice(beatIndex - 1, 2, merged);
  return linkBeatBall(
    linkBeatPositions(next.map((b, i) => ({ ...b, id: `b${i + 1}` }))),
  );
}

/**
 * Where a long beat would most naturally break, for a coach who drew it in one go.
 *
 * A transfer is the strongest signal: the ball changing hands is how coaches talk about
 * a play's phases, and it is also what makes a quizzable moment — "who gets it next" has
 * to sit on one side of a boundary.
 */
export function suggestedSplits(beat: Beat): number[] {
  const steps = stepsOf(beat);
  if (steps.length < 3) return [];

  const out: number[] = [];
  for (const step of steps.slice(0, -1)) {
    const endsPhase = beat.actions.some(
      (a) =>
        (a.step ?? steps[0]) === step &&
        (a.type === "pass" || a.type === "handoff"),
    );
    if (endsPhase) out.push(step);
  }
  return out;
}

/** How many steps of a drawn sequence stay on the court behind you. */
export const VISIBLE_STEPS_WHILE_DRAWING = 2;

/**
 * The actions worth drawing while a coach is building a sequence.
 *
 * A whole play drawn into one beat puts every arrow on one court, and by the sixth move
 * it is unreadable — which defeats the point of drawing continuously. Only the last
 * couple of steps stay visible, plus whatever the coach has selected, so clicking a move
 * in the list brings its arrow back however far up the sequence it is.
 *
 * The play is unaffected: this is about what is on screen, not what is stored.
 */
export function recentActionIds(
  beat: Beat,
  options: { steps?: number; keep?: string | null } = {},
): Set<string> {
  const window = options.steps ?? VISIBLE_STEPS_WHILE_DRAWING;
  const steps = stepsOf(beat);
  const recent = new Set(steps.slice(-window));

  const out = new Set<string>();
  for (const action of beat.actions) {
    const step = action.step ?? steps[0];
    if (recent.has(step) || action.id === options.keep) out.add(action.id);
  }
  return out;
}
