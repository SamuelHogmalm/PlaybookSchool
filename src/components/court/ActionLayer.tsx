import type { Action, Beat } from "@/lib/play/types";
import {
  actionDrawStyle,
  pathArrowEnd,
  pathToSvgD,
  perpendicularBar,
  resolveActionEndpoints,
  shorten,
  squigglePath,
  type CourtPalette,
} from "@/lib/court";
import { markerUrl } from "./CourtMarkers";

type Props = {
  beat: Beat;
  palette: CourtPalette;
  markerSuffix?: string;
  highlightActionId?: string;
};

function renderAction(
  beat: Beat,
  action: Action,
  palette: CourtPalette,
  markerSuffix: string,
  highlightActionId?: string,
) {
  const endpoints = resolveActionEndpoints(beat, action);
  if (!endpoints) return null;

  const highlighted = action.id === highlightActionId;
  const style = actionDrawStyle(action, palette, highlighted);
  const cutMarker = markerUrl("cut", markerSuffix);
  const ballMarker = markerUrl("ball", markerSuffix);
  const markerEnd =
    style.markerEnd === "ball"
      ? ballMarker
      : style.markerEnd === "cut"
        ? cutMarker
        : undefined;

  const common = {
    fill: "none" as const,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    strokeDasharray: style.dashArray,
    markerEnd,
  };

  const { route, from, to, target } = endpoints;

  if (action.type === "dribble") {
    if (route.length >= 3) {
      const end = pathArrowEnd(route);
      const trimmed = end ? route.slice(0, -1).concat([end]) : route;
      return <path key={action.id} d={pathToSvgD(trimmed)} {...common} />;
    }
    const [p, q] = shorten(from, to, 16, 16);
    return <path key={action.id} d={squigglePath(p, q)} {...common} />;
  }

  if (action.type === "cut") {
    if (route.length >= 3) {
      const end = pathArrowEnd(route);
      const trimmed = end ? route.slice(0, -1).concat([end]) : route;
      return <path key={action.id} d={pathToSvgD(trimmed)} {...common} />;
    }
    const [p, q] = shorten(from, to, 15, 15);
    return <line key={action.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} {...common} />;
  }

  if (action.type === "pass") {
    if (route.length >= 3) {
      const end = pathArrowEnd(route);
      const trimmed = end ? route.slice(0, -1).concat([end]) : route;
      return <path key={action.id} d={pathToSvgD(trimmed)} {...common} />;
    }
    const [p, q] = shorten(from, to, 16, 18);
    return <line key={action.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} {...common} />;
  }

  if (action.type === "screen") {
    const barTarget = target ?? to;
    const [barA, barB] = perpendicularBar(to, barTarget, style.strokeWidth >= 2 ? 11 : 8);
    const [p, q] =
      route.length >= 3
        ? [route[0], route[route.length - 1]]
        : shorten(from, to, 15, 2);
    return (
      <g key={action.id} opacity={style.opacity}>
        {route.length >= 3 ? (
          <path
            d={pathToSvgD(route)}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
          />
        ) : (
          <line
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
          />
        )}
        <line
          x1={barA.x}
          y1={barA.y}
          x2={barB.x}
          y2={barB.y}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth >= 2 ? 2.5 : 1.75}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (action.type === "handoff") {
    const barTarget = target ?? to;
    const [barA, barB] = perpendicularBar(to, barTarget, 7);
    const [p, q] = shorten(from, to, 14, 4);
    return (
      <g key={action.id} opacity={style.opacity}>
        <line
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.dashArray}
        />
        <line
          x1={barA.x}
          y1={barA.y}
          x2={barB.x}
          y2={barB.y}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth >= 2 ? 2.25 : 1.5}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return null;
}

export function ActionLayer({
  beat,
  palette,
  markerSuffix = "",
  highlightActionId,
}: Props) {
  if (!beat.actions.length) return null;

  return (
    <g style={{ pointerEvents: "none" }}>
      {beat.actions.map((action) =>
        renderAction(beat, action, palette, markerSuffix, highlightActionId),
      )}
    </g>
  );
}
