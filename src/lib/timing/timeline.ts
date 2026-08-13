import type { Play } from "@/lib/play/types";
import { HOLD_MS } from "./constants";
import { beatDurationMs } from "./beatDuration";
import { positionsAt } from "./positionsAt";
import type { TimelineFrame } from "./types";

export function beatRangeDurationMs(play: Play, from: number, to: number): number {
  if (!play?.beats?.length) return 0;
  const start = Math.max(0, Math.min(from, play.beats.length - 1));
  const end = Math.max(start, Math.min(to, play.beats.length - 1));
  let total = 0;
  for (let i = start; i <= end; i++) {
    total += beatDurationMs(play.beats[i]) + HOLD_MS;
  }
  return total;
}

export function resolveTimelineFrame(
  play: Play,
  from: number,
  to: number,
  elapsedMs: number,
  speed: number,
): TimelineFrame {
  const beats = play?.beats ?? [];
  if (!beats.length) {
    return { beatIndex: 0, phase: "hold", t: 0, done: true };
  }

  const start = Math.max(0, Math.min(from, beats.length - 1));
  const end = Math.max(start, Math.min(to, beats.length - 1));
  const effective = elapsedMs * speed;
  let cursor = 0;

  for (let i = start; i <= end; i++) {
    const moveMs = beatDurationMs(beats[i]);
    if (effective < cursor + moveMs) {
      const t = moveMs === 0 ? 1 : (effective - cursor) / moveMs;
      return { beatIndex: i, phase: "move", t, done: false };
    }
    cursor += moveMs;

    if (effective < cursor + HOLD_MS) {
      return { beatIndex: i, phase: "hold", t: 0, done: false };
    }
    cursor += HOLD_MS;
  }

  return { beatIndex: end, phase: "hold", t: 1, done: true };
}

export function snapshotAtElapsed(
  play: Play,
  from: number,
  to: number,
  elapsedMs: number,
  speed: number,
) {
  const frame = resolveTimelineFrame(play, from, to, elapsedMs, speed);
  const snap = positionsAt(play, frame.beatIndex, frame.t, frame.phase);
  return { frame, snap };
}

export { positionsAt };
