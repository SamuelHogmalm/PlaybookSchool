"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/app/court/Court";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";
import {
  ALIGNMENT_PRESETS,
  CATEGORIES,
  createEmptyPlay,
  savePlayToSession,
} from "@/lib/playModel";

/** Single-screen play builder — drag players, draw lines, run animation. */
export default function CreatePlayPage() {
  const router = useRouter();
  const [play, setPlay] = useState(() => createEmptyPlay());

  const handleSave = () => {
    const id = savePlayToSession(play);
    router.push(`/plays/${id}`);
  };

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap" style={{ borderColor: C.line }}>
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <a href="/" className="text-xs shrink-0 px-2 py-1 rounded" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
            ← Home
          </a>
          <input
            value={play.name}
            onChange={(e) => setPlay((p) => ({ ...p, name: e.target.value }))}
            className="bg-transparent outline-none text-lg font-bold min-w-[140px]"
            style={{ color: C.text }}
            placeholder="Play name"
          />
          <select
            value={play.category}
            onChange={(e) => setPlay((p) => ({ ...p, category: e.target.value }))}
            className="text-xs rounded px-2 py-1 outline-none"
            style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.muted }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded text-sm font-semibold shrink-0"
          style={{ background: C.ball, color: "#0E1116" }}
        >
          Save play
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="rounded-lg px-4 py-3 mb-4 text-sm leading-relaxed" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}>
          <strong style={{ color: C.text }}>How it works:</strong> Each beat is one moment in the play.
          <strong style={{ color: C.text }}> Beat 1</strong> — drag players into your starting alignment.
          <strong style={{ color: C.text }}> Beat 2+</strong> — pick a line type, draw on the court (start on a player).
          The line type is the action: <span style={{ color: C.cut }}>cut</span>,{" "}
          <span style={{ color: C.ball }}>pass / dribble</span>,{" "}
          <span style={{ color: C.screen }}>screen</span>.
          Drawing moves players and sets who has the ball. Hit <strong style={{ color: C.text }}>RUN PLAY</strong> to watch it animate.
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs self-center" style={{ color: C.dim }}>Quick start:</span>
          {Object.keys(ALIGNMENT_PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                const pos = JSON.parse(JSON.stringify(ALIGNMENT_PRESETS[name]));
                setPlay((p) => ({
                  ...p,
                  frames: p.frames.map((f, i) => (i === 0 ? { ...f, pos, note: `${name} alignment.` } : f)),
                }));
              }}
              className="px-3 py-1 rounded text-xs"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}
            >
              {name}
            </button>
          ))}
        </div>

        <PlayDrawEditor play={play} setPlay={setPlay} />
      </div>
    </div>
  );
}
