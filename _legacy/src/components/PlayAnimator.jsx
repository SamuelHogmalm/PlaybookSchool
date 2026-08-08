"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnimatorCourt from "@/components/AnimatorCourt";
import {
  getPlayAnimatorState,
  playAnimatorDuration,
} from "@/lib/animation";

/**
 * Unified play animator — sequential steps, disappearing arrows, hold on each beat.
 * Remount for full reset: key={question.id}
 */
export default function PlayAnimator({
  play,
  from = 0,
  to = null,
  playing = false,
  stepMode = false,
  stepToken = 0,
  hidePlayer = null,
  highlightPlayer = null,
  onComplete,
  onStepPause,
  onTick,
  speed = 1,
}) {
  const frames = play?.frames ?? [];
  const toBeat = to ?? Math.max(0, frames.length - 1);
  const fromBeat = Math.max(0, Math.min(from, frames.length - 1));
  const safeTo = Math.max(fromBeat, Math.min(toBeat, frames.length - 1));

  const totalMs = useMemo(
    () => playAnimatorDuration(frames, fromBeat, safeTo, speed),
    [frames, fromBeat, safeTo, speed],
  );

  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const onStepPauseRef = useRef(onStepPause);
  const onTickRef = useRef(onTick);
  onCompleteRef.current = onComplete;
  onStepPauseRef.current = onStepPause;
  onTickRef.current = onTick;

  useEffect(() => {
    setElapsedMs(0);
    elapsedRef.current = 0;
    setPaused(false);
    pausedRef.current = false;
  }, [play, fromBeat, safeTo, speed]);

  useEffect(() => {
    if (stepMode) {
      setPaused(false);
      pausedRef.current = false;
    }
  }, [stepToken, stepMode]);

  useEffect(() => {
    if (!playing) return;

    let last = performance.now();
    let raf;

    const step = (now) => {
      if (pausedRef.current) {
        last = now;
        raf = requestAnimationFrame(step);
        return;
      }

      const dt = now - last;
      last = now;
      const next = Math.min(totalMs, elapsedRef.current + dt);
      elapsedRef.current = next;
      setElapsedMs(next);
      onTickRef.current?.(
        next,
        getPlayAnimatorState(frames, fromBeat, safeTo, next, speed),
      );

      if (stepMode && next < totalMs) {
        const snap = getPlayAnimatorState(frames, fromBeat, safeTo, next, speed);
        if (snap.phase === "hold" && next > 0) {
          pausedRef.current = true;
          setPaused(true);
          onStepPauseRef.current?.(snap);
        }
      }

      if (next >= totalMs) {
        onCompleteRef.current?.();
        return;
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs, frames, fromBeat, safeTo, speed, stepMode]);

  const state = getPlayAnimatorState(frames, fromBeat, safeTo, elapsedMs, speed);

  const courtState = {
    pos: state.pos ?? {},
    ball: state.ball,
    ballCarrier: state.ballCarrier ?? state.ball,
    ballInAir: state.ballInAir,
    activeRoute: state.activeRoute,
    activeRoutes: state.activeRoutes ?? [],
    caption: state.caption,
    beatIdx: state.beatIdx,
    phase: state.phase,
    inTransition: state.inTransition,
  };

  return (
    <div className="relative">
      <AnimatorCourt state={courtState} hidePlayer={hidePlayer} highlightPlayer={highlightPlayer} />
      {state.caption && state.phase === "hold" && (
        <p className="text-xs text-center mt-2 px-2 text-ink-soft font-data leading-snug">
          {state.caption}
        </p>
      )}
    </div>
  );
}
