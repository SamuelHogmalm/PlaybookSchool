"use client";

import { useState, useRef, useEffect } from "react";
import {
  COURT_MAX_W,
  IDS,
  CourtSurface,
  Token,
  ActionLayer,
  MovementArrows,
  FlyingBall,
} from "@/app/court/Court";
import { beatEndPositions, beatStartPositions } from "@/lib/playModel";
import { getPlaybackState, playerHasBall, SPEED_OPTIONS, timelineDuration } from "@/lib/playback";

/** Read-only court + RUN PLAY — paper theme by default */
export default function PlayPlayback({ play, theme = "paper" }) {
  const paper = theme === "paper";
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [idx, setIdx] = useState(0);
  const raf = useRef(null);

  const frames = play.frames;
  const totalMs = timelineDuration(frames, speed);
  const inPlayback = playing || elapsedMs > 0;
  const playback = inPlayback ? getPlaybackState(frames, elapsedMs, speed) : null;
  const frame = frames[idx];
  const prev = idx > 0 ? frames[idx - 1] : null;
  const next = idx < frames.length - 1 ? frames[idx + 1] : null;
  const shown = playback || frame;
  const captionNote = playback?.note ?? frame?.note;
  const layerFrame = playback ? frames[playback.beatIdx] : frame;
  const layerPrev = playback && playback.beatIdx > 0 ? frames[playback.beatIdx - 1] : prev;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      setElapsedMs((prevMs) => {
        const nextMs = prevMs + dt;
        if (nextMs >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return nextMs;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, totalMs]);

  return (
    <div>
      <div
        className={`overflow-hidden border w-full mx-auto ${COURT_MAX_W} ${paper ? "ps-court-frame border-rule" : "rounded-lg"}`}
      >
        <CourtSurface suffix="-review" theme={theme}>
          {!inPlayback && next?.pos && (
            <MovementArrows
              prev={frame}
              frame={next}
              suffix="-review-next"
              fromPositions={frame.pos}
              toPositions={next.pos}
            />
          )}
          {layerPrev && inPlayback && (
            <MovementArrows
              prev={layerPrev}
              frame={layerFrame}
              suffix="-review-play"
              fromPositions={beatStartPositions(layerPrev, layerFrame)}
              toPositions={beatEndPositions(layerPrev, layerFrame)}
            />
          )}
          {!inPlayback && <ActionLayer frame={frame} prev={prev} suffix="-review" />}
          {layerPrev && inPlayback && (
            <ActionLayer frame={layerFrame} prev={layerPrev} suffix="-review-play" />
          )}
          {playback?.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
          {IDS.map((id) => (
            <Token key={id} id={id} p={shown.pos[id]} hasBall={playerHasBall(playback, frame, id)} />
          ))}
        </CourtSurface>
      </div>

      {captionNote && inPlayback && (
        <p className={`mt-2 text-sm leading-snug px-1 ${paper ? "text-ink-soft" : ""}`}>
          <span className={`text-xs mr-2 ${paper ? "font-data text-jersey" : "font-mono"}`}>
            BEAT {(playback?.beatIdx ?? 0) + 1}
          </span>
          {captionNote}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (elapsedMs >= totalMs) setElapsedMs(0);
              setPlaying(true);
            }
          }}
          className={paper ? "ps-btn ps-btn-primary py-0 min-h-[36px] text-xs" : "px-3 py-2 rounded text-xs font-semibold"}
        >
          {playing ? "STOP" : "RUN PLAY"}
        </button>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={paper ? `ps-editor-beat-btn ${speed === s ? "is-active" : ""}` : "px-2 py-1 rounded text-xs font-mono"}
          >
            {s}x
          </button>
        ))}
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setPlaying(false);
              setIdx(i);
              setElapsedMs(0);
            }}
            className={paper ? `ps-editor-beat-btn ${i === idx && !inPlayback ? "is-active" : ""}` : "px-2 py-1 rounded text-xs font-mono"}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(totalMs, 1)}
        step={16}
        value={Math.min(elapsedMs, totalMs)}
        onChange={(e) => {
          setPlaying(false);
          setElapsedMs(Number(e.target.value));
        }}
        className="w-full max-w-md mt-2 h-1 cursor-pointer"
        style={{ accentColor: paper ? "var(--jersey)" : undefined }}
      />
    </div>
  );
}
