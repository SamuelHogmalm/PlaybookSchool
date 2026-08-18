"use client";

import { useEffect, useState } from "react";

import { ReviewFlow } from "@/components/review";
import { loadPlays, type LoadedPlays } from "@/lib/play/loadPlays";

export default function CoachReviewPage() {
  const [loaded, setLoaded] = useState<LoadedPlays | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPlays().then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Review the playbook</h1>
          <p className="text-sm text-stone-400">
            The source diagram on the left, what we read on the right. Worst play first.
            Confirming a play clears its flags and saves it to your team&rsquo;s playbook.
          </p>
          {loaded?.note && <p className="text-sm text-amber-300">{loaded.note}</p>}
          {loaded?.source === "team" && (
            <p className="text-sm text-stone-500">
              Showing your team&rsquo;s saved plays. Source diagrams only exist for plays
              that came from the import.
            </p>
          )}
        </header>

        {loaded ? (
          <ReviewFlow plays={loaded.plays} />
        ) : (
          <p className="text-sm text-stone-400">Loading your playbook…</p>
        )}
      </div>
    </main>
  );
}
