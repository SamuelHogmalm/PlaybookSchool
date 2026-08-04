"use client";

import { useState, useRef, useEffect } from "react";
import {
  C,
  COURT_MAX_W,
  IDS,
  CourtSurface,
  Token,
  ActionLayer,
  FlyingBall,
} from "@/app/court/Court";
import { getPlaybackState, playerHasBall, SPEED_OPTIONS, timelineDuration } from "@/lib/playback";

/** Read-only court + RUN PLAY for review screen */
export default function PlayPlayback({ play }) {
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
  const shown = playback || frame;
  const captionNote = playback?.note ?? frame?.note;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      setElapsedMs((prevMs) => {
        const next = prevMs + dt;
        if (next >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, totalMs]);

  return (
    <div>
      <div className={`rounded-lg overflow-hidden border w-full mx-auto ${COURT_MAX_W}`} style={{ borderColor: C.line, background: C.wood }}>
        <CourtSurface suffix="-review">
          {!inPlayback && prev && (
            <g opacity="0.22">
              {IDS.map((id) =>
                prev.pos[id] ? (
                  <circle key={id} cx={prev.pos[id].x} cy={prev.pos[id].y} r="15" fill="none" stroke={C.muted} strokeWidth="1.5" strokeDasharray="3 3" />
                ) : null
              )}
            </g>
          )}
          {!inPlayback && <ActionLayer frame={frame} prev={prev} suffix="-review" />}
          {playback?.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
          {IDS.map((id) => (
            <Token key={id} id={id} p={shown.pos[id]} hasBall={playerHasBall(playback, frame, id)} />
          ))}
        </CourtSurface>
      </div>

      {captionNote && inPlayback && (
        <p className="mt-2 text-sm leading-snug px-1" style={{ color: C.text }}>
          <span className="text-xs font-mono mr-2" style={{ color: C.ball }}>BEAT {(playback?.beatIdx ?? 0) + 1}</span>
          {captionNote}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (elapsedMs >= totalMs) setElapsedMs(0);
              setPlaying(true);
            }
          }}
          className="px-3 py-2 rounded text-xs font-semibold"
          style={{ background: playing ? C.panel2 : C.ball, color: playing ? C.text : "#0E1116" }}
        >
          {playing ? "STOP" : "RUN PLAY"}
        </button>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{
              background: speed === s ? C.panel2 : "transparent",
              border: `1px solid ${speed === s ? C.ball : C.line}`,
              color: speed === s ? C.text : C.muted,
            }}
          >
            {s}x
          </button>
        ))}
        {frames.map((f, i) => (
          <button
            key={f.id}
            onClick={() => { setPlaying(false); setIdx(i); setElapsedMs(0); }}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{
              background: i === idx && !inPlayback ? C.panel2 : "transparent",
              border: `1px solid ${i === idx && !inPlayback ? C.ball : C.line}`,
              color: i === idx && !inPlayback ? C.text : C.muted,
            }}
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
        onChange={(e) => { setPlaying(false); setElapsedMs(Number(e.target.value)); }}
        className="w-full max-w-md mt-2 h-1 cursor-pointer"
        style={{ accentColor: C.ball }}
      />
    </div>
  );
}
