import type { Beat, PlayerId, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import { tokenStroke, type CourtPalette } from "@/lib/court";

type Props = {
  beat: Beat;
  palette: CourtPalette;
  highlightPlayerId?: PlayerId;
};

/** Player tokens at beat.startPos — possession from beat.startBall. */
export function PlayerTokens({ beat, palette, highlightPlayerId }: Props) {
  return (
    <g>
      {PLAYER_IDS.map((id) => {
        const p = beat.startPos[id];
        if (!p) return null;
        const hasBall = beat.startBall === id;
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
            {hasBall && <circle cx={p.x + 12} cy={p.y - 12} r="5" fill={palette.ball} />}
          </g>
        );
      })}
    </g>
  );
}

type GhostProps = {
  positions: Record<PlayerId, Vec>;
  palette: CourtPalette;
  opacity?: number;
};

/** Faded markers at beat.pos — destination spots for this beat. */
export function BeatGhostMarkers({
  positions,
  palette,
  opacity = 0.38,
}: GhostProps) {
  return (
    <g opacity={opacity} style={{ pointerEvents: "none" }}>
      {PLAYER_IDS.map((id) => {
        const p = positions[id];
        if (!p) return null;
        return (
          <g key={id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="none"
              stroke={palette.muted}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={palette.muted}
              style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}
            >
              {id}
            </text>
          </g>
        );
      })}
    </g>
  );
}
