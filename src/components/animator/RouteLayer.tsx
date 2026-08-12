import type { Beat } from "@/lib/play/types";
import {
  actionDrawStyle,
  pathArrowEnd,
  pathToSvgD,
  perpendicularBarAtTravelEnd,
  shorten,
  squigglePath,
  type CourtPalette,
} from "@/lib/court";
import { markerUrl } from "@/components/court/CourtMarkers";
import {
  actionArcProgress,
  buildActionRoute,
  isMovement,
  routeRemaining,
  sequenceBeat,
  type Phase,
  type TimedAction,
} from "@/lib/timing";

type Props = {
  beat: Beat;
  beatT: number;
  phase: Phase;
  palette: CourtPalette;
  markerSuffix?: string;
};

function isMovementAction(action: TimedAction): boolean {
  return isMovement(action);
}

function renderRemainingRoute(
  action: TimedAction,
  beat: Beat,
  remaining: ReturnType<typeof routeRemaining>,
  palette: CourtPalette,
  markerSuffix: string,
  opacity: number,
) {
  if (remaining.length < 2) return null;

  const style = actionDrawStyle(action, palette, false);
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
    opacity,
    strokeDasharray: style.dashArray,
    markerEnd,
  };

  const from = remaining[0];
  const to = remaining[remaining.length - 1];

  if (action.type === "dribble") {
    if (remaining.length >= 3) {
      const end = pathArrowEnd(remaining);
      const trimmed = end ? remaining.slice(0, -1).concat([end]) : remaining;
      return <path d={pathToSvgD(trimmed)} {...common} />;
    }
    const [p, q] = shorten(from, to, 16, 16);
    return <path d={squigglePath(p, q)} {...common} />;
  }

  if (action.type === "cut") {
    if (remaining.length >= 3) {
      return <path d={pathToSvgD(remaining)} {...common} />;
    }
    return (
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...common} />
    );
  }

  if (action.type === "screen") {
    const travelFrom = remaining.length >= 2 ? remaining[0] : from;
    const [barA, barB] = perpendicularBarAtTravelEnd(travelFrom, to, 9);
    if (remaining.length >= 3) {
      return (
        <g opacity={opacity}>
          <path
            d={pathToSvgD(remaining)}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            markerEnd={cutMarker}
          />
          <line
            x1={barA.x}
            y1={barA.y}
            x2={barB.x}
            y2={barB.y}
            stroke={style.stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      );
    }
    return (
      <g opacity={opacity}>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          markerEnd={cutMarker}
        />
        <line
          x1={barA.x}
          y1={barA.y}
          x2={barB.x}
          y2={barB.y}
          stroke={style.stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return null;
}

export function RouteLayer({
  beat,
  beatT,
  phase,
  palette,
  markerSuffix = "",
}: Props) {
  const timed = sequenceBeat(beat);

  if (phase === "hold") {
    return (
      <g aria-hidden>
        {timed.filter(isMovementAction).map((action) => {
          const route = buildActionRoute(beat, action);
          return (
            <g key={`trail-${action.id}`}>
              {renderRemainingRoute(
                action,
                beat,
                route,
                palette,
                markerSuffix,
                0.25,
              )}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <g aria-hidden>
      {timed.map((action) => {
        if (action.type === "pass" || action.type === "handoff") {
          return null;
        }

        if (!isMovementAction(action)) return null;

        if (beatT < action.startAt || beatT > action.endAt) return null;

        const route = buildActionRoute(beat, action);
        const progress = actionArcProgress(beatT, action, beat.actions);
        const remaining = routeRemaining(route, progress);

        return (
          <g key={`route-${action.id}`}>
            {renderRemainingRoute(
              action,
              beat,
              remaining,
              palette,
              markerSuffix,
              0.9,
            )}
          </g>
        );
      })}
    </g>
  );
}
