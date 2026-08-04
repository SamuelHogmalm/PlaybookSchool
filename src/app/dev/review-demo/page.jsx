"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadAllPlays } from "@/lib/playData";
import PlayReview from "@/app/play/PlayReview";

function loadDemoPlays() {
  return loadAllPlays().sort((a, b) => a.name.localeCompare(b.name));
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
        theme="paper"
      />
    );
  }

  const verifiedCount = Object.values(verified).filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-go mb-0.5">Demo mode</p>
        <h1 className="font-display text-xl font-bold">Practice reviewing a play</h1>
        <p className="text-sm text-ink-soft mt-1">
          Pre-saved interpreted plays — no PDF upload or AI credits. Same editor as real import review.
        </p>
        <p className="text-sm text-ink-soft mt-1">
          {plays.length} plays · {stats.beats} beats · {stats.actions} drawn actions
        </p>
        <p className="font-data text-xs text-go mt-2">{verifiedCount} of {plays.length} verified</p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          <Link href="/import" className="text-chalk hover:underline">Real import →</Link>
          <Link href="/coach/playbook" className="text-ink-soft hover:text-ink">Playbook →</Link>
        </div>
      </header>

      <ul className="flex-1 overflow-auto p-4 max-w-3xl w-full mx-auto flex flex-col gap-2">
        {plays.map((p, i) => {
          const actionCount = p.frames.reduce((n, f) => n + (f.actions?.length ?? 0), 0);
          return (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                className="w-full text-left border border-rule px-4 py-3 flex items-center justify-between gap-3 bg-paper hover:bg-paper-2 transition-colors duration-[120ms]"
              >
                <div>
                  <span className="font-display font-semibold">{p.name}</span>
                  <span className="font-data text-xs ml-2 text-ink-soft">
                    {p.frames.length} beats · {actionCount} lines
                  </span>
                </div>
                <span className={`text-xs shrink-0 font-data ${verified[p.name] ? "text-go" : "text-ink-soft"}`}>
                  {verified[p.name] ? "✓ verified" : "Review →"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
