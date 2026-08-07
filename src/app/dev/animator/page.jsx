"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayAnimator from "@/components/PlayAnimator";
import { allPlays, heroPlay } from "@/lib/plays";
import { clampBeatIndex } from "@/lib/playInterpolation";
import { getPlayAnimatorState } from "@/lib/animation";
import {
  debugPlayerRowsFromActions,
  formatAllBeatLines,
  PLAYER_IDS,
} from "@/lib/animation/deriveActions";

const SPEEDS = [0.5, 0.75, 1, 1.5];

export default function AnimatorDevPage() {
  const [playName, setPlayName] = useState(heroPlay.name);
  const [fromBeat, setFromBeat] = useState(0);
  const [toBeat, setToBeat] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [hidePlayer, setHidePlayer] = useState("");
  const [playing, setPlaying] = useState(false);
  const [stepMode, setStepMode] = useState(true);
  const [stepToken, setStepToken] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const play = allPlays.find((p) => p.name === playName) ?? heroPlay;
  const frameCount = play.frames?.length ?? 0;
  const maxBeat = Math.max(0, frameCount - 1);
  const safeFrom = clampBeatIndex(play.frames, fromBeat);
  const safeTo = toBeat == null ? maxBeat : clampBeatIndex(play.frames, toBeat);

  const derivations = useMemo(() => formatAllBeatLines(play), [play]);

  const liveState = useMemo(() => {
    const snap = getPlayAnimatorState(play.frames, safeFrom, safeTo, elapsedMs, speed);
    return {
      ...snap,
      players: snap.pos,
      beatIndex: snap.beatIdx,
      possession: snap.ballCarrier ?? snap.ball,
    };
  }, [play, safeFrom, safeTo, elapsedMs, speed]);

  const playerRows = debugPlayerRowsFromActions(play, liveState.beatIdx ?? 0);

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setRunKey((k) => k + 1);
    setElapsedMs(0);
    setPlaying(true);
  };

  const handleAdvance = () => {
    setStepToken((t) => t + 1);
  };

  return (
    <div className="min-h-screen bg-paper text-ink p-4 max-w-2xl mx-auto">
      <header className="mb-4">
        <Link href="/coach/playbook" className="text-sm text-chalk">
          ← Playbook
        </Link>
        <h1 className="font-display text-xl font-bold mt-2">PlayAnimator debug</h1>
        <p className="text-sm text-ink-soft mt-1">
          Sequential <span className="font-data">PlayAnimator</span> — verify actions and timing before quiz wiring.
        </p>
      </header>

      <div className="grid gap-3 mb-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-data text-xs uppercase text-ink-soft">Play</span>
          <select
            className="ps-input"
            value={playName}
            onChange={(e) => {
              setPlayName(e.target.value);
              setFromBeat(0);
              setToBeat(null);
              setPlaying(false);
              setElapsedMs(0);
            }}
          >
            {allPlays.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-data text-xs uppercase text-ink-soft">From beat ({safeFrom})</span>
          <input
            type="range"
            min={0}
            max={maxBeat}
            value={safeFrom}
            onChange={(e) => {
              setFromBeat(Number(e.target.value));
              setPlaying(false);
              setElapsedMs(0);
            }}
            className="w-full"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-data text-xs uppercase text-ink-soft">To beat ({safeTo})</span>
          <input
            type="range"
            min={0}
            max={maxBeat}
            value={safeTo}
            onChange={(e) => {
              setToBeat(Number(e.target.value));
              setPlaying(false);
              setElapsedMs(0);
            }}
            className="w-full"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-data text-xs uppercase text-ink-soft">Speed</span>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`font-data px-3 py-2 border min-h-[44px] text-sm ${
                  speed === s ? "border-jersey text-jersey" : "border-rule"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-data text-xs uppercase text-ink-soft">Hide player</span>
          <select
            className="ps-input"
            value={hidePlayer}
            onChange={(e) => setHidePlayer(e.target.value)}
          >
            <option value="">None</option>
            {PLAYER_IDS.map((id) => (
              <option key={id} value={id}>
                Player {id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={stepMode}
            onChange={(e) => setStepMode(e.target.checked)}
          />
          Step mode (pause after each MOVE / HOLD)
        </label>

        <div className="flex gap-2 sm:col-span-2">
          <button type="button" onClick={handlePlayPause} className="ps-btn ps-btn-primary flex-1 min-h-[44px]">
            {playing ? "Pause" : "Play"}
          </button>
          {stepMode && (
            <button type="button" onClick={handleAdvance} className="ps-btn flex-1 min-h-[44px]">
              Advance step
            </button>
          )}
        </div>
      </div>

      <div className="ps-court-frame border border-rule mb-4">
        <PlayAnimator
          key={`${play.name}-${runKey}-${safeFrom}-${safeTo}-${speed}`}
          play={play}
          from={safeFrom}
          to={safeTo}
          playing={playing}
          stepMode={stepMode}
          stepToken={stepToken}
          hidePlayer={hidePlayer || undefined}
          speed={speed}
          onComplete={() => setPlaying(false)}
          onTick={(ms, snap) => {
            setElapsedMs(ms);
          }}
        />
      </div>

      <div className="font-data text-xs border border-rule p-3 mb-4 bg-panel space-y-1">
        <p>
          <strong>Live:</strong> beat {liveState.beatIdx ?? liveState.beatIndex} · phase {liveState.phase}
        </p>
        <p>
          <strong>Ball:</strong> carrier {liveState.possession ?? liveState.ballCarrier ?? "—"}
          {liveState.ballInAir ? " · IN AIR" : ""}
        </p>
        {liveState.caption && (
          <p>
            <strong>Caption:</strong> {liveState.caption}
          </p>
        )}
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs font-data border border-rule">
          <thead>
            <tr className="bg-panel text-left">
              <th className="p-2 border-b border-rule">#</th>
              <th className="p-2 border-b border-rule">x,y</th>
              <th className="p-2 border-b border-rule">moving</th>
              <th className="p-2 border-b border-rule">derived</th>
            </tr>
          </thead>
          <tbody>
            {playerRows.map((row) => (
              <tr key={row.id}>
                <td className="p-2 border-b border-rule">{row.id}</td>
                <td className="p-2 border-b border-rule">
                  {row.x != null ? `${row.x}, ${row.y}` : "—"}
                </td>
                <td className="p-2 border-b border-rule">{row.moving ? "yes" : "no"}</td>
                <td className="p-2 border-b border-rule">
                  {row.action}
                  {row.screenFor ? ` for ${row.screenFor}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="font-display text-sm font-bold mb-2">Derived actions (all beats)</h2>
        <pre className="text-xs font-data bg-panel border border-rule p-3 overflow-x-auto whitespace-pre-wrap">
          {derivations.join("\n")}
        </pre>
      </section>
    </div>
  );
}
