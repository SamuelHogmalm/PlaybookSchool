"use client";

import { useEffect, useRef, useState } from "react";
import {
  CourtSurface,
  Token,
  ActionLayer,
  MovementArrows,
  FlyingBall,
  IDS,
} from "@/app/court/Court";
import { beatEndPositions, beatStartPositions } from "@/lib/playModel";
import { getPlaybackState, playerHasBall, timelineDuration } from "@/lib/playback";
import { QUIZ_FULL_PLAY_SPEED } from "@/lib/quiz";

/**
 * Auto-plays a full play once, then signals ready for the question.
 */
export default function QuizPlayClip({ play, onReady, speed = QUIZ_FULL_PLAY_SPEED, loop = false }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const totalMs = timelineDuration(play.frames, speed);
  const targetMs = totalMs * 0.96;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    setElapsedMs(0);
    setDone(false);
    let last = performance.now();
    let raf;

    const step = (now) => {
      const dt = now - last;
      last = now;
      setElapsedMs((prev) => {
        const next = prev + dt;
        if (next >= targetMs) {
          setDone(true);
          onReadyRef.current?.();
          return loop ? next % totalMs : targetMs;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [play, targetMs, totalMs, loop]);

  const playback = getPlaybackState(play.frames, Math.min(elapsedMs, totalMs), speed);
  if (!playback) return null;

  const beatIdx = playback.beatIdx;
  const frame = play.frames[beatIdx];
  const prev = beatIdx > 0 ? play.frames[beatIdx - 1] : null;
  const layerFrame = playback.inTransition && prev ? play.frames[beatIdx] : frame;
  const layerPrev = playback.inTransition ? prev : beatIdx > 0 ? play.frames[beatIdx - 1] : null;

  return (
    <div className="relative">
      <CourtSurface suffix="-clip" theme="paper">
        {layerPrev && playback.inTransition && (
          <>
            <MovementArrows
              prev={layerPrev}
              frame={layerFrame}
              suffix="-clip"
              fromPositions={beatStartPositions(layerPrev, layerFrame)}
              toPositions={beatEndPositions(layerPrev, layerFrame)}
            />
            <ActionLayer frame={layerFrame} prev={layerPrev} suffix="-clip" />
          </>
        )}
        {!playback.inTransition && prev && (
          <ActionLayer frame={frame} prev={prev} suffix="-clip-idle" />
        )}
        {playback.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
        {IDS.map((id) => (
          <Token
            key={id}
            id={id}
            p={playback.pos[id]}
            hasBall={playerHasBall(playback, frame, id)}
          />
        ))}
      </CourtSurface>
      {!done && (
        <p className="font-data text-[10px] uppercase tracking-widest text-jersey text-center mt-2">
          Watch the play…
        </p>
      )}
    </div>
  );
}
