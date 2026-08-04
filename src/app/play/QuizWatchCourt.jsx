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
import { getPlaybackState, playerHasBall } from "@/lib/playback";
import { watchPlaybackTargetMs, QUIZ_WATCH_SPEED } from "@/lib/quiz";

/**
 * Plays the play from the start up to watchStopBeat, then pauses for the question.
 */
export default function QuizWatchCourt({ play, watchStopBeat = 0, onReady, speed = QUIZ_WATCH_SPEED }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const targetMs = watchPlaybackTargetMs(play.frames, watchStopBeat, speed);
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
          return targetMs;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [play, watchStopBeat, targetMs, speed]);

  const playback = getPlaybackState(play.frames, elapsedMs, speed);
  if (!playback) return null;

  const beatIdx = playback.beatIdx;
  const frame = play.frames[beatIdx];
  const prev = beatIdx > 0 ? play.frames[beatIdx - 1] : null;
  const layerFrame = playback.inTransition && prev ? play.frames[beatIdx] : frame;
  const layerPrev = playback.inTransition ? prev : beatIdx > 0 ? play.frames[beatIdx - 1] : null;

  return (
    <div className="relative">
      <CourtSurface suffix="-watch" theme="paper">
        {layerPrev && playback.inTransition && (
          <MovementArrows prev={layerPrev} frame={layerFrame} suffix="-watch" />
        )}
        {layerPrev && playback.inTransition && (
          <ActionLayer frame={layerFrame} prev={layerPrev} suffix="-watch" />
        )}
        {!playback.inTransition && prev && (
          <ActionLayer frame={frame} prev={prev} suffix="-watch-idle" />
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
