"use client";

import { useMemo, useState } from "react";

import { QuizRunner } from "@/components/quiz";
import { normalizeSeedPlay } from "@/lib/play/normalize";
import { validatePlay } from "@/lib/play/validation";
import type { Play, SeedPlay } from "@/lib/play/types";
import { buildSession, generateForPlays } from "@/lib/quiz";
import seedPlays from "@/data/plays-interpreted.json";

/** Validate once at module load — never quiz on a play that does not validate. */
const PLAYS: Play[] = (seedPlays as SeedPlay[]).map((raw) => {
  const play = normalizeSeedPlay(raw);
  const result = validatePlay(play);
  return { ...play, valid: result.valid, validationErrors: result.errors };
});

const POOL = generateForPlays(PLAYS.filter((p) => p.valid));

/** Quiz playback runs slower than the builder preview — this is for learning, not review. */
const SPEEDS = [
  { label: "Slow", value: 0.5 },
  { label: "Normal", value: 0.75 },
  { label: "Fast", value: 1 },
];

export default function PlayerQuizPage() {
  // Bumping the seed reshuffles into a different session.
  const [seed, setSeed] = useState(1);
  const [runId, setRunId] = useState(0);
  const [speed, setSpeed] = useState(0.5);

  const playsById = useMemo(
    () => new Map(PLAYS.map((p) => [p.id, p])),
    [],
  );
  const questions = useMemo(() => buildSession(POOL, { seed }), [seed]);

  return (
    /*
     * The app's default body background is light (`--paper`). Every dark surface has to
     * set its own, or near-white text lands on near-white paper and disappears.
     */
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Today&rsquo;s session</h1>
          <p className="text-sm text-stone-400">
            {PLAYS.filter((p) => p.valid).length} plays · {POOL.length} questions
            available · {questions.length} in this session
          </p>
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

        <QuizRunner
          key={`${seed}-${runId}`}
          questions={questions}
          playsById={playsById}
          speed={speed}
        />

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
