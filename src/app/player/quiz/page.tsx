"use client";

import { useEffect, useMemo, useState } from "react";

import { QuizRunner } from "@/components/quiz";
import { loadPlays, type LoadedPlays } from "@/lib/play/loadPlays";
import { buildSession, generateForPlays } from "@/lib/quiz";

/** Quiz playback runs slower than the builder preview — this is for learning, not review. */
const SPEEDS = [
  { label: "Slow", value: 0.5 },
  { label: "Normal", value: 0.75 },
  { label: "Fast", value: 1 },
];

export default function PlayerQuizPage() {
  const [loaded, setLoaded] = useState<LoadedPlays | null>(null);
  // Bumping the seed reshuffles into a different session.
  const [seed, setSeed] = useState(1);
  const [runId, setRunId] = useState(0);
  const [speed, setSpeed] = useState(0.5);

  useEffect(() => {
    let cancelled = false;
    loadPlays().then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Memoised: a fresh [] each render would regenerate the whole question pool below
  // on every keystroke and speed change.
  const plays = useMemo(() => loaded?.plays ?? [], [loaded]);
  const valid = useMemo(() => plays.filter((p) => p.valid), [plays]);
  const playsById = useMemo(() => new Map(plays.map((p) => [p.id, p])), [plays]);
  const pool = useMemo(() => generateForPlays(valid), [valid]);
  const questions = useMemo(() => buildSession(pool, { seed }), [pool, seed]);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Today&rsquo;s session</h1>
          {loaded ? (
            <p className="text-sm text-stone-400">
              {valid.length} play{valid.length === 1 ? "" : "s"} ·{" "}
              {pool.length} questions available · {questions.length} in this session
              {loaded.source === "team" ? " · your team's playbook" : ""}
            </p>
          ) : (
            <p className="text-sm text-stone-400">Loading your playbook…</p>
          )}
          {loaded?.note && (
            <p className="text-sm text-amber-300">{loaded.note}</p>
          )}
          {loaded && plays.length > valid.length && (
            <p className="text-sm text-stone-500">
              {plays.length - valid.length} play
              {plays.length - valid.length === 1 ? "" : "s"} skipped — they don&rsquo;t
              validate yet, so nobody is quizzed on them.
            </p>
          )}
        </header>

        <div
          role="group"
          aria-label="Playback speed"
          className="flex items-center gap-2 text-sm"
        >
          <span className="text-stone-400">Speed</span>
          {SPEEDS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={speed === option.value}
              onClick={() => setSpeed(option.value)}
              className={`rounded border px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                speed === option.value
                  ? "border-amber-500 bg-amber-500/20 text-amber-100"
                  : "border-stone-600 text-stone-300 hover:bg-stone-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loaded && (
          <QuizRunner
            key={`${seed}-${runId}-${loaded.source}`}
            questions={questions}
            playsById={playsById}
            speed={speed}
          />
        )}

        <footer className="flex gap-2 border-t border-stone-800 pt-4">
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
          >
            Restart this session
          </button>
          <button
            type="button"
            onClick={() => {
              setSeed((s) => s + 1);
              setRunId((n) => n + 1);
            }}
            className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
          >
            New session
          </button>
        </footer>

        <p className="text-xs text-stone-600">
          Results are not saved yet — attempts and mastery land in Postgres next.
        </p>
      </div>
    </main>
  );
}
