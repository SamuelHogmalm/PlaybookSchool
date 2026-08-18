"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CourtRenderer } from "@/components/court";
import { loadPlays, type LoadedPlays } from "@/lib/play/loadPlays";
import { describeSaveFailure, OFFLINE_FAILURE, type SaveFailure } from "@/lib/play/saveErrors";
import { reviewPlay } from "@/lib/review";
import type { Play } from "@/lib/play/types";

export default function CoachPlaybookPage() {
  const [loaded, setLoaded] = useState<LoadedPlays | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadPlays().then(setLoaded);
  }, []);

  useEffect(refresh, [refresh]);

  const remove = async (play: Play) => {
    setBusy(play.id);
    setFailure(null);
    try {
      const res = await fetch(`/api/plays/${encodeURIComponent(play.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFailure(describeSaveFailure(res.status, body));
        return;
      }
      setConfirming(null);
      refresh();
    } catch {
      setFailure(OFFLINE_FAILURE);
    } finally {
      setBusy(null);
    }
  };

  const saved = loaded?.source === "team";
  const plays = loaded?.plays ?? [];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Your playbook</h1>
            <p className="text-sm text-stone-400">
              {!loaded
                ? "Loading…"
                : saved
                  ? `${plays.length} play${plays.length === 1 ? "" : "s"} saved to your team.`
                  : "Nothing saved yet — showing the imported playbook below."}
            </p>
          </div>
          <Link
            href="/plays/new"
            className="rounded border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40"
          >
            New play
          </Link>
        </header>

        {loaded && !saved && (
          <p className="rounded-md border border-amber-700 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
            These are the imported plays, not your team&rsquo;s. The quiz falls back to
            them while your playbook is empty — save one play and it will use only yours.
          </p>
        )}

        {failure && (
          <div
            role="alert"
            className={`rounded-md border px-4 py-3 text-sm ${
              failure.tone === "warn"
                ? "border-amber-700 bg-amber-950/30 text-amber-100"
                : "border-red-800 bg-red-950/30 text-red-100"
            }`}
          >
            <p className="font-medium">{failure.title}</p>
            <p className="mt-1 opacity-90">{failure.detail}</p>
          </div>
        )}

        <ul className="grid gap-4 sm:grid-cols-2">
          {plays.map((play) => {
            const review = reviewPlay(play);
            const flags = review.flagged.length;
            return (
              <li
                key={play.id}
                className="space-y-2 rounded-md border border-stone-700 bg-stone-900/40 p-3"
              >
                <CourtRenderer
                  beat={play.beats[0]}
                  framed={false}
                  width="100%"
                  markerSuffix={`pb-${play.id}`}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-medium">{play.name}</h2>
                  <span className="text-xs text-stone-500">v{play.version}</span>
                </div>
                <p className="text-xs text-stone-400">
                  {play.beats.length} beats · {review.totalActions} actions
                  {play.valid ? "" : " · does not validate"}
                  {flags ? ` · ${flags} to check` : ""}
                </p>

                {confirming === play.id ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-red-200">Delete {play.name}?</span>
                    <button
                      type="button"
                      onClick={() => remove(play)}
                      disabled={busy === play.id}
                      className="rounded border border-red-700 px-3 py-1 text-red-200 hover:bg-red-950/40 disabled:opacity-40"
                    >
                      {busy === play.id ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded border border-stone-600 px-3 py-1 hover:bg-stone-800"
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Link
                      href="/coach/review"
                      className="rounded border border-stone-600 px-3 py-1 hover:bg-stone-800"
                    >
                      Review &amp; edit
                    </Link>
                    {saved && (
                      <button
                        type="button"
                        onClick={() => setConfirming(play.id)}
                        className="rounded border border-stone-700 px-3 py-1 text-stone-400 hover:bg-stone-800 hover:text-red-200"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {loaded && !plays.length && (
          <p className="text-sm text-stone-400">
            No plays yet. <Link href="/plays/new" className="underline">Draw one</Link>.
          </p>
        )}

        <footer className="flex gap-3 border-t border-stone-800 pt-4 text-sm">
          <Link href="/coach/review" className="text-stone-400 underline-offset-4 hover:underline">
            Review the playbook
          </Link>
          <Link href="/player/quiz" className="text-stone-400 underline-offset-4 hover:underline">
            Take a quiz
          </Link>
        </footer>
      </div>
    </main>
  );
}
