import type { Beat } from "@/lib/play/types";
import {
  BEAT_BASE_MS,
  BEAT_MAX_MS,
  BEAT_PER_ACTION_MS,
} from "./constants";

/** 1800ms base + 400ms per action beyond the first, capped at 3500ms. */
export function beatDurationMs(beat: Beat): number {
  const n = beat.actions?.length ?? 0;
  const extra = Math.max(0, n - 1) * BEAT_PER_ACTION_MS;
  return Math.min(BEAT_MAX_MS, BEAT_BASE_MS + extra);
}
