"use client";

import { useState } from "react";
import PlayPlayback from "@/app/play/PlayPlayback";
import { CourtFrameView } from "@/app/court/Court";

const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

/** Read-only play viewer with beat stepper + run */
export default function PlayViewer({ play, myPosition = "4", onClose }) {
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const frames = play.frames;

  if (running) {
    return (
      <div className="fixed inset-0 z-50 bg-paper flex flex-col">
        <header className="ps-app-bar">
          <button type="button" onClick={() => setRunning(false)} className="text-chalk text-sm font-semibold">
            ← Back
          </button>
          <span className="font-display font-bold">{play.name}</span>
        </header>
        <div className="flex-1 p-4 overflow-auto">
          <div className="ps-court-frame border border-rule max-w-lg mx-auto">
            <PlayPlayback play={play} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col">
      <header className="ps-app-bar">
        <button type="button" onClick={onClose} className="text-chalk text-sm font-semibold">
          ← Plays
        </button>
        <span className="font-display font-bold truncate">{play.name}</span>
      </header>

      <div className="flex-1 overflow-auto p-4 max-w-lg mx-auto w-full">
        <div className="ps-court-frame border border-rule">
          <CourtFrameView
            frame={frames[idx]}
            prev={idx > 0 ? frames[idx - 1] : null}
            suffix={`-view-${play.name}`}
            maxWidthClass="max-w-full"
            showGhost
            showActions={idx > 0}
            showMovementLines={idx > 0}
          />
        </div>

        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            type="button"
            className="ps-btn ps-btn-ghost min-h-[36px] px-2 text-xs"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
          >
            ◀
          </button>
          <span className="font-data text-xs text-ink-soft">
            {idx + 1} / {frames.length}
          </span>
          <button
            type="button"
            className="ps-btn ps-btn-ghost min-h-[36px] px-2 text-xs"
            disabled={idx >= frames.length - 1}
            onClick={() => setIdx((i) => i + 1)}
          >
            ▶
          </button>
        </div>

        {frames[idx]?.note && (
          <p className="mt-3 text-sm text-ink-soft italic text-center">&ldquo;{frames[idx].note}&rdquo;</p>
        )}

        <div className="mt-4 border border-rule p-3 bg-paper-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">Your job · #{myPosition}</p>
          <p className="text-sm">
            As {POS_NAME[myPosition]}, read the screen and cut when the ball hits the elbow. Be ready on beat 3.
          </p>
        </div>

        <button type="button" onClick={() => setRunning(true)} className="ps-btn ps-btn-primary w-full mt-4">
          Run full play
        </button>
      </div>
    </div>
  );
}
