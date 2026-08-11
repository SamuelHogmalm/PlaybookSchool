"use client";

import { useState, useMemo } from "react";
import importedPlays from "@/data/plays.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { CourtFrameView, C } from "@/app/court/Court";
import PlayLab from "@/app/PlayLab";

const plays = importedPlays.map(normalizeImportedPlay);
const totalBeats = plays.reduce((n, p) => n + p.frames.length, 0);

function PlayCard({ play, index, onRunDemo }) {
  const [idx, setIdx] = useState(0);
  const frame = play.frames[idx];
  const prev = idx > 0 ? play.frames[idx - 1] : null;
  const ballSeq = play.frames.map((f) => f.ball).join("");

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div>
        <h3 className="font-semibold text-base" style={{ color: C.text }}>{play.name}</h3>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>
          {play.category} · {play.frames.length} beats · ball: {ballSeq}
        </p>
      </div>

      <CourtFrameView
        frame={frame}
        prev={prev}
        suffix={`-${index}`}
        maxWidthClass="max-w-full"
        showGhost={idx > 0}
        showActions={false}
      />

      <div className="flex items-center gap-1 flex-wrap">
        {play.frames.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setIdx(i)}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{
              background: i === idx ? C.panel2 : "transparent",
              border: `1px solid ${i === idx ? C.ball : C.line}`,
              color: i === idx ? C.text : C.muted,
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <button
        onClick={() => onRunDemo(play)}
        className="w-full mt-1 px-3 py-2.5 rounded text-sm font-semibold"
        style={{ background: C.ball, color: "#0E1116" }}
      >
        Run demo
      </button>
    </div>
  );
}

export default function ImportPreviewPage() {
  const [activePlay, setActivePlay] = useState(null);
  const sorted = useMemo(() => [...plays].sort((a, b) => a.name.localeCompare(b.name)), []);

  if (activePlay) {
    return (
      <PlayLab
        key={activePlay.name}
        initialPlay={activePlay}
        onBack={() => setActivePlay(null)}
      />
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="mb-6">
        <p className="text-xs font-mono mb-1" style={{ color: C.dim, letterSpacing: "0.12em" }}>IMPORTED PLAYBOOK</p>
        <h1 className="text-2xl font-bold">Your Plays</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {plays.length} plays · {totalBeats} beats — click <strong style={{ color: C.text }}>Run demo</strong> for full Coach / Player mode
        </p>
        <a href="/import" className="text-xs mt-2 inline-block" style={{ color: C.ok }}>Import PDF →</a>
        <a href="/dev/ai-preview" className="text-xs mt-2 ml-4 inline-block" style={{ color: C.muted }}>AI preview →</a>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((play, i) => (
          <PlayCard key={`${play.name}-${i}`} play={play} index={i} onRunDemo={setActivePlay} />
        ))}
      </div>
    </div>
  );
}
