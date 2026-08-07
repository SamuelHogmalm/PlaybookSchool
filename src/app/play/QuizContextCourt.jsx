"use client";

import { useEffect, useState } from "react";
import { CourtSurface, Token, IDS } from "@/app/court/Court";
import QuizSequentialCourt from "@/app/play/QuizSequentialCourt";

/** Pins the quiz taker at their spot before the question is asked. */
export default function QuizContextCourt({
  frame,
  playerId,
  myId,
  label = "You're here",
  play = null,
  frameIdx = null,
  onAnimReady,
}) {
  const focusId = playerId ?? myId;
  const shouldAnimate = play?.frames?.length && frameIdx != null && frameIdx >= 2;
  const lastBeatIdx = frameIdx != null ? frameIdx - 1 : null;
  const [animDone, setAnimDone] = useState(!shouldAnimate);

  useEffect(() => {
    setAnimDone(!shouldAnimate);
  }, [shouldAnimate, frameIdx, play]);

  useEffect(() => {
    if (shouldAnimate && !animDone) return;
    onAnimReady?.();
  }, [shouldAnimate, animDone, onAnimReady]);

  if (!frame) return null;

  if (shouldAnimate && !animDone && lastBeatIdx != null) {
    return (
      <QuizSequentialCourt
        play={play}
        fromBeat={0}
        stopBeatIdx={lastBeatIdx}
        highlightPlayer={focusId}
        onReady={() => setAnimDone(true)}
      />
    );
  }

  const here = frame.pos?.[focusId];

  return (
    <CourtSurface suffix="-ctx" theme="paper">
      {IDS.map((id) => {
        const p = frame.pos?.[id];
        if (!p) return null;
        return (
          <Token
            key={id}
            id={id}
            p={p}
            hasBall={frame.ball === id}
            focus={id === focusId}
            faded={id !== focusId}
          />
        );
      })}
      {here && (
        <>
          <circle
            cx={here.x}
            cy={here.y}
            r="18"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="5 4"
            opacity="0.85"
          />
          <text
            x={here.x}
            y={here.y - 26}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#22c55e"
          >
            {label}
          </text>
        </>
      )}
    </CourtSurface>
  );
}
