"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { C, CourtFrameView } from "@/app/court/Court";
import { cropKey } from "@/lib/enrichReview";
import { markBreakdownStale } from "@/lib/normalizePlay";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";

function Section({ label, children, wide = false, paper = false }) {
  return (
    <div className={`p-4 ${wide ? "max-w-6xl mx-auto w-full" : ""} ${paper ? "ps-panel" : "rounded-lg"}`} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}` }}>
      <div className={`text-xs mb-2 ${paper ? "font-data uppercase tracking-widest text-ink-soft" : "font-mono"}`} style={paper ? undefined : { color: C.dim, letterSpacing: "0.12em" }}>{label}</div>
      {children}
    </div>
  );
}

export default function PlayReview({
  play: initialPlay,
  crops = {},
  backHref = "/import/review",
  backLabel = "← All plays",
  onBack,
  onPlayChange,
  onVerified,
  showCropCompare = true,
  runLabel = "RUN PLAY",
  theme = "paper",
}) {
  const paper = theme === "paper";
  const [play, setPlayState] = useState(initialPlay);
  const [verified, setVerified] = useState(initialPlay.verified ?? false);
  const [editing, setEditing] = useState(null);
  const [compareBeat, setCompareBeat] = useState(0);

  useEffect(() => {
    setPlayState(initialPlay);
    setVerified(initialPlay.verified ?? false);
  }, [initialPlay.name]);

  const setPlay = (next) => {
    const updated = typeof next === "function" ? next(play) : next;
    const stale = updated !== play ? markBreakdownStale(updated) : updated;
    setPlayState(stale);
    onPlayChange?.(stale);
  };

  const updateSummary = (summary) => setPlay((p) => markBreakdownStale({ ...p, summary }));
  const updatePurpose = (purpose) => setPlay((p) => markBreakdownStale({ ...p, purpose }));
  const updateBeatNote = (i, note) =>
    setPlay((p) =>
      markBreakdownStale({
        ...p,
        frames: p.frames.map((f, j) => (j === i ? { ...f, note } : f)),
      })
    );

  const cropB64 = crops[cropKey(play.name, compareBeat)];
  const compareFrame = play.frames[compareBeat];
  const comparePrev = compareBeat > 0 ? play.frames[compareBeat - 1] : null;

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${paper ? "bg-paper text-ink" : "min-h-screen"}`} style={paper ? undefined : { background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className={`flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap ${paper ? "border-rule bg-paper-2" : ""}`} style={paper ? undefined : { borderColor: C.line }}>
        <div>
          <p className={`text-xs mb-0.5 ${paper ? "font-data uppercase tracking-widest text-ink-soft" : "font-mono"}`} style={paper ? undefined : { color: C.dim, letterSpacing: "0.12em" }}>Review import</p>
          <h1 className={`font-bold ${paper ? "font-display text-xl" : "text-xl"}`}>{play.name}</h1>
          <p className={`text-xs ${paper ? "font-data text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>{play.category} · {play.frames.length} beats</p>
        </div>
        <div className="flex items-center gap-2">
          {verified && (
            <span className={`text-xs font-semibold px-2 py-1 border ${paper ? "border-go text-go" : "rounded"}`} style={paper ? undefined : { background: "#12301F", color: C.ok, border: `1px solid ${C.ok}` }}>
              ✓ Verified
            </span>
          )}
          {onBack ? (
            <button type="button" onClick={onBack} className={paper ? "ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs" : "text-xs px-3 py-2 rounded"} style={paper ? undefined : { color: C.muted, border: `1px solid ${C.line}` }}>
              {backLabel}
            </button>
          ) : (
            <Link href={backHref} className={paper ? "ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs inline-flex items-center" : "text-xs px-3 py-2 rounded"} style={paper ? undefined : { color: C.muted, border: `1px solid ${C.line}` }}>
              {backLabel}
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto max-w-6xl mx-auto p-4 flex flex-col gap-6 w-full">
        <Section label="Edit & run" wide paper={paper}>
          <p className={`text-sm mb-4 ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>
            Drag players, draw lines, hit Run — one court, live updates.
          </p>
          <PlayDrawEditor play={play} setPlay={setPlay} runLabel={runLabel} theme={paper ? "paper" : "dark"} />
        </Section>

        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          {showCropCompare && cropB64 && (
            <Section label="Original vs ours" paper={paper}>
              <p className={`text-xs mb-3 ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>
                FastDraw frame crop next to our rendered beat.
              </p>
              <div className="flex gap-1 mb-3 flex-wrap">
                {play.frames.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCompareBeat(i)}
                    className={paper ? `ps-editor-beat-btn ${i === compareBeat ? "is-active" : ""}` : "px-2 py-1 rounded text-xs font-mono"}
                    style={paper ? undefined : {
                      border: `1px solid ${i === compareBeat ? C.ball : C.line}`,
                      color: i === compareBeat ? C.text : C.muted,
                      background: i === compareBeat ? C.panel2 : "transparent",
                    }}
                  >
                    {i + 1}
                    {f.needs_review && " ·"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`overflow-hidden border ${paper ? "border-rule" : "rounded"}`} style={paper ? undefined : { borderColor: C.line }}>
                  <p className={`text-xs px-2 py-1 font-mono ${paper ? "font-data bg-paper-2 text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim, background: C.panel2 }}>PDF crop</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/png;base64,${cropB64}`} alt={`Beat ${compareBeat + 1} original`} className="w-full block" />
                </div>
                <div>
                  <p className={`text-xs px-2 py-1 font-mono mb-0 ${paper ? "font-data bg-paper-2 text-ink-soft" : "rounded-t"}`} style={paper ? undefined : { color: C.dim, background: C.panel2 }}>Our model</p>
                  <div className="ps-court-frame border border-rule">
                    <CourtFrameView
                      frame={compareFrame}
                      prev={comparePrev}
                      suffix="-compare"
                      maxWidthClass="max-w-full"
                      showGhost={false}
                      showActions={compareBeat > 0}
                      showMovementLines={compareBeat > 0}
                      theme="paper"
                    />
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section label="What we're hunting" paper={paper}>
            {play.breakdownStale && (
              <p className="text-xs text-flag mb-2">You edited this play — breakdown may be outdated. Re-import to refresh AI breakdown.</p>
            )}
            {editing === "purpose" ? (
              <textarea
                autoFocus
                rows={3}
                value={play.purpose}
                onChange={(e) => updatePurpose(e.target.value)}
                onBlur={() => setEditing(null)}
                className={`w-full outline-none text-sm leading-relaxed resize-none ${paper ? "ps-input border" : "bg-transparent"}`}
                style={paper ? undefined : { color: C.text }}
              />
            ) : (
              <p className={`text-sm leading-relaxed font-semibold ${paper ? "text-ink" : ""}`} style={paper ? undefined : { color: C.text }}>
                {play.purpose}
              </p>
            )}
            {play.breakdown?.advantage && (
              <p className={`text-sm leading-relaxed mt-2 ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>
                {play.breakdown.advantage}
              </p>
            )}
            <button type="button" onClick={() => setEditing("purpose")} className={`text-xs mt-2 ${paper ? "text-chalk font-semibold" : ""}`} style={paper ? undefined : { color: C.ball }}>
              Edit manually
            </button>
          </Section>

          <Section label="Play summary" paper={paper}>
            {editing === "summary" ? (
              <textarea
                autoFocus
                rows={3}
                value={play.summary}
                onChange={(e) => updateSummary(e.target.value)}
                onBlur={() => setEditing(null)}
                className={`w-full outline-none text-sm leading-relaxed resize-none ${paper ? "ps-input border" : "bg-transparent"}`}
                style={paper ? undefined : { color: C.text }}
              />
            ) : (
              <p className={`text-sm leading-relaxed ${paper ? "text-ink" : ""}`} style={paper ? undefined : { color: C.text }}>{play.summary}</p>
            )}
            <button type="button" onClick={() => setEditing("summary")} className={`text-xs mt-2 ${paper ? "text-chalk font-semibold" : ""}`} style={paper ? undefined : { color: C.ball }}>
              Edit manually
            </button>
          </Section>

          <Section label="Beat breakdown" paper={paper}>
            <ul className="flex flex-col gap-3">
              {play.frames.map((f, i) => (
                <li key={f.id} className="text-sm">
                  <span className={`text-xs mr-2 ${paper ? "font-data text-jersey" : "font-mono"}`} style={paper ? undefined : { color: C.ball }}>Beat {i + 1}</span>
                  {f.needs_review && (
                    <span className={`text-xs mr-2 px-1 border ${paper ? "text-flag border-flag" : "rounded"}`} style={paper ? undefined : { color: C.bad, border: `1px solid ${C.bad}` }}>needs review</span>
                  )}
                  {editing === `beat-${i}` ? (
                    <textarea
                      autoFocus
                      rows={2}
                      value={f.note}
                      onChange={(e) => updateBeatNote(i, e.target.value)}
                      onBlur={() => setEditing(null)}
                      className={`w-full mt-1 outline-none text-sm resize-none ${paper ? "ps-input" : "bg-transparent"}`}
                      style={paper ? undefined : { color: C.text }}
                    />
                  ) : (
                    <span className={paper ? "text-ink" : ""} style={paper ? undefined : { color: C.text }}>{f.note || <em className={paper ? "text-ink-soft" : ""} style={paper ? undefined : { color: C.dim }}>No description yet</em>}</span>
                  )}
                  <button type="button" onClick={() => setEditing(`beat-${i}`)} className={`block text-xs mt-1 ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>
                    Edit note
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <div className="flex flex-col sm:flex-row gap-3 pb-8">
            <button
              type="button"
              onClick={() => {
                setVerified(true);
                onVerified?.();
              }}
              disabled={verified}
              className={paper ? "ps-btn ps-btn-primary flex-1 disabled:opacity-50" : "flex-1 px-6 py-3 rounded-lg font-semibold text-sm"}
              style={paper ? undefined : {
                background: verified ? C.panel2 : C.ok,
                color: verified ? C.dim : "#0E1116",
                opacity: verified ? 0.7 : 1,
              }}
            >
              {verified ? "Play verified" : "Looks good — verify this play"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
