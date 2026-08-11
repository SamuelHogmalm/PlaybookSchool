import type { ActionType, Vec } from "@/lib/play/types";
import {
  pathToSvgD,
  perpendicularBar,
  shorten,
  squigglePath,
  PAPER_PALETTE,
} from "@/lib/court";

type Props = {
  type: ActionType;
  path: Vec[];
  /** Screen/handoff target for bar orientation */
  target?: Vec;
};

/** Live stroke preview while the coach is drawing. */
export function DrawPreview({ type, path, target }: Props) {
  if (path.length < 2) return null;

  const palette = PAPER_PALETTE;
  const from = path[0];
  const to = path[path.length - 1];

  if (type === "dribble") {
    const [p, q] = shorten(from, to, 16, 16);
    return (
      <path
        d={squigglePath(p, q)}
        fill="none"
        stroke={palette.ball}
        strokeWidth={2.5}
        opacity={0.85}
        strokeDasharray="6 4"
      />
    );
  }

  if (type === "cut") {
    if (path.length >= 3) {
      return (
        <path
          d={pathToSvgD(path)}
          fill="none"
          stroke={palette.cut}
          strokeWidth={2.5}
          opacity={0.85}
          strokeDasharray="6 4"
        />
      );
    }
    const [p, q] = shorten(from, to, 15, 15);
    return (
      <line
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={palette.cut}
        strokeWidth={2.5}
        opacity={0.85}
        strokeDasharray="6 4"
      />
    );
  }

  if (type === "pass") {
    if (path.length >= 3) {
      return (
        <path
          d={pathToSvgD(path)}
          fill="none"
          stroke={palette.ball}
          strokeWidth={2.5}
          opacity={0.85}
          strokeDasharray="8 6"
        />
      );
    }
    const [p, q] = shorten(from, to, 16, 18);
    return (
      <line
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={palette.ball}
        strokeWidth={2.5}
        opacity={0.85}
        strokeDasharray="8 6"
      />
    );
  }

  if (type === "screen") {
    const barTarget = target ?? to;
    const [barA, barB] = perpendicularBar(to, barTarget, 11);
    const [p, q] = shorten(from, to, 15, 2);
    return (
      <g opacity={0.85}>
        {path.length >= 3 ? (
          <path
            d={pathToSvgD(path)}
            fill="none"
            stroke={palette.screen}
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
        ) : (
          <line
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={palette.screen}
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
        )}
        <line
          x1={barA.x}
          y1={barA.y}
          x2={barB.x}
          y2={barB.y}
          stroke={palette.screen}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (type === "handoff") {
    const barTarget = target ?? to;
    const [barA, barB] = perpendicularBar(to, barTarget, 7);
    const [p, q] = shorten(from, to, 14, 4);
    return (
      <g opacity={0.85}>
        <line
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={palette.cut}
          strokeWidth={2.5}
          strokeDasharray="4 4"
        />
        <line
          x1={barA.x}
          y1={barA.y}
          x2={barB.x}
          y2={barB.y}
          stroke={palette.cut}
          strokeWidth={2.25}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return null;
}
