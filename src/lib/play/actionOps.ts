import type { Action, ActionType, Beat, Play, PlayerId, Vec } from "./types";
import { cloneBeats, linkBeatBall } from "./beatOps";
import { pathLength } from "./drawing";

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
  const path = copyPath(input.path);
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
    if (beatIndex + 1 < next.length) {
      next[beatIndex + 1].startPos[input.by] = { ...end };
    }
  }

  if ((input.type === "pass" || input.type === "handoff") && input.for) {
    beat.ball = input.for;
  }

  beat.actions = [...beat.actions, action];
  return linkBeatBall(next);
}

export function removeAction(
  beats: Beat[],
  beatIndex: number,
  actionId: string,
): Beat[] {
  const next = cloneBeats(beats);
  next[beatIndex].actions = next[beatIndex].actions.filter((a) => a.id !== actionId);
  return next;
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
