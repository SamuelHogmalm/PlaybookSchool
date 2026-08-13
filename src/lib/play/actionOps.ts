import type { Action, ActionType, Beat, Play, PlayerId, Vec } from "./types";
import { cloneBeats, linkBeatBall, linkBeatPositions } from "./beatOps";
import { pathLength, simplifyPath } from "./drawing";

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function nextActionId(actions: Action[]): string {
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

/** Add a coach-drawn action; updates pos and ball as needed. */
export function addDrawnAction(
  beats: Beat[],
  beatIndex: number,
  input: DrawnActionInput,
): Beat[] {
  const next = cloneBeats(beats);
  const beat = next[beatIndex];
  // Simplify on the way in, so what the animator samples for motion and what the
  // builder renders are the same points. Endpoints survive RDP unchanged.
  const path = simplifyPath(copyPath(input.path));
  const action: Action = {
    id: nextActionId(beat.actions),
    type: input.type,
    by: input.by,
    path,
  };
  if (input.for) action.for = input.for;

  const end = path[path.length - 1];

  if (input.type === "cut" || input.type === "dribble" || input.type === "screen") {
    beat.pos[input.by] = { ...end };
  }

  if ((input.type === "pass" || input.type === "handoff") && input.for) {
    beat.ball = input.for;
  }

  beat.actions = [...beat.actions, action];
  // Relink rather than patching the next beat's startPos: later beats where this
  // player was holding need to follow them, not just inherit a new start point.
  return linkBeatBall(linkBeatPositions(next));
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

  // Deleting the movement that carried a player there also undoes the travel,
  // otherwise they keep a destination with nothing to explain it.
  if (
    removed &&
    (removed.type === "cut" ||
      removed.type === "dribble" ||
      removed.type === "screen") &&
    !beat.actions.some(
      (a) =>
        a.by === removed.by &&
        (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
    )
  ) {
    beat.pos[removed.by] = { ...beat.startPos[removed.by] };
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
