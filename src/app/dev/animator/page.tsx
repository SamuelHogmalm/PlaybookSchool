"use client";

import { useCallback, useMemo, useState } from "react";

import { AnimatorCourt, usePlayPlayback } from "@/components/animator";
import { normalizeSeedPlay } from "@/lib/play/normalize";
import type { Play, PlayerId, SeedPlay } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import {
  beatDurationMs,
  movementActionsForPlayer,
  sequenceBeat,
} from "@/lib/timing";
import seedPlays from "@/data/plays-interpreted.json";

const PLAYS: Play[] = (seedPlays as SeedPlay[]).map((p) =>
  normalizeSeedPlay(p),
);

function formatVec(v: { x: number; y: number } | undefined): string {
  if (!v) return "—";
  return `${Math.round(v.x)}, ${Math.round(v.y)}`;
}

export default function DevAnimatorPage() {
  const [playId, setPlayId] = useState("conn");
  const [speed, setSpeed] = useState(1);
  const [stepMode, setStepMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [beatTableIndex, setBeatTableIndex] = useState(0);

  const play = useMemo(
    () => PLAYS.find((p) => p.id === playId) ?? PLAYS[0],
    [playId],
  );

  const toBeat = Math.max(0, play.beats.length - 1);

  const handleBeatEnd = useCallback((beatIndex: number) => {
    setPlaying(false);
    setBeatTableIndex(beatIndex);
  }, []);

  const handleComplete = useCallback(() => {
    setPlaying(false);
  }, []);

  const { elapsedMs, totalMs, frame, snap, reset, resume } = usePlayPlayback({
    play,
    from: 0,
    to: toBeat,
    playing,
    stepMode,
    speed,
    onBeatEnd: handleBeatEnd,
    onComplete: handleComplete,
  });

  const advanceStep = () => {
    resume();
    setPlaying(true);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 text-stone-100">
      <header>
        <h1 className="text-2xl font-semibold">Animator debug</h1>
        <p className="mt-1 text-sm text-stone-400">
          Phase 3 checkpoint — one{" "}
          <code className="text-stone-300">positionsAt()</code> drives everything
          below.
        </p>
      </header>

      <section className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Play
          <select
            value={playId}
            onChange={(e) => {
              setPlayId(e.target.value);
              setPlaying(false);
              reset();
            }}
            className="rounded border border-stone-600 bg-stone-900 px-3 py-1.5"
          >
            {PLAYS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded border border-stone-600 bg-stone-900 px-3 py-1.5"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </label>

        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={stepMode}
            onChange={(e) => setStepMode(e.target.checked)}
          />
          Step mode
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="rounded border border-emerald-700 px-4 py-1.5 text-sm hover:bg-emerald-950/40"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="rounded border border-stone-600 px-4 py-1.5 text-sm hover:bg-stone-800"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              reset();
            }}
            className="rounded border border-stone-600 px-4 py-1.5 text-sm hover:bg-stone-800"
          >
            Reset
          </button>
          {stepMode && (
            <button
              type="button"
              onClick={advanceStep}
              className="rounded border border-amber-700 px-4 py-1.5 text-sm hover:bg-amber-950/40"
            >
              Step
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-3">
          <AnimatorCourt
            snapshot={snap}
            play={play}
            beatIndex={frame.beatIndex}
            beatT={frame.t}
            phase={frame.phase}
            markerSuffix={`dev-${play.id}`}
          />

          <div className="rounded border border-stone-700 bg-stone-900/60 px-3 py-2 font-mono text-xs text-stone-300">
            <p>
              beat {frame.beatIndex + 1} · phase {frame.phase} · t=
              {frame.t.toFixed(3)}
            </p>
            <p>
              elapsed {Math.round(elapsedMs)} / {Math.round(totalMs)} ms
              {frame.done ? " · done" : ""}
            </p>
            {snap && (
              <p>
                possession P{snap.possession}
                {snap.ballInFlight ? " · ball in flight" : ""} · ball (
                {Math.round(snap.ball.x)}, {Math.round(snap.ball.y)})
              </p>
            )}
          </div>
        </div>

        <BeatTable play={play} beatIndex={beatTableIndex} onSelect={setBeatTableIndex} />
      </div>
    </main>
  );
}

function BeatTable({
  play,
  beatIndex,
  onSelect,
}: {
  play: Play;
  beatIndex: number;
  onSelect: (i: number) => void;
}) {
  const beat = play.beats[beatIndex];
  if (!beat) return null;

  const timed = sequenceBeat(beat);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {play.beats.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(i)}
            className={`rounded border px-3 py-1 text-sm ${
              i === beatIndex
                ? "border-amber-500 bg-amber-500/20"
                : "border-stone-600 hover:bg-stone-800"
            }`}
          >
            {b.id} ({beatDurationMs(b)}ms move)
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-stone-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-900/80 text-stone-400">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Timing</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
            </tr>
          </thead>
          <tbody>
            {PLAYER_IDS.map((id: PlayerId) => {
              // Every movement, in order — a screener who then rolls has two, and the
              // point of this table is to see that the second one is really there.
              const movements = movementActionsForPlayer(timed, id);
              const transfer = timed.find(
                (a) =>
                  (a.type === "pass" || a.type === "handoff") &&
                  (a.by === id || a.for === id),
              );
              const label = movements.length
                ? movements.map((m) => m.type).join(" → ")
                : transfer
                  ? `${transfer.type}${transfer.by === id ? " (by)" : " (recv)"}`
                  : "idle";
              const windows = movements.length
                ? movements
                    .map((m) => `${m.startAt.toFixed(2)}–${m.endAt.toFixed(2)}`)
                    .join(", ")
                : transfer
                  ? `${transfer.startAt.toFixed(2)}–${transfer.endAt.toFixed(2)}`
                  : "—";
              return (
                <tr key={id} className="border-t border-stone-800">
                  <td className="px-3 py-2 font-mono">{id}</td>
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2 font-mono text-stone-400">{windows}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatVec(beat.startPos[id])}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatVec(beat.pos[id])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1 text-xs text-stone-400">
        {timed.map((a) => (
          <li key={a.id}>
            {a.id} {a.type} P{a.by}
            {a.for ? `→P${a.for}` : ""}{" "}
            <span className="font-mono">
              [{a.startAt.toFixed(2)}, {a.endAt.toFixed(2)}]
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
