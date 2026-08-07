"use client";

import QuizSequentialCourt from "@/app/play/QuizSequentialCourt";
import { QUIZ_FULL_PLAY_SPEED } from "@/lib/quiz";

/**
 * Auto-plays a full play once (continuous sequential animation), then signals ready.
 */
export default function QuizPlayClip({
  play,
  onReady,
  speed = QUIZ_FULL_PLAY_SPEED,
  highlightPlayer = null,
}) {
  const lastBeat = Math.max(0, (play.frames?.length ?? 1) - 1);

  return (
    <QuizSequentialCourt
      play={play}
      stopBeatIdx={lastBeat}
      onReady={onReady}
      speed={speed}
      highlightPlayer={highlightPlayer}
      statusLabel="One move at a time…"
    />
  );
}
