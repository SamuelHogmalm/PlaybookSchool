/**
 * ANIMATION LAYER — public API
 *
 * Import playback ONLY from here. Do not import sequentialPlayback,
 * playAnimatorEngine, positionsAt, or playback.js directly in UI code.
 */

export {
  buildPlayAnimatorTimeline,
  getPlayAnimatorState,
  playAnimatorDuration,
} from "@/lib/playAnimatorEngine";

export {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
  routeRemainingAhead,
} from "@/lib/sequentialPlayback";

export {
  BEAT_DURATION_MS,
  BEAT_HOLD_MS,
  SPEED_OPTIONS,
  SEQ_ACTION_MS,
  SEQ_PASS_MS,
  SEQ_BEAT_HOLD_MS,
  QUIZ_SPEED,
} from "@/lib/animation/constants";
