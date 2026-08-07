"use client";

import QuizSequentialCourt from "@/app/play/QuizSequentialCourt";
import { QUIZ_WATCH_SPEED } from "@/lib/quiz";

/**
 * Plays the play from the start through prior beats — one motion at a time, no beat resets.
 */
export default function QuizWatchCourt({
  play,
  watchStopBeat = 0,
  onReady,
  speed = QUIZ_WATCH_SPEED,
  beatRecap = false,
  highlightPlayer = null,
}) {
  return (
    <QuizSequentialCourt
      play={play}
      stopBeatIdx={watchStopBeat}
      onReady={onReady}
      speed={speed}
      highlightPlayer={highlightPlayer}
      statusLabel={
        beatRecap
          ? `Playing through beat ${watchStopBeat + 1}…`
          : "One move at a time…"
      }
    />
  );
}
