"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
} from "@/lib/sequentialPlayback";

export function playerHasBallFromState(state, playerId) {
  if (state?.ballInAir) return false;
  return (state?.ballCarrier ?? state?.ball) === playerId;
}

/**
 * Beat-by-beat sequential playback — one action at a time, pause between beats.
 * Used by play viewer, editor, and quiz.
 */
export function useSequentialPlayback(frames, options = {}) {
  const {
    speed = 1,
    stopBeatIdx = null,
    startBeatIdx = 1,
    playing = false,
    loop = false,
    resetKey = 0,
    onDone,
    onBeatChange,
  } = options;

  const timeline = useMemo(
    () => buildSequentialTimeline(frames, stopBeatIdx, startBeatIdx),
    [frames, stopBeatIdx, startBeatIdx],
  );
  const totalMs = sequentialTimelineDuration(timeline, speed);
  const [elapsedMs, setElapsedMs] = useState(0);
  const onDoneRef = useRef(onDone);
  const onBeatChangeRef = useRef(onBeatChange);
  onDoneRef.current = onDone;
  onBeatChangeRef.current = onBeatChange;

  useEffect(() => {
    setElapsedMs(0);
  }, [resetKey, frames, stopBeatIdx, startBeatIdx]);

  const state = getSequentialPlaybackState(timeline, elapsedMs * speed);

  useEffect(() => {
    if (state.beatIdx != null) onBeatChangeRef.current?.(state.beatIdx);
  }, [state.beatIdx]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf;
    const step = (now) => {
      const dt = now - last;
      last = now;
      setElapsedMs((prev) => {
        const next = prev + dt;
        if (next >= totalMs) {
          if (loop) return 0;
          onDoneRef.current?.();
          return totalMs;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs, loop]);

  return { state, timeline, totalMs, elapsedMs, setElapsedMs };
}

export { buildSequentialTimeline, sequentialTimelineDuration, getSequentialPlaybackState };
