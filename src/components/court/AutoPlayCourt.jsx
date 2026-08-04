"use client";

import { useState, useEffect } from "react";
import { CourtFrameView } from "@/app/court/Court";

/** Cycles through beats — landing hero and previews */
export default function AutoPlayCourt({ play, intervalMs = 2200, className = "" }) {
  const [idx, setIdx] = useState(0);
  const frames = play.frames;
  const prev = idx > 0 ? frames[idx - 1] : null;

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1 >= frames.length ? 0 : i + 1));
    }, intervalMs);
    return () => clearInterval(id);
  }, [frames.length, intervalMs]);

  return (
    <div className={`ps-court-frame border border-rule ${className}`}>
      <CourtFrameView
        frame={frames[idx]}
        prev={prev}
        suffix="-autoplay"
        maxWidthClass="max-w-full"
        showGhost={false}
        showActions
      />
    </div>
  );
}
