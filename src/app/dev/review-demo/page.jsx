"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import interpretedPlays from "@/data/plays-interpreted.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { enrichPlayFromImport } from "@/lib/enrichReview";
import PlayReview from "@/app/play/PlayReview";
import { C } from "@/app/court/Court";

/** Pre-saved AI-interpreted plays — zero API calls, zero credits. */
function loadDemoPlays() {
  return interpretedPlays
    .map(normalizeImportedPlay)
    .map(enrichPlayFromImport)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function ReviewDemoPage() {
  const [selected, setSelected] = useState(null);
  const [plays, setPlays] = useState(loadDemoPlays);
  const [verified, setVerified] = useState({});

  const stats = useMemo(() => {
    const actions = plays.reduce(
      (n, p) => n + p.frames.reduce((m, f) => m + (f.actions?.length ?? 0), 0),
      0
    );
    const beats = plays.reduce((n, p) => n + p.frames.length, 0);
    return { actions, beats };
  }, [plays]);

  if (selected != null) {
    const play = plays[selected];
    return (
      <PlayReview
        play={{ ...play, verified: !!verified[play.name] }}
        crops={{}}
        backLabel="← Demo plays"
        onBack={() => setSelected(null)}
        onPlayChange={(updated) => {
          setPlays((prev) => prev.map((p) => (p.name === updated.name ? updated : p)));
        }}
        onVerified={() => setVerified((v) => ({ ...v, [play.name]: true }))}
        runLabel="RUN DEMO"
        showCropCompare={false}
      />
    );
  }

  const verifiedCount = Object.values(verified).filter(Boolean).length;

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: C.bg, color: C.text }}>
      <header className="mb-6 max-w-3xl mx-auto">
        <div
          className="rounded-lg px-3 py-2 mb-4 text-sm"
          style={{ background: "#1a2a1a", border: `1px solid ${C.ok}`, color: C.text }}
        >
          <strong style={{ color: C.ok }}>Demo mode</strong> — uses pre-saved interpreted plays from{" "}
          <code className="text-xs" style={{ color: C.muted }}>plays-interpreted.json</code>.
          No PDF upload, no AI API, no credits. Edit lines and movements with the same tools as real import review.
        </div>
        <p className="text-xs font-mono mb-1" style={{ color: C.dim, letterSpacing: "0.12em" }}>
          REVIEW DEMO
        </p>
        <h1 className="text-2xl font-bold">Practice reviewing a play</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {plays.length} plays · {stats.beats} beats · {stats.actions} AI-drawn actions (offline)
        </p>
        <p className="text-xs mt-2" style={{ color: C.ok }}>
          {verifiedCount} of {plays.length} verified this session
        </p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <Link href="/" style={{ color: C.ball }}>← Home</Link>
          <Link href="/import" style={{ color: C.muted }}>Real import →</Link>
          <Link href="/plays/new" style={{ color: C.muted }}>Create play →</Link>
        </div>
      </header>

      <ul className="max-w-3xl mx-auto flex flex-col gap-2">
        {plays.map((p, i) => {
          const actionCount = p.frames.reduce((n, f) => n + (f.actions?.length ?? 0), 0);
          return (
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
                    {p.frames.length} beats · {actionCount} lines
                  </span>
                </div>
                <span className="text-xs shrink-0" style={{ color: verified[p.name] ? C.ok : C.dim }}>
                  {verified[p.name] ? "✓ verified" : "Review →"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-center max-w-lg mx-auto mt-8" style={{ color: C.dim }}>
        Pick a play, fix AI lines with the draw editor, run the animation, and verify.
        Edits stay until you refresh the page.
      </p>
    </div>
  );
}
