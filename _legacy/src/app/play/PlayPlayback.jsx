"use client";

import { useMemo, useState } from "react";
import {
  COURT_MAX_W,
  CourtSurface,
  Token,
  FlyingBall,
  IDS,
} from "@/app/court/Court";
import { SPEED_OPTIONS } from "@/lib/playback";
import ActiveRouteLayer from "@/app/play/ActiveRouteLayer";
import {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
} from "@/lib/sequentialPlayback";
import { playerHasBallFromState, useSequentialPlayback } from "@/hooks/useSequentialPlayback";

/** Read-only court + RUN PLAY — beat-by-beat sequential animation */
export default function PlayPlayback({ play, theme = "paper" }) {
  const paper = theme === "paper";
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [idx, setIdx] = useState(0);

  const frames = play.frames;
  const timeline = useMemo(() => buildSequentialTimeline(frames), [frames]);
  const totalMs = sequentialTimelineDuration(timeline, speed);
  const { elapsedMs, setElapsedMs, state: playback } = useSequentialPlayback(frames, {
    speed,
    playing,
    onBeatChange: setIdx,
    onDone: () => setPlaying(false),
  });

  const inPlayback = playing || elapsedMs > 0;
  const frame = frames[idx];
  const shown = inPlayback ? playback : frame;
  const captionNote = inPlayback ? playback?.note : null;

  return (
    <div>
      <div
        className={`overflow-hidden border w-full mx-auto ${COURT_MAX_W} ${paper ? "ps-court-frame border-rule" : "rounded-lg"}`}
      >
        <CourtSurface suffix="-review" theme={theme}>
          {inPlayback ? (
            <>
              <ActiveRouteLayer activeRoutes={playback.activeRoutes ?? []} suffix="-review" />
              {playback?.ballInAir && (
                <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />
              )}
            </>
          ) : null}
          {IDS.map((id) => (
            <Token
              key={id}
              id={id}
              p={shown?.pos?.[id] ?? frame?.pos?.[id]}
              hasBall={
                inPlayback
                  ? playerHasBallFromState(playback, id)
                  : frame?.ball === id
              }
            />
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

export { playerHasBallFromState };
