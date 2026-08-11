import type { Action, Beat, PlayerId, Vec } from "@/lib/play/types";
import type { CourtPalette } from "./palette";

export type ActionEndpoints = {
  route: Vec[];
  from: Vec;
  to: Vec;
  /** Receiver or screen target — end-of-beat position. */
  target?: Vec;
};

export type ActionDrawStyle = {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  dashArray?: string;
  markerEnd?: "cut" | "ball";
};

function routeFrom(
  beat: Beat,
  action: Action,
  end: Vec,
  startOverride?: Vec,
): Vec[] {
  if (action.path && action.path.length >= 2) return action.path;
  const start = startOverride ?? beat.startPos[action.by];
  if (!start) return [];
  return [start, end];
}

/** Resolve drawable endpoints for one action on a beat (startPos → pos semantics). */
export function resolveActionEndpoints(
  beat: Beat,
  action: Action,
): ActionEndpoints | null {
  const by = action.by;
  const start = beat.startPos[by];
  if (!start) return null;

  if (action.type === "pass") {
    const forId = action.for;
    if (!forId) return null;
    const receiverEnd = beat.pos[forId];
    if (!receiverEnd) return null;
    const route = routeFrom(beat, action, receiverEnd);
    if (route.length < 2) return null;
    return {
      route,
      from: route[0],
      to: route[route.length - 1],
      target: receiverEnd,
    };
  }

  if (action.type === "handoff") {
    const forId = action.for;
    if (!forId) return null;
    const meet = action.path?.length
      ? action.path[action.path.length - 1]
      : beat.pos[by];
    const receiver = beat.pos[forId];
    if (!meet || !receiver) return null;
    const route = routeFrom(beat, action, meet);
    if (route.length < 2) return null;
    return {
      route,
      from: route[0],
      to: meet,
      target: receiver,
    };
  }

  if (action.type === "screen") {
    const forId = action.for;
    const end = action.path?.length
      ? action.path[action.path.length - 1]
      : beat.pos[by];
    if (!end) return null;
    const target = forId ? beat.pos[forId] : undefined;
    const route = routeFrom(beat, action, end);
    if (route.length < 2) return null;
    return { route, from: route[0], to: end, target };
  }

  const end = action.path?.length
    ? action.path[action.path.length - 1]
    : beat.pos[by];
  if (!end) return null;
  const route = routeFrom(beat, action, end);
  if (route.length < 2) return null;
  return { route, from: route[0], to: end };
}

export function isMutedAction(action: Action): boolean {
  return Boolean(action.derived || action.needsReview);
}

export function actionDrawStyle(
  action: Action,
  palette: CourtPalette,
  highlighted: boolean,
): ActionDrawStyle {
  if (highlighted) {
    return {
      stroke: palette.highlight,
      strokeWidth: 3.5,
      opacity: 1,
      markerEnd:
        action.type === "pass" || action.type === "dribble" ? "ball" : "cut",
    };
  }

  const muted = isMutedAction(action);
  const baseWidth = muted ? 1.25 : 2;
  const opacity = muted ? 0.42 : 0.92;

  switch (action.type) {
    case "pass":
      return {
        stroke: palette.ball,
        strokeWidth: baseWidth,
        opacity,
        dashArray: "8 6",
        markerEnd: "ball",
      };
    case "dribble":
      return {
        stroke: palette.ball,
        strokeWidth: baseWidth,
        opacity,
        markerEnd: "ball",
      };
    case "screen":
      return {
        stroke: palette.screen,
        strokeWidth: muted ? 1.5 : 2,
        opacity,
      };
    case "handoff":
      return {
        stroke: palette.cut,
        strokeWidth: baseWidth,
        opacity,
        dashArray: "4 4",
      };
    case "cut":
    default:
      return {
        stroke: palette.cut,
        strokeWidth: baseWidth,
        opacity,
        markerEnd: "cut",
      };
  }
}

export function tokenStroke(
  playerId: PlayerId,
  hasBall: boolean,
  palette: CourtPalette,
  highlighted: boolean,
): { fill: string; stroke: string; strokeWidth: number } {
  return {
    fill: palette.panel2,
    stroke: highlighted
      ? palette.ok
      : hasBall
        ? palette.ball
        : palette.muted,
    strokeWidth: hasBall ? 3 : highlighted ? 2.5 : 2,
  };
}
