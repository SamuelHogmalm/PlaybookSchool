"use client";

import { useState } from "react";
import { CourtFrameView } from "@/app/court/Court";
import PlayViewer from "@/components/player/PlayViewer";
import { allPlays } from "@/lib/plays";
import { CURRENT_PLAYER } from "@/data/mockTeam";

export default function PlayerPlaysPage() {
  const [viewing, setViewing] = useState(null);
  const posMap = { PG: "1", SG: "2", SF: "3", PF: "4", C: "5" };
  const myPos = posMap[CURRENT_PLAYER.position] ?? "4";

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Playbook</h1>
      <p className="text-sm text-ink-soft mb-4">Tap a play to watch it. Your assignment shows on each play.</p>

      <div className="grid grid-cols-2 gap-2">
        {allPlays.map((play) => (
          <button
            key={play.name}
            type="button"
            className="ps-play-card"
            onClick={() => setViewing(play)}
          >
            <div className="ps-court-frame">
              <CourtFrameView
                frame={play.frames[0]}
                prev={null}
                suffix={`-pl-${play.name}`}
                maxWidthClass="max-w-full"
                showGhost={false}
                showActions={false}
              />
            </div>
            <div className="px-1.5 py-1.5 border-t border-rule">
              <p className="font-display text-sm font-semibold truncate">{play.name}</p>
              <p className="font-data text-[10px] text-ink-soft">{play.frames.length} beats</p>
            </div>
          </button>
        ))}
      </div>

      {viewing && (
        <PlayViewer play={viewing} myPosition={myPos} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
