"use client";

import type { PlayerId, Play } from "@/lib/play/types";

import { AnimatorCourt } from "./AnimatorCourt";
import { usePlayPlayback } from "./usePlayPlayback";

export type PlayAnimatorProps = {
  play: Play;
  from?: number;
  to?: number | null;
  playing?: boolean;
  stepMode?: boolean;
  hidePlayer?: PlayerId | null;
  speed?: number;
  onBeatEnd?: (beatIndex: number) => void;
  onComplete?: () => void;
};

/**
 * Single play animator — one rAF loop, no quiz state.
 * Remount for full reset: key={play.id}
 */
export function PlayAnimator({
  play,
  from = 0,
  to = null,
  playing = false,
  stepMode = false,
  hidePlayer = null,
  speed = 1,
  onBeatEnd,
  onComplete,
}: PlayAnimatorProps) {
  const { snap } = usePlayPlayback({
    play,
    from,
    to,
    playing,
    stepMode,
    speed,
    onBeatEnd,
    onComplete,
  });

  return (
    <AnimatorCourt
      snapshot={snap}
      hidePlayer={hidePlayer}
      markerSuffix={`anim-${play.id}`}
    />
  );
}

export { usePlayPlayback } from "./usePlayPlayback";
