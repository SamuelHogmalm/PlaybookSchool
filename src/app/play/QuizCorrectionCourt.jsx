"use client";

import { CourtSurface, Token, IDS } from "@/app/court/Court";

function pathToSvgD(points) {
  if (!points?.length) return "";
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

function strokeDash(tool) {
  if (tool === "pass") return "9 7";
  if (tool === "handoff") return "6 5";
  return undefined;
}

/** Shows the correct spot or route for ~2s before continuing the play. */
export default function QuizCorrectionCourt({
  frame,
  question,
  guess = null,
  highlightPlayer,
}) {
  if (!frame || !question) return null;

  const isFormation = question.kind === "formation";
  const isDraw = question.kind === "draw";
  const playerId = question.player ?? highlightPlayer;

  const correctRoute =
    isDraw && question.pathStart && question.target
      ? [question.pathStart, question.target]
      : null;

  return (
    <CourtSurface suffix="-fix" theme="paper">
      {IDS.map((id) => {
        const p = frame.pos?.[id];
        if (!p) return null;
        if (isFormation && id === playerId) return null;
        return (
          <Token
            key={id}
            id={id}
            p={p}
            hasBall={frame.ball === id}
            focus={id === playerId && isDraw}
            faded={isDraw && id !== playerId}
          />
        );
      })}

      {isDraw && correctRoute && (
        <path
          d={pathToSvgD(correctRoute)}
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeDasharray={strokeDash(question.expectedTool)}
          opacity="0.95"
        />
      )}

      {isFormation && question.target && (
        <>
          <circle
            cx={question.target.x}
            cy={question.target.y}
            r="14"
            fill="#22c55e"
            fillOpacity="0.3"
            stroke="#22c55e"
            strokeWidth="2.5"
          />
          <text
            x={question.target.x}
            y={question.target.y + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#166534"
          >
            ✓
          </text>
        </>
      )}

      {isFormation && guess && (
        <circle
          cx={guess.x}
          cy={guess.y}
          r="12"
          fill="#e8560f"
          fillOpacity="0.2"
          stroke="#e8560f"
          strokeWidth="2"
          opacity="0.7"
        />
      )}

      {isDraw && guess?.points?.length > 1 && (
        <path
          d={pathToSvgD(guess.points)}
          fill="none"
          stroke="#e8560f"
          strokeWidth="2"
          opacity="0.55"
        />
      )}

      <text x="250" y="28" textAnchor="middle" fontSize="11" fill="#22c55e" fontWeight="600">
        {isFormation ? "Your spot" : "Your route"}
      </text>
    </CourtSurface>
  );
}
