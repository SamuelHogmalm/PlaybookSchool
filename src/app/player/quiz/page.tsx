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

export default function PlayerQuizPage() {
  // Bumping the seed reshuffles into a different session.
  const [seed, setSeed] = useState(1);
  const [runId, setRunId] = useState(0);

  const playsById = useMemo(
    () => new Map(PLAYS.map((p) => [p.id, p])),
    [],
  );
  const questions = useMemo(() => buildSession(POOL, { seed }), [seed]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 text-stone-100">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Today&rsquo;s session</h1>
        <p className="text-sm text-stone-400">
          {PLAYS.filter((p) => p.valid).length} plays · {POOL.length} questions
          available · {questions.length} in this session
        </p>
      </header>

      <QuizRunner
        key={`${seed}-${runId}`}
        questions={questions}
        playsById={playsById}
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
    </main>
  );
}
