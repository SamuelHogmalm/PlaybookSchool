"use client";

import type { Action, Beat, PlayerId } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";

const W = 500;
const H = 470;

type Props = {
  beat: Beat;
  /** @deprecated use beat.startPos — kept for call-site compat */
  prev?: Beat | null;
  highlightActionId?: string;
};

function pathLine(a: { x: number; y: number }, b: { x: number; y: number }) {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function actionStroke(type: Action["type"], highlighted: boolean): string {
  if (highlighted) return "#ff2d55";
  if (type === "pass" || type === "handoff" || type === "dribble") return "#e8560f";
  if (type === "screen") return "#3e82c4";
  return "#c9a227";
}

export default function RepairBeatSvg({ beat, highlightActionId }: Props) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={320} height={300} style={{ border: "1px solid #ccc", background: "#16181c" }}>
      <rect x={0} y={0} width={W} height={H} fill="#16181c" />
      <rect x={170} y={0} width={160} height={190} fill="none" stroke="#6b7280" strokeWidth={1.5} />
      <circle cx={250} cy={52} r={197.5} fill="none" stroke="#6b7280" strokeWidth={1.5} />
      <line x1={0} y1={470} x2={500} y2={470} stroke="#6b7280" strokeWidth={2} />

      {beat.actions.map((action) => {
        const highlighted = action.id === highlightActionId;
        const stroke = actionStroke(action.type, highlighted);
        const sw = highlighted ? 4 : 2.5;
        const from = action.path?.[0] ?? beat.startPos[action.by as PlayerId];
        const to =
          action.path?.[action.path.length - 1] ??
          (action.type === "pass" || action.type === "handoff"
            ? beat.pos[action.for as PlayerId]
            : beat.pos[action.by as PlayerId]);

        if (!from || !to) return null;

        if (action.type === "pass" || action.type === "handoff") {
          return (
            <path
              key={action.id}
              d={pathLine(from, to)}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray="8 6"
              markerEnd="url(#arrow)"
            />
          );
        }

        const d = action.path?.length
          ? action.path.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
          : pathLine(from, to);

        return (
          <path
            key={action.id}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            markerEnd="url(#arrow)"
          />
        );
      })}

      {PLAYER_IDS.map((id) => {
        const p = beat.startPos[id];
        if (!p) return null;
        const holder = beat.startBall === id;
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={holder ? 14 : 11} fill={holder ? "#e8560f" : "#343840"} stroke="#edeae4" strokeWidth={1.5} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#edeae4" fontSize={12} fontFamily="monospace">
              {id}
            </text>
          </g>
        );
      })}

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#edeae4" />
        </marker>
      </defs>
    </svg>
  );
}
