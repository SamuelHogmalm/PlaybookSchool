import type { PlayerId, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import { tokenStroke, type CourtPalette } from "@/lib/court";

type Props = {
  /** Where to draw each token. Static beats pass beat.startPos; the animator passes a snapshot. */
  positions: Record<PlayerId, Vec>;
  /** Who holds the ball, or null when it is in flight and drawn separately. */
  possession: PlayerId | null;
  palette: CourtPalette;
  highlightPlayerId?: PlayerId;
  hidePlayer?: PlayerId | null;
  /**
   * Draw the small possession dot beside the holder. The animator turns this off —
   * it renders the ball from its own computed position, never attached to a token.
   */
  showBallDot?: boolean;
};

/** Player tokens at the given positions. Pure presentation — no position derivation. */
export function PlayerTokens({
  positions,
  possession,
  palette,
  highlightPlayerId,
  hidePlayer = null,
  showBallDot = true,
}: Props) {
  return (
    <g>
      {PLAYER_IDS.map((id) => {
        if (hidePlayer === id) return null;
        const p = positions[id];
        if (!p) return null;
        const hasBall = possession === id;
        const highlighted = highlightPlayerId === id;
        const { fill, stroke, strokeWidth } = tokenStroke(
          id,
          hasBall,
          palette,
          highlighted,
        );

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
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
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
            {hasBall && showBallDot && (
              <circle cx={p.x + 12} cy={p.y - 12} r="5" fill={palette.ball} />
            )}
          </g>
        );
      })}
    </g>
  );
}


type OriginProps = {
  beat: import("@/lib/play/types").Beat;
  palette: CourtPalette;
};

/**
 * A faint dot where a player began, shown when the tokens sit at their end positions.
 *
 * Without it an arrow appears to start from nowhere. With it the beat reads as "they
 * were here, they went there" — which is the same information a printed diagram gives,
 * arranged the other way round.
 */
export function OriginMarkers({ beat, palette }: OriginProps) {
  return (
    <g style={{ pointerEvents: "none" }} opacity={0.5}>
      {PLAYER_IDS.map((id) => {
        const from = beat.startPos[id];
        const to = beat.pos[id];
        if (!from || !to) return null;
        if (Math.hypot(from.x - to.x, from.y - to.y) < 1) return null;
        return (
          <circle
            key={`origin-${id}`}
            cx={from.x}
            cy={from.y}
            r="4"
            fill="none"
            stroke={palette.muted}
            strokeWidth="1.5"
          />
        );
      })}
    </g>
  );
}
