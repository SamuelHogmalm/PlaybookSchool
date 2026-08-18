import type { RefObject } from "react";
import type { Beat, PlayerId } from "@/lib/play/types";
import { COURT_HEIGHT, COURT_WIDTH, courtPalette } from "@/lib/court";
import { ActionLayer } from "./ActionLayer";
import { CourtMarkers } from "./CourtMarkers";
import { CourtSurface } from "./CourtSurface";
import { DestinationRoutes } from "./DestinationRoutes";
import { OriginMarkers, PlayerTokens } from "./PlayerTokens";

export type CourtRendererProps = {
  beat: Beat;
  /** Draw routes to beat.pos for travel no action explains (builder). */
  showDestinations?: boolean;
  /** Grab rings on every destination — move mode, where they can be dragged. */
  showDestinationHandles?: boolean;
  draggingPlayer?: PlayerId | null;
  /**
   * Where the tokens stand.
   *
   * `"start"` is the diagram convention — a token at the tail of its own arrow, which is
   * what a printed play looks like and what the animator shows on frame one.
   *
   * `"end"` is for editing. The court then reads as the state the beat leaves behind,
   * which is exactly the next beat's opening, so stepping between beats no longer makes
   * everyone jump — and a player standing somewhere new with no arrow into them is
   * visibly wrong rather than quietly invalid.
   */
  tokensAt?: "start" | "end";
  highlightActionId?: string;
  highlightPlayerId?: PlayerId;
  /** Unique suffix when multiple courts share one page (SVG marker ids). */
  markerSuffix?: string;
  theme?: "paper" | "dark";
  className?: string;
  width?: number | string;
  /** Show chalkboard frame border (default true). */
  framed?: boolean;
  /** Optional ref to the root SVG (for editor coordinate mapping). */
  svgRef?: RefObject<SVGSVGElement | null>;
};

/**
 * Pure presentation: one beat on the half court.
 * Actions drawn startPos → pos. No state or derivation.
 */
export function CourtRenderer({
  beat,
  showDestinations = false,
  showDestinationHandles = false,
  draggingPlayer = null,
  tokensAt = "start",
  highlightActionId,
  highlightPlayerId,
  markerSuffix = "",
  theme = "paper",
  className = "",
  width = "100%",
  framed = true,
  svgRef,
}: CourtRendererProps) {
  const palette = courtPalette(theme);
  const frameClass = framed
    ? `overflow-hidden border border-stone-600 w-full max-w-[400px] ${className}`.trim()
    : className;

  return (
    <div className={frameClass} style={framed ? { background: palette.wood } : undefined}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
        width={width}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Beat ${beat.id}`}
      >
        <CourtMarkers palette={palette} suffix={markerSuffix} />
        <CourtSurface palette={palette} />
        {showDestinations && (
          <DestinationRoutes
            beat={beat}
            palette={palette}
            showHandles={showDestinationHandles}
            draggingPlayer={draggingPlayer}
            labelDestinations={tokensAt === "start"}
          />
        )}
        <ActionLayer
          beat={beat}
          palette={palette}
          markerSuffix={markerSuffix}
          highlightActionId={highlightActionId}
        />
        {/* Where they came from, when the tokens have moved on to the end state. */}
        {tokensAt === "end" && <OriginMarkers beat={beat} palette={palette} />}
        <PlayerTokens
          positions={tokensAt === "end" ? beat.pos : beat.startPos}
          // Possession has to match the moment being drawn. Showing end-of-beat
          // positions with start-of-beat possession put the ball in the hand of a
          // player who had already passed it.
          possession={tokensAt === "end" ? beat.ball : beat.startBall}
          palette={palette}
          highlightPlayerId={highlightPlayerId}
        />
      </svg>
    </div>
  );
}

export { COURT_WIDTH, COURT_HEIGHT };
