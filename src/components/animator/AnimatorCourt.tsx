"use client";

import type { PlayerId } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import {
  CourtMarkers,
  CourtSurface,
  COURT_HEIGHT,
  COURT_WIDTH,
} from "@/components/court";
import { courtPalette } from "@/lib/court";
import type { PositionsSnapshot } from "@/lib/timing";

type Props = {
  snapshot: PositionsSnapshot | null;
  hidePlayer?: PlayerId | null;
  highlightPlayer?: PlayerId | null;
  markerSuffix?: string;
};

/** Renders court from a positionsAt snapshot — no position logic here. */
export function AnimatorCourt({
  snapshot,
  hidePlayer = null,
  highlightPlayer = null,
  markerSuffix = "",
}: Props) {
  const palette = courtPalette("paper");

  if (!snapshot) {
    return (
      <div className="flex h-48 items-center justify-center rounded border border-stone-700 text-sm text-stone-500">
        No frame
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden border border-stone-600 w-full max-w-[400px]"
      style={{ background: palette.wood }}
    >
      <svg
        viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Animated court"
      >
        <CourtMarkers palette={palette} suffix={markerSuffix} />
        <CourtSurface palette={palette} />

        {PLAYER_IDS.map((id) => {
          if (hidePlayer === id) return null;
          const p = snapshot.players[id];
          if (!p) return null;
          const highlighted = highlightPlayer === id;
          const hasBall =
            !snapshot.ballInFlight && snapshot.possession === id;

          return (
            <g key={id}>
              {highlighted && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="24"
                  fill="none"
                  stroke={palette.ok}
                  strokeWidth="2"
                  opacity="0.7"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r="15"
                fill={palette.panel2}
                stroke={
                  highlighted ? palette.ok : hasBall ? palette.ball : palette.muted
                }
                strokeWidth={hasBall ? 3 : highlighted ? 2.5 : 2}
              />
              <text
                x={p.x}
                y={p.y + 5.5}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill={palette.text}
                style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}
              >
                {id}
              </text>
            </g>
          );
        })}

        <circle
          cx={snapshot.ball.x}
          cy={snapshot.ball.y}
          r={snapshot.ballInFlight ? 6 : 5}
          fill={palette.ball}
          stroke={palette.panel2}
          strokeWidth="1.5"
          opacity={snapshot.ballInFlight ? 1 : 0.95}
        />
      </svg>
    </div>
  );
}
