"use client";

import type { Beat, PlayerId, Play } from "@/lib/play/types";
import {
  CourtMarkers,
  CourtSurface,
  PlayerTokens,
  COURT_HEIGHT,
  COURT_WIDTH,
} from "@/components/court";
import { courtPalette } from "@/lib/court";
import type { Phase, PositionsSnapshot } from "@/lib/timing";

import { RouteLayer } from "./RouteLayer";

type Props = {
  snapshot: PositionsSnapshot | null;
  play?: Play | null;
  beatIndex?: number;
  beatT?: number;
  phase?: Phase;
  hidePlayer?: PlayerId | null;
  highlightPlayer?: PlayerId | null;
  markerSuffix?: string;
};

/** Renders court from a positionsAt snapshot — no position logic here. */
export function AnimatorCourt({
  snapshot,
  play = null,
  beatIndex = 0,
  beatT = 0,
  phase = "move",
  hidePlayer = null,
  highlightPlayer = null,
  markerSuffix = "",
}: Props) {
  const palette = courtPalette("paper");
  const beat: Beat | null = play?.beats[beatIndex] ?? null;

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

        {beat && (
          <RouteLayer
            beat={beat}
            beatT={beatT}
            phase={phase}
            palette={palette}
            markerSuffix={markerSuffix}
          />
        )}

        <PlayerTokens
          positions={snapshot.players}
          possession={snapshot.ballInFlight ? null : snapshot.possession}
          palette={palette}
          highlightPlayerId={highlightPlayer ?? undefined}
          hidePlayer={hidePlayer}
          showBallDot={false}
        />

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
