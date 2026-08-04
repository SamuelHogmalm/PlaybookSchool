"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";
import {
  ALIGNMENT_PRESETS,
  CATEGORIES,
  createEmptyPlay,
  savePlayToSession,
} from "@/lib/playModel";

export default function CreatePlayPage() {
  const router = useRouter();
  const [play, setPlay] = useState(() => createEmptyPlay());

  const handleSave = () => {
    const id = savePlayToSession(play);
    router.push(`/plays/${id}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-rule bg-paper-2 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <Link href="/coach/playbook" className="ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs shrink-0">
            ← Playbook
          </Link>
          <input
            value={play.name}
            onChange={(e) => setPlay((p) => ({ ...p, name: e.target.value }))}
            className="bg-transparent outline-none font-display text-lg font-bold min-w-[140px] text-ink"
            placeholder="Play name"
          />
          <select
            value={play.category}
            onChange={(e) => setPlay((p) => ({ ...p, category: e.target.value }))}
            className="ps-input w-auto min-h-[36px] text-xs py-0"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleSave} className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs shrink-0">
          Save play
        </button>
      </header>

      <div className="flex-1 overflow-auto max-w-6xl mx-auto p-4 w-full">
        <div className="ps-panel mb-4 text-sm text-ink-soft leading-relaxed">
          <strong className="text-ink">How it works:</strong> Beat 1 — drag players into alignment.
          Beat 2+ — pick a line type and draw on the court. Hit <strong className="text-ink">Run play</strong> to animate.
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="font-data text-[10px] uppercase tracking-widest text-ink-soft self-center">Quick start</span>
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
              className="ps-btn ps-btn-secondary py-0 min-h-[32px] text-xs"
            >
              {name}
            </button>
          ))}
        </div>

        <PlayDrawEditor play={play} setPlay={setPlay} theme="paper" />
      </div>
    </div>
  );
}
