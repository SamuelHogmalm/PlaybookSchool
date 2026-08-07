"use client";

import PlayAnimator from "@/components/PlayAnimator";

/** Reveal playback — runs from the question beat through the rest of the play. */
export default function QuizRevealCourt({
  play,
  fromIdx,
  toIdx,
  active,
  highlightPlayer,
  onFinished,
  speed = 1,
}) {
  const last = Math.max(0, (play?.frames?.length ?? 1) - 1);
  const from = Math.max(0, fromIdx ?? 0);
  const to = Math.max(from, toIdx ?? last, last);

  if (!play?.frames?.length) return null;

  return (
    <PlayAnimator
      play={play}
      from={from}
      to={to}
      playing={!!active}
      speed={speed}
      stepMode={false}
      highlightPlayer={highlightPlayer}
      onComplete={onFinished}
    />
  );
}

export { questionBeatRange } from "@/lib/quiz";
