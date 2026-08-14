"use client";

import { useRef } from "react";

import { PlayAnimator } from "@/components/animator";
import { COURT_HEIGHT, COURT_WIDTH } from "@/lib/court";
import { clientToCourt } from "@/lib/play/editor";
import type { Play, PlayerId, Vec } from "@/lib/play/types";

type Props = {
  play: Play;
  from: number;
  to: number | null;
  playing: boolean;
  hidePlayer?: PlayerId | null;
  onComplete?: () => void;
  /** Set to accept taps — the spot question's answer input. */
  onPick?: (at: Vec) => void;
  /** Where the player tapped, drawn once they have answered. */
  guess?: Vec | null;
  /** The correct spot, drawn during reveal and result. */
  answer?: Vec | null;
  /** Remount key: changing this restarts playback from `from`. */
  runKey: string;
};

/**
 * The court during a quiz: the shared animator, plus an overlay for answering.
 *
 * The overlay is a sibling SVG rather than something inside `AnimatorCourt`, so the
 * animator stays the single animator and knows nothing about quizzes.
 */
export function QuizCourt({
  play,
  from,
  to,
  playing,
  hidePlayer = null,
  onComplete,
  onPick,
  guess = null,
  answer = null,
  runKey,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent) => {
    if (!onPick) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    onPick(clientToCourt(e.clientX, e.clientY, rect as DOMRect));
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-[400px]">
      <PlayAnimator
        key={runKey}
        play={play}
        from={from}
        to={to}
        playing={playing}
        hidePlayer={hidePlayer}
        onComplete={onComplete}
      />

      <svg
        viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
        className={`absolute inset-0 h-full w-full touch-none select-none ${
          onPick ? "cursor-crosshair" : "pointer-events-none"
        }`}
        onPointerDown={handlePointer}
        role={onPick ? "button" : "presentation"}
        aria-label={onPick ? "Tap the court to answer" : undefined}
      >
        {guess && (
          <g>
            <circle
              cx={guess.x}
              cy={guess.y}
              r="13"
              fill="none"
              stroke="#e8560f"
              strokeWidth="3"
            />
            <circle cx={guess.x} cy={guess.y} r="3" fill="#e8560f" />
          </g>
        )}

        {answer && (
          <g>
            <circle
              cx={answer.x}
              cy={answer.y}
              r="17"
              fill="none"
              stroke="#2e8b57"
              strokeWidth="3"
              strokeDasharray="5 4"
            />
            <circle cx={answer.x} cy={answer.y} r="3.5" fill="#2e8b57" />
          </g>
        )}

        {guess && answer && (
          <line
            x1={guess.x}
            y1={guess.y}
            x2={answer.x}
            y2={answer.y}
            stroke="#a8a29e"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
        )}
      </svg>
    </div>
  );
}
