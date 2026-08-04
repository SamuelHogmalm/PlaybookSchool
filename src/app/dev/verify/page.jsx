"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VerifyBeatPanel from "@/components/dev/VerifyBeatPanel";
import {
  clearOverlay,
  countVerifyStats,
  downloadJson,
  exportForPromotion,
  loadOverlay,
  mergePlays,
  patchBeat,
  saveOverlay,
  setBeatVerifiedFlag,
} from "@/lib/verifyPlays";

export default function VerifyPage() {
  const [overlay, setOverlay] = useState(null);
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [exportMsg, setExportMsg] = useState("");

  useEffect(() => {
    setOverlay(loadOverlay());
  }, []);

  const plays = useMemo(() => (overlay ? mergePlays(overlay) : []), [overlay]);
  const stats = useMemo(
    () => (overlay ? countVerifyStats(plays, overlay) : { total: 0, verified: 0, byPlay: {} }),
    [plays, overlay]
  );

  const persist = useCallback((next) => {
    setOverlay(next);
    saveOverlay(next);
  }, []);

  const handleFrameChange = useCallback(
    (playName, beatIndex, beatId, patch) => {
      if (!overlay) return;
      let next = patchBeat(playName, beatIndex, patch, overlay);
      next = setBeatVerifiedFlag(playName, beatId, false, next);
      persist(next);
    },
    [overlay, persist]
  );

  const handleVerifiedChange = useCallback(
    (playName, beatId, verified) => {
      if (!overlay) return;
      persist(setBeatVerifiedFlag(playName, beatId, verified, overlay));
    },
    [overlay, persist]
  );

  const handleExport = () => {
    const payload = exportForPromotion(plays);
    downloadJson("plays-verified.json", payload);
    setExportMsg(`Exported ${payload.length} plays (${stats.total} beats). Replace src/data/plays.json when ready.`);
    setTimeout(() => setExportMsg(""), 8000);
  };

  const handleReset = () => {
    if (!window.confirm("Clear all verify edits and verified flags from this browser?")) return;
    clearOverlay();
    setOverlay(loadOverlay());
    setExportMsg("Local verify overlay cleared — showing plays-interpreted.json again.");
    setTimeout(() => setExportMsg(""), 5000);
  };

  if (!overlay) {
    return (
      <div className="p-6 text-sm text-ink-soft">Loading verify data…</div>
    );
  }

  const activePlay = selectedPlay != null ? plays.find((p) => p.name === selectedPlay) : null;

  if (activePlay) {
    const playStats = stats.byPlay[activePlay.name] ?? { total: 0, verified: 0 };

    return (
      <div className="flex flex-col min-h-0 flex-1">
        <header className="px-4 py-3 border-b border-rule bg-paper-2 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setSelectedPlay(null)}
            className="text-sm text-chalk font-semibold mb-2"
          >
            ← All plays
          </button>
          <h1 className="font-display text-xl font-bold">{activePlay.name}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {activePlay.category} · {activePlay.frames.length} beats ·{" "}
            <span className={playStats.verified === playStats.total ? "text-go" : ""}>
              {playStats.verified}/{playStats.total} verified
            </span>
          </p>
          <p className="text-xs text-ink-soft mt-2 max-w-2xl">
            Compare each diagram to the PDF. Fix actions and notes inline, then check{" "}
            <strong>Verified against PDF</strong>. Edits save in this browser until you export.
          </p>
        </header>

        <div className="flex-1 overflow-auto p-4 max-w-5xl w-full mx-auto flex flex-col gap-6">
          {activePlay.frames.map((frame, i) => (
            <VerifyBeatPanel
              key={frame.id}
              playName={activePlay.name}
              beatIndex={i}
              frame={frame}
              prev={i > 0 ? activePlay.frames[i - 1] : null}
              verified={!!overlay.verified[`${activePlay.name}:${frame.id}`]}
              onVerifiedChange={(v) => handleVerifiedChange(activePlay.name, frame.id, v)}
              onFrameChange={(patch) => handleFrameChange(activePlay.name, i, frame.id, patch)}
            />
          ))}
        </div>
      </div>
    );
  }

  const allVerified = stats.verified === stats.total;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-jersey mb-0.5">
          Step 0a · Play data verify
        </p>
        <h1 className="font-display text-xl font-bold">Verify interpreted plays</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          Source: <code className="text-xs">src/data/plays-interpreted.json</code> — 12 plays, 36 beats
          with AI actions and notes. Verify against the PDF, then export to promote to{" "}
          <code className="text-xs">plays.json</code>.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="h-2 bg-paper border border-rule overflow-hidden">
              <div
                className="h-full bg-go transition-all duration-300"
                style={{ width: stats.total ? `${(stats.verified / stats.total) * 100}%` : "0%" }}
              />
            </div>
            <p className="font-data text-xs text-ink-soft mt-1">
              {stats.verified} / {stats.total} beats verified
              {allVerified && <span className="text-go ml-2">· Ready to export</span>}
            </p>
          </div>
          <button type="button" onClick={handleExport} className="ps-btn ps-btn-primary">
            Export JSON
          </button>
          <button type="button" onClick={handleReset} className="ps-btn ps-btn-secondary">
            Reset local edits
          </button>
        </div>

        {exportMsg && (
          <p className="text-sm text-go mt-2 border border-go/30 bg-go/5 px-3 py-2">{exportMsg}</p>
        )}

        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          <Link href="/dev/ai-preview" className="text-ink-soft hover:text-ink">
            AI preview →
          </Link>
          <Link href="/dev/review-demo" className="text-ink-soft hover:text-ink">
            Review demo →
          </Link>
        </div>
      </header>

      <ul className="flex-1 overflow-auto p-4 max-w-3xl w-full mx-auto flex flex-col gap-2">
        {plays.map((play) => {
          const ps = stats.byPlay[play.name] ?? { total: 0, verified: 0 };
          const actionCount = play.frames.reduce((n, f) => n + (f.actions?.length ?? 0), 0);
          const done = ps.verified === ps.total && ps.total > 0;

          return (
            <li key={play.name}>
              <button
                type="button"
                onClick={() => setSelectedPlay(play.name)}
                className={`w-full text-left border px-4 py-3 flex items-center justify-between gap-3 bg-paper hover:bg-paper-2 transition-colors ${
                  done ? "border-go/50" : "border-rule"
                }`}
              >
                <div>
                  <span className="font-display font-semibold">{play.name}</span>
                  <span className="font-data text-xs ml-2 text-ink-soft">
                    {play.frames.length} beats · {actionCount} actions
                  </span>
                </div>
                <span className={`text-xs shrink-0 font-data ${done ? "text-go" : "text-ink-soft"}`}>
                  {ps.verified}/{ps.total} verified →
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {allVerified && (
        <footer className="px-4 py-3 border-t border-go/30 bg-go/5 text-sm">
          All {stats.total} beats verified. Click <strong>Export JSON</strong>, review the file, then
          replace <code className="text-xs">src/data/plays.json</code> and remove the positions-only
          copy when you&apos;re satisfied.
        </footer>
      )}
    </div>
  );
}
