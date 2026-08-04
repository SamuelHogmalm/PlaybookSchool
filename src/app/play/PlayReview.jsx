"use client";

import { useEffect, useState } from "react";
import { C, CourtFrameView } from "@/app/court/Court";
import { cropKey } from "@/lib/enrichReview";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";

function Section({ label, children, wide = false }) {
  return (
    <div
      className={`rounded-lg p-4 ${wide ? "max-w-6xl mx-auto w-full" : ""}`}
      style={{ background: C.panel, border: `1px solid ${C.line}` }}
    >
      <div className="text-xs mb-2 font-mono" style={{ color: C.dim, letterSpacing: "0.12em" }}>{label}</div>
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
}) {
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
    setPlayState(updated);
    onPlayChange?.(updated);
  };

  const updateSummary = (summary) => setPlay((p) => ({ ...p, summary }));
  const updatePurpose = (purpose) => setPlay((p) => ({ ...p, purpose }));
  const updateBeatNote = (i, note) =>
    setPlay((p) => ({
      ...p,
      frames: p.frames.map((f, j) => (j === i ? { ...f, note } : f)),
    }));

  const cropB64 = crops[cropKey(play.name, compareBeat)];
  const compareFrame = play.frames[compareBeat];
  const comparePrev = compareBeat > 0 ? play.frames[compareBeat - 1] : null;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap" style={{ borderColor: C.line }}>
        <div>
          <p className="text-xs font-mono mb-0.5" style={{ color: C.dim, letterSpacing: "0.12em" }}>REVIEW IMPORT</p>
          <h1 className="text-xl font-bold">{play.name}</h1>
          <p className="text-xs" style={{ color: C.muted }}>{play.category} · {play.frames.length} beats</p>
        </div>
        <div className="flex items-center gap-2">
          {verified && (
            <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: "#12301F", color: C.ok, border: `1px solid ${C.ok}` }}>
              ✓ Verified
            </span>
          )}
          {onBack ? (
            <button type="button" onClick={onBack} className="text-xs px-3 py-2 rounded" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
              {backLabel}
            </button>
          ) : (
            <a href={backHref} className="text-xs px-3 py-2 rounded" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
              {backLabel}
            </a>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 flex flex-col gap-6">
        <Section label="EDIT & RUN" wide>
          <p className="text-sm mb-4" style={{ color: C.muted }}>
            Drag players, draw lines, hit Run — one court, live updates. Moving a player on this beat
            shifts them on all later beats too.
          </p>
          <PlayDrawEditor play={play} setPlay={setPlay} runLabel={runLabel} />
        </Section>

        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          {showCropCompare && cropB64 && (
            <Section label="ORIGINAL vs OURS">
              <p className="text-xs mb-3" style={{ color: C.muted }}>
                FastDraw frame crop next to our rendered beat. Check positions match.
              </p>
              <div className="flex gap-1 mb-3 flex-wrap">
                {play.frames.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCompareBeat(i)}
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
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
                <div className="rounded overflow-hidden border" style={{ borderColor: C.line }}>
                  <p className="text-xs px-2 py-1 font-mono" style={{ color: C.dim, background: C.panel2 }}>PDF CROP</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/png;base64,${cropB64}`} alt={`Beat ${compareBeat + 1} original`} className="w-full block" />
                </div>
                <div>
                  <p className="text-xs px-2 py-1 font-mono mb-0 rounded-t" style={{ color: C.dim, background: C.panel2 }}>OUR MODEL</p>
                  <CourtFrameView
                    frame={compareFrame}
                    prev={comparePrev}
                    suffix="-compare"
                    maxWidthClass="max-w-full"
                    showGhost={compareBeat > 0}
                    showActions={compareBeat > 0 && (compareFrame.actions?.length ?? 0) > 0}
                  />
                </div>
              </div>
            </Section>
          )}

          <Section label="PLAY SUMMARY">
            {editing === "summary" ? (
              <textarea
                autoFocus
                rows={3}
                value={play.summary}
                onChange={(e) => updateSummary(e.target.value)}
                onBlur={() => setEditing(null)}
                className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none"
                style={{ color: C.text }}
              />
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{play.summary}</p>
            )}
            <button type="button" onClick={() => setEditing("summary")} className="text-xs mt-2" style={{ color: C.ball }}>
              Edit manually
            </button>
          </Section>

          <Section label="WHAT IT'S FOR">
            {editing === "purpose" ? (
              <textarea
                autoFocus
                rows={2}
                value={play.purpose}
                onChange={(e) => updatePurpose(e.target.value)}
                onBlur={() => setEditing(null)}
                className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none"
                style={{ color: C.text }}
              />
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{play.purpose}</p>
            )}
            <button type="button" onClick={() => setEditing("purpose")} className="text-xs mt-2" style={{ color: C.ball }}>
              Edit manually
            </button>
          </Section>

          <Section label="BEAT BREAKDOWN">
            <ul className="flex flex-col gap-3">
              {play.frames.map((f, i) => (
                <li key={f.id} className="text-sm">
                  <span className="font-mono text-xs mr-2" style={{ color: C.ball }}>Beat {i + 1}</span>
                  {f.needs_review && (
                    <span className="text-xs mr-2 px-1 rounded" style={{ color: C.bad, border: `1px solid ${C.bad}` }}>needs review</span>
                  )}
                  {f.actions?.length > 0 && (
                    <span className="text-xs mr-2" style={{ color: C.dim }}>
                      {f.actions.length} line{f.actions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {editing === `beat-${i}` ? (
                    <textarea
                      autoFocus
                      rows={2}
                      value={f.note}
                      onChange={(e) => updateBeatNote(i, e.target.value)}
                      onBlur={() => setEditing(null)}
                      className="w-full mt-1 bg-transparent outline-none text-sm resize-none"
                      style={{ color: C.text }}
                    />
                  ) : (
                    <span style={{ color: C.text }}>{f.note || <em style={{ color: C.dim }}>No description yet</em>}</span>
                  )}
                  <button type="button" onClick={() => setEditing(`beat-${i}`)} className="block text-xs mt-1" style={{ color: C.muted }}>
                    Edit note
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          {play.counters?.length > 0 && (
            <Section label="READS · COUNTERS">
              <ul className="flex flex-col gap-3">
                {play.counters.map((c, i) => (
                  <li key={i} className="text-sm rounded p-2" style={{ background: C.panel2 }}>
                    <p className="font-medium mb-1" style={{ color: C.muted }}>{c.trigger}</p>
                    <p style={{ color: C.text }}>{c.answer}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pb-8">
            <button
              type="button"
              onClick={() => {
              setVerified(true);
              onVerified?.();
            }}
              disabled={verified}
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-sm"
              style={{
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
