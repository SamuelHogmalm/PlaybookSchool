"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/app/court/Court";
import { enrichPlayFromImport } from "@/lib/enrichReview";
import PlayReview from "@/app/play/PlayReview";
import { useImportSession } from "../ImportContext";

export default function ImportReviewListPage() {
  const router = useRouter();
  const { session } = useImportSession();
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>
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
      />
    );
  }

  const verifiedCount = Object.values(verified).filter(Boolean).length;
  const reviewCount = session.needsReview?.length ?? 0;

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: C.bg, color: C.text }}>
      <header className="mb-6 max-w-3xl mx-auto">
        <p className="text-xs font-mono mb-1" style={{ color: C.dim, letterSpacing: "0.12em" }}>REVIEW QUEUE</p>
        <h1 className="text-2xl font-bold">{session.filename}</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {plays.length} plays · {session.meta?.beat_count} beats
          {session.aiUsed && session.usage && (
            <> · AI tokens {session.usage.input_tokens + session.usage.output_tokens}</>
          )}
          {reviewCount > 0 && <span style={{ color: C.bad }}> · {reviewCount} beats flagged</span>}
        </p>
        <p className="text-xs mt-2" style={{ color: C.ok }}>{verifiedCount} of {plays.length} verified</p>
        <a href="/import" className="text-xs mt-2 inline-block" style={{ color: C.ball }}>← Import another</a>
      </header>

      <ul className="max-w-3xl mx-auto flex flex-col gap-2">
        {plays.map((p, i) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => setSelected(i)}
              className="w-full text-left rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: C.panel, border: `1px solid ${C.line}` }}
            >
              <div>
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs ml-2" style={{ color: C.muted }}>
                  {p.frames.length} beats
                </span>
              </div>
              <span className="text-xs shrink-0" style={{ color: verified[p.name] ? C.ok : C.dim }}>
                {verified[p.name] ? "✓ verified" : "Review →"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-center max-w-md mx-auto mt-8" style={{ color: C.dim }}>
        Edit lines and player spots on each play, then verify. Changes stay in this session until you import again.
      </p>
    </div>
  );
}
