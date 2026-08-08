"use client";

import PlayAnimator from "@/components/PlayAnimator";
import { playAnimatorDuration } from "@/lib/animation";

/** Quiz playback — sequential steps, arrows, holds. */
export default function QuizSequentialCourt({
  play,
  frames,
  fromBeat = 0,
  startBeatIdx,
  stopBeatIdx = null,
  speed = 1,
  onReady,
  highlightPlayer = null,
  active = true,
}) {
  const list = frames ?? play?.frames ?? [];
  const last = Math.max(0, list.length - 1);
  const to = stopBeatIdx ?? last;
  const from = Math.max(0, Math.min(startBeatIdx ?? fromBeat ?? 0, to));

  return (
    <PlayAnimator
      play={{ ...play, frames: list }}
      from={from}
      to={to}
      playing={active}
      speed={speed}
      highlightPlayer={highlightPlayer}
      onComplete={onReady}
    />
  );
}

export function sequentialTimelineDuration(frames, stopBeatIdx, startBeatIdx = 0, speed = 1) {
  return playAnimatorDuration(frames ?? [], startBeatIdx ?? 0, stopBeatIdx ?? 0, speed);
}

export { playerHasBallFromState } from "@/hooks/useSequentialPlayback";
