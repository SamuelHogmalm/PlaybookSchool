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

  /** Identity of the current run. Changing any part of it restarts playback. */
  const runKey = `${play.id}|${fromBeat}|${toBeat}|${speed}`;

  // Elapsed time is stored with the run it belongs to, so switching plays resets it
  // during render rather than in an effect that would render the stale frame first.
  const [run, setRun] = useState({ key: runKey, elapsedMs: 0 });
  if (run.key !== runKey) setRun({ key: runKey, elapsedMs: 0 });
  const elapsedMs = run.key === runKey ? run.elapsedMs : 0;

  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const lastHoldBeatRef = useRef<number | null>(null);
  const onBeatEndRef = useRef(onBeatEnd);
  const onCompleteRef = useRef(onComplete);

  // Latest-callback refs, written after render: a render can be thrown away and
  // replayed, and a ref written during one would keep the discarded value.
  useEffect(() => {
    onBeatEndRef.current = onBeatEnd;
    onCompleteRef.current = onComplete;
  });

  // Declared before the frame loop so the refs are zeroed before it restarts.
  useEffect(() => {
    elapsedRef.current = 0;
    pausedRef.current = false;
    lastHoldBeatRef.current = null;
  }, [runKey]);

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
      setRun({ key: runKey, elapsedMs: next });

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
  }, [playing, totalMs, play, fromBeat, toBeat, speed, stepMode, runKey]);

  const { frame, snap } = snapshotAtElapsed(
    play,
    fromBeat,
    toBeat,
    elapsedMs,
    speed,
  );

  const reset = () => {
    elapsedRef.current = 0;
    setRun({ key: runKey, elapsedMs: 0 });
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
