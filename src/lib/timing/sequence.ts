import type { Action, Beat } from "@/lib/play/types";
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

  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const passerMove = timed.find((a) => a.by === pass.by && isMovement(a));
    if (passerMove) {
      pass.startAt = Math.max(pass.startAt, passerMove.endAt);
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

/** Derive startAt/endAt for every action on a beat. Coach never sets timing. */
export function sequenceBeat(beat: Beat): TimedAction[] {
  const actions = beat.actions ?? [];
  const timed: TimedAction[] = actions.map((action) => {
    const kind = classifyAction(action, actions);
    const [startAt, endAt] = defaultLane(kind);
    return cloneTimed(action, startAt, endAt);
  });

  applyDependencies(timed, actions);
  normalizeEndAtOne(timed);

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

/** First movement only — for summaries like the /dev/animator beat table. */
export function movementActionForPlayer(
  timed: TimedAction[],
  playerId: string,
): TimedAction | null {
  return movementActionsForPlayer(timed, playerId)[0] ?? null;
}

export { classifyAction, isMovement };
