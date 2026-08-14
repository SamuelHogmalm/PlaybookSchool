import type { Beat } from "@/lib/play/types";
import {
  BEAT_BASE_MS,
  BEAT_MAX_MS,
  BEAT_PER_ACTION_MS,
} from "./constants";
import { beatSteps } from "./sequence";

/**
 * 2250ms base + 500ms per unit beyond the first, capped at 4400ms.
 *
 * The unit is a *step* where the beat has steps, and an action otherwise. Two players
 * cutting together is one thing to watch and should not cost the same as two things
 * happening in turn.
 */
export function beatDurationMs(beat: Beat): number {
  const steps = beatSteps(beat);
  const n = steps.length || beat.actions?.length || 0;
  const extra = Math.max(0, n - 1) * BEAT_PER_ACTION_MS;
  return Math.min(BEAT_MAX_MS, BEAT_BASE_MS + extra);
}
