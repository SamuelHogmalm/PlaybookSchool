export type {
  Phase,
  PositionsSnapshot,
  SequencedBeat,
  TimelineFrame,
  TimedAction,
} from "./types";

export {
  BEAT_BASE_MS,
  BEAT_MAX_MS,
  BEAT_PER_ACTION_MS,
  HOLD_MS,
  PASS_SPEED_MULTIPLIER,
} from "./constants";

export { beatDurationMs } from "./beatDuration";
export {
  classifyAction,
  isMovement,
  movementActionForPlayer,
  sequenceBeat,
} from "./sequence";
export {
  actionArcProgress,
  buildActionRoute,
  routeRemaining,
} from "./routeRemaining";
export {
  passTravelDistance,
  playerPosAtT,
  positionsAt,
  validateSnapshot,
} from "./positionsAt";
export {
  beatRangeDurationMs,
  resolveTimelineFrame,
  snapshotAtElapsed,
} from "./timeline";

export {
  easeInOutCut,
  easeInOutDribble,
  easeInRoll,
  easeOutScreen,
  linear,
} from "./easing";
export { lerpVec, polylineLength, samplePolyline } from "./pathSample";
