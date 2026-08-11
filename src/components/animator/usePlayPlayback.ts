"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Play } from "@/lib/play/types";
import {
  beatRangeDurationMs,
  resolveTimelineFrame,
  snapshotAtElapsed,
} from "@/lib/timing";

type Options = {
  play: Play;
  from?: number;
  to?: number | null;
  playing?: boolean;
  stepMode?: boolean;
  speed?: number;
  onBeatEnd?: (beatIndex: number) => void;
  onComplete?: () => void;
};

export function usePlayPlayback({
  play,
  from = 0,
  to = null,
  playing = false,
  stepMode = false,
  speed = 1,
  onBeatEnd,
  onComplete,
}: Options) {
  const beats = play?.beats ?? [];
  const fromBeat = Math.max(0, Math.min(from, Math.max(0, beats.length - 1)));
  const toBeat = Math.max(
    fromBeat,
    Math.min(to ?? Math.max(0, beats.length - 1), Math.max(0, beats.length - 1)),
  );

  const totalMs = useMemo(
    () => beatRangeDurationMs(play, fromBeat, toBeat),
    [play, fromBeat, toBeat],
  );

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const lastHoldBeatRef = useRef<number | null>(null);
  const onBeatEndRef = useRef(onBeatEnd);
  const onCompleteRef = useRef(onComplete);
  onBeatEndRef.current = onBeatEnd;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    elapsedRef.current = 0;
    setElapsedMs(0);
    pausedRef.current = false;
    lastHoldBeatRef.current = null;
  }, [play.id, fromBeat, toBeat, speed]);

  useEffect(() => {
    if (stepMode && playing) pausedRef.current = false;
  }, [playing, stepMode]);

  useEffect(() => {
    if (!playing) return;

    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      if (pausedRef.current) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      const dt = now - last;
      last = now;
      const next = Math.min(totalMs, elapsedRef.current + dt);
      elapsedRef.current = next;
      setElapsedMs(next);

      const frame = resolveTimelineFrame(play, fromBeat, toBeat, next, speed);

      if (
        stepMode &&
        frame.phase === "hold" &&
        next > 0 &&
        lastHoldBeatRef.current !== frame.beatIndex
      ) {
        lastHoldBeatRef.current = frame.beatIndex;
        pausedRef.current = true;
        onBeatEndRef.current?.(frame.beatIndex);
      }

      if (next >= totalMs) {
        onCompleteRef.current?.();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs, play, fromBeat, toBeat, speed, stepMode]);

  const { frame, snap } = snapshotAtElapsed(
    play,
    fromBeat,
    toBeat,
    elapsedMs,
    speed,
  );

  const reset = () => {
    elapsedRef.current = 0;
    setElapsedMs(0);
    pausedRef.current = false;
    lastHoldBeatRef.current = null;
  };

  const resume = () => {
    pausedRef.current = false;
  };

  return {
    elapsedMs,
    totalMs,
    frame,
    snap,
    fromBeat,
    toBeat,
    reset,
    resume,
  };
}
