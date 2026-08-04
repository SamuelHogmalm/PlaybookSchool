"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enrichPlayFromImport } from "@/lib/enrichReview";
import PlayReview from "@/app/play/PlayReview";
import { useImportSession } from "../ImportContext";

export default function ImportReviewListPage() {
  const router = useRouter();
  const { session, setSession } = useImportSession();
  const [selected, setSelected] = useState(null);
  const [verified, setVerified] = useState({});

  useEffect(() => {
    if (!session?.plays?.length) router.replace("/import");
  }, [session, router]);

  const plays = useMemo(
    () => (session?.plays ?? []).map(enrichPlayFromImport).sort((a, b) => a.name.localeCompare(b.name)),
    [session]
  );

  if (!session?.plays?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  if (selected != null) {
    const play = plays[selected];
    return (
      <PlayReview
        play={{ ...play, verified: !!verified[play.name] }}
        crops={session.crops}
        backLabel="← All plays"
        onBack={() => setSelected(null)}
        onPlayChange={(updated) => {
          setSession((s) => ({
            ...s,
            plays: s.plays.map((p) => (p.name === updated.name ? updated : p)),
          }));
        }}
        showCropCompare={Object.keys(session.crops ?? {}).length > 0}
        theme="paper"
      />
    );
  }

  const verifiedCount = Object.values(verified).filter(Boolean).length;
  const reviewCount = session.needsReview?.length ?? 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-0.5">Review queue</p>
        <h1 className="font-display text-xl font-bold truncate">{session.filename}</h1>
        <p className="text-sm text-ink-soft mt-1">
          {plays.length} plays · {session.meta?.beat_count} beats
          {session.aiUsed && session.usage && (
            <> · AI tokens {session.usage.input_tokens + session.usage.output_tokens}</>
          )}
          {reviewCount > 0 && <span className="text-flag"> · {reviewCount} beats flagged</span>}
        </p>
        <p className="font-data text-xs text-go mt-2">{verifiedCount} of {plays.length} verified</p>
        <Link href="/import" className="text-xs text-chalk mt-2 inline-block hover:underline">← Import another</Link>
      </header>

      <ul className="flex-1 overflow-auto p-4 max-w-3xl w-full mx-auto flex flex-col gap-2">
        {plays.map((p, i) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => setSelected(i)}
              className="w-full text-left border border-rule px-4 py-3 flex items-center justify-between gap-3 bg-paper hover:bg-paper-2 transition-colors duration-[120ms]"
            >
              <div>
                <span className="font-display font-semibold">{p.name}</span>
                <span className="font-data text-xs ml-2 text-ink-soft">{p.frames.length} beats</span>
              </div>
              <span className={`text-xs shrink-0 font-data ${verified[p.name] ? "text-go" : "text-ink-soft"}`}>
                {verified[p.name] ? "✓ verified" : "Review →"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-center max-w-md mx-auto p-4 text-ink-soft">
        Edit lines and player spots inline, then verify. Changes stay in this session until you import again.
      </p>
    </div>
  );
}
