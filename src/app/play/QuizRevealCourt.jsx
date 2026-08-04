"use client";

import { useEffect, useRef, useState } from "react";
import {
  C,
  CourtSurface,
  Token,
  ActionLayer,
  MovementArrows,
  FlyingBall,
  IDS,
} from "@/app/court/Court";
import {
  getBeatTransitionState,
  playerHasBall,
  QUIZ_REVEAL_HOLD_MS,
  QUIZ_REVEAL_TRANS_MS,
} from "@/lib/playback";

/**
 * Plays one beat transition on the court after a quiz answer.
 * Right or wrong — always shows what should happen.
 */
export default function QuizRevealCourt({
  play,
  fromIdx,
  toIdx,
  active,
  result,
  highlightPlayer,
  wrongSpot,
  correctSpot,
  onFinished,
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const prev = play.frames[fromIdx];
  const next = play.frames[toIdx];

  useEffect(() => {
    if (!active || !prev || !next) {
      setElapsedMs(0);
      return;
    }

    setElapsedMs(0);
    let elapsed = 0;
    let last = performance.now();
    let raf;
    let finished = false;

    const step = (now) => {
      elapsed += now - last;
      last = now;
      setElapsedMs(elapsed);

      const state = getBeatTransitionState(prev, next, elapsed, {
        holdMs: QUIZ_REVEAL_HOLD_MS,
        transMs: QUIZ_REVEAL_TRANS_MS,
      });

      if (state.done) {
        if (!finished) {
          finished = true;
          onFinishedRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, fromIdx, toIdx, prev, next]);

  if (!prev || !next) return null;

  const playback = getBeatTransitionState(prev, next, elapsedMs, {
    holdMs: QUIZ_REVEAL_HOLD_MS,
    transMs: QUIZ_REVEAL_TRANS_MS,
  });

  const border = result === true ? C.ok : result === false ? C.bad : C.line;

  return (
    <div
      className="rounded-lg overflow-hidden border w-full"
      style={{ borderColor: border, boxShadow: `0 0 0 1px ${border}44` }}
    >
      <CourtSurface suffix="-quiz">
        <g opacity="0.2">
          {IDS.map((id) => (
            <circle
              key={id}
              cx={prev.pos[id].x}
              cy={prev.pos[id].y}
              r="15"
              fill="none"
              stroke={C.muted}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          ))}
        </g>
        <MovementArrows
          prev={prev}
          frame={next}
          suffix="-quiz"
          highlightPlayer={highlightPlayer}
          dimOthers={!!highlightPlayer}
        />
        <ActionLayer frame={next} prev={prev} suffix="-quiz" />
        {wrongSpot && result === false && (
          <g opacity="0.85">
            <circle cx={wrongSpot.x} cy={wrongSpot.y} r="18" fill="none" stroke={C.bad} strokeWidth="2.5" strokeDasharray="5 4" />
            <line x1={wrongSpot.x - 10} y1={wrongSpot.y - 10} x2={wrongSpot.x + 10} y2={wrongSpot.y + 10} stroke={C.bad} strokeWidth="2" />
            <line x1={wrongSpot.x + 10} y1={wrongSpot.y - 10} x2={wrongSpot.x - 10} y2={wrongSpot.y + 10} stroke={C.bad} strokeWidth="2" />
          </g>
        )}
        {correctSpot && (
          <circle cx={correctSpot.x} cy={correctSpot.y} r="18" fill="none" stroke={C.ok} strokeWidth="2.5" opacity={playback.done ? 1 : 0.6} />
        )}
        {playback.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
        {IDS.map((id) => (
          <Token
            key={id}
            id={id}
            p={playback.pos[id]}
            hasBall={playerHasBall(playback, next, id)}
            highlight={highlightPlayer === id}
          />
        ))}
      </CourtSurface>
    </div>
  );
}

export function questionBeatRange(q, frameCount) {
  if (q.frameIdx != null && q.frameIdx > 0) {
    return { fromIdx: q.frameIdx - 1, toIdx: q.frameIdx };
  }
  const toIdx = Math.min(1, frameCount - 1);
  return { fromIdx: 0, toIdx };
}
