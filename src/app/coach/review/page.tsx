"use client";

import { ReviewFlow } from "@/components/review";
import { normalizeSeedPlay } from "@/lib/play/normalize";
import { validatePlay } from "@/lib/play/validation";
import type { Play, SeedPlay } from "@/lib/play/types";
import seedPlays from "@/data/plays-interpreted.json";

const PLAYS: Play[] = (seedPlays as SeedPlay[]).map((raw) => {
  const play = normalizeSeedPlay(raw);
  const result = validatePlay(play);
  return { ...play, valid: result.valid, validationErrors: result.errors };
});

export default function CoachReviewPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Review the import</h1>
          <p className="text-sm text-stone-400">
            The source diagram on the left, what we read on the right. Worst play first.
            Confirming a play clears its flags and saves it to your team&rsquo;s playbook.
          </p>
        </header>

        <ReviewFlow plays={PLAYS} />
      </div>
    </main>
  );
}
