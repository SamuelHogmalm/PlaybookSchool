import type { Action, ActionType, Beat, Play, PlayerId, Vec } from "./types";
import { cloneBeats, linkBeatBall, linkBeatPositions } from "./beatOps";
import { pathLength, simplifyPath } from "./drawing";

/** Next free `aN` id in a beat. Exported so a drag can claim its id up front. */
export function nextActionId(actions: Action[]): string {
  let max = 0;
  for (const a of actions) {
    if (/^a\d+$/.test(a.id)) max = Math.max(max, parseInt(a.id.slice(1), 10));
  }
  return `a${max + 1}`;
}

function copyPath(path: Vec[]): Vec[] {
  return path.map((p) => ({ x: p.x, y: p.y }));
}

export type DrawnActionInput = {
  type: ActionType;
  by: PlayerId;
  for?: PlayerId;
  path: Vec[];
};

/**
 * Write a coach-drawn action; updates pos and ball as needed.
 *
 * With `actionId`, an existing action of that id is replaced in place and a missing one
 * is created with it. That is what lets a drag rewrite its own action on every pointer
 * move instead of appending a new one per frame.
 */
export function upsertDrawnAction(
  beats: Beat[],
  beatIndex: number,
  input: DrawnActionInput,
  actionId?: string,
): Beat[] {
  const next = cloneBeats(beats);
  const beat = next[beatIndex];
  // Simplify on the way in, so what the animator samples for motion and what the
  // builder renders are the same points. Endpoints survive RDP unchanged.
  const path = simplifyPath(copyPath(input.path));
  const id = actionId ?? nextActionId(beat.actions);
  const action: Action = {
    id,
    type: input.type,
    by: input.by,
    path,
  };
  if (input.for) action.for = input.for;

  if ((input.type === "pass" || input.type === "handoff") && input.for) {
    beat.ball = input.for;
  }

  const existing = beat.actions.findIndex((a) => a.id === id);
  if (existing >= 0) {
    beat.actions = beat.actions.map((a, i) => (i === existing ? action : a));
  } else {
    beat.actions = [...beat.actions, action];
  }

  if (isMovementType(input.type)) {
    chainPlayerMovements(beat, input.by);
  }

  // Relink rather than patching the next beat's startPos: later beats where this
  // player was holding need to follow them, not just inherit a new start point.
  return linkBeatBall(linkBeatPositions(next));
}

/** Add a coach-drawn action under a fresh id. */
export function addDrawnAction(
  beats: Beat[],
  beatIndex: number,
  input: DrawnActionInput,
): Beat[] {
  return upsertDrawnAction(beats, beatIndex, input);
}

function isMovementType(type: ActionType): boolean {
  return type === "cut" || type === "dribble" || type === "screen";
}

/**
 * Chain one player's movements end-to-start, and set their destination from the last.
 *
 * A second movement is a *continuation*: a screener who rolls starts from the screen,
 * and a player who cuts twice starts the second cut where the first finished. Both were
 * being stored starting from `startPos`, so the player snapped back to their original
 * spot before the second leg.
 *
 * Only the first point moves. The route the coach drew and the destination they picked
 * are theirs; this just reconnects the start to where the player actually is.
 *
 * Called after every add and every removal, so deleting the first of two movements
 * re-anchors the second to `startPos` rather than leaving it starting in mid-air.
 */
function chainPlayerMovements(beat: Beat, playerId: PlayerId): void {
  const movements = beat.actions.filter(
    (a) => a.by === playerId && isMovementType(a.type),
  );

  if (!movements.length) {
    beat.pos[playerId] = { ...beat.startPos[playerId] };
    return;
  }

  let anchor: Vec = { ...beat.startPos[playerId] };
  for (const movement of movements) {
    if (movement.path && movement.path.length >= 2) {
      movement.path[0] = { ...anchor };
      anchor = { ...movement.path[movement.path.length - 1] };
    }
  }
  beat.pos[playerId] = { ...anchor };
}

/** Possession at beat end, from startBall and whatever transfers remain, in order. */
function recomputeBeatBall(beat: Beat): void {
  let holder = beat.startBall;
  for (const a of beat.actions) {
    if ((a.type === "pass" || a.type === "handoff") && a.for) holder = a.for;
  }
  beat.ball = holder;
}

export function removeAction(
  beats: Beat[],
  beatIndex: number,
  actionId: string,
): Beat[] {
  const next = cloneBeats(beats);
  const beat = next[beatIndex];
  const removed = beat.actions.find((a) => a.id === actionId);
  beat.actions = beat.actions.filter((a) => a.id !== actionId);

  // Deleting a pass has to give possession back. Without this the beat keeps a ball
  // that arrived by no visible means, and rules 3 and 4 fail on a play the coach
  // thinks they just cleaned up.
  if (removed && (removed.type === "pass" || removed.type === "handoff")) {
    recomputeBeatBall(beat);
  }

  // Deleting a movement undoes the travel it explained. With others left, the rest
  // re-chain from startPos; with none, the player goes back where they started.
  if (removed && isMovementType(removed.type)) {
    chainPlayerMovements(beat, removed.by);
  }

  return linkBeatBall(next);
}

export function confirmAction(
  beats: Beat[],
  beatIndex: number,
  actionId: string,
): Beat[] {
  const next = cloneBeats(beats);
  const action = next[beatIndex].actions.find((a) => a.id === actionId);
  if (!action) return next;
  delete action.derived;
  delete action.needsReview;
  delete action.reason;
  return next;
}

export function confirmPlayActions(play: Play): Play {
  const beats = play.beats.map((beat) => ({
    ...beat,
    actions: beat.actions.map((a) => {
      // Destructured only to drop the review flags from `rest`.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { derived, needsReview, reason, ...rest } = a;
      return rest;
    }),
  }));
  return {
    ...play,
    beats,
    updatedAt: new Date().toISOString(),
  };
}

export function isValidDraw(input: DrawnActionInput): boolean {
  if (pathLength(input.path) < 12) return false;
  if ((input.type === "pass" || input.type === "handoff" || input.type === "screen") && !input.for) {
    return false;
  }
  if (input.type === "pass" || input.type === "handoff") {
    if (input.by === input.for) return false;
  }
  if (input.type === "screen" && input.by === input.for) return false;
  return true;
}
