import type { Beat } from "@/lib/play/types";
import { BEAT_BASE_MS, BEAT_MAX_MS, BEAT_PER_ACTION_MS } from "./constants";
import { stepDurationsMs } from "./sequence";

/**
 * How long a beat's move phase lasts.
 *
 * With steps, it is the sum of the real time each one takes. Without them — an imported
 * play nobody has broken up yet — it falls back to a count-based estimate, because
 * lane-timed actions overlap and their durations do not simply add up.
 */
export function beatDurationMs(beat: Beat): number {
  const perStep = stepDurationsMs(beat);
  if (perStep.length) {
    return Math.round(perStep.reduce((total, ms) => total + ms, 0));
  }

  const n = beat.actions?.length ?? 0;
  const extra = Math.max(0, n - 1) * BEAT_PER_ACTION_MS;
  return Math.min(BEAT_MAX_MS, BEAT_BASE_MS + extra);
}
