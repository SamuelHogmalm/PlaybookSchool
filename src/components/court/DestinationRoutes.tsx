import type { Beat, PlayerId, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import {
  IDLE_EPSILON,
  pathToSvgD,
  shorten,
  unexplainedTravel,
  type CourtPalette,
} from "@/lib/court";
import { dist } from "@/lib/play/geometry";

type Props = {
  beat: Beat;
  palette: CourtPalette;
  /** Show grab rings at each destination — move mode, where they can be dragged. */
  showHandles?: boolean;
  draggingPlayer?: PlayerId | null;
  /** Off when the tokens already stand at their destinations — the token is the label. */
  labelDestinations?: boolean;
};

/**
 * Where players end the beat, drawn the way the animator draws a route.
 *
 * This replaced a set of faded ghost tokens at `beat.pos`. A ghost said where a player
 * finishes but not how they get there, and for an idle player `pos` equals `startPos`,
 * so it sat under the live token and read as a rendering artefact.
 *
 * Players who already have a movement action are skipped — `ActionLayer` draws their
 * route, and a second line along the same path would just be heavier. What is left is
 * travel with no action to explain it, which is exactly what validation rule 9 objects
 * to, so drawing it makes the problem visible rather than hiding it behind a ghost.
 */
export function DestinationRoutes({
  beat,
  palette,
  showHandles = false,
  draggingPlayer = null,
  labelDestinations = true,
}: Props) {
  const routes = unexplainedTravel(beat);

  // Every player is draggable in move mode, including those standing still.
  const handles: Array<{ id: PlayerId; at: Vec }> = showHandles
    ? PLAYER_IDS.flatMap((id) =>
        beat.pos[id] ? [{ id, at: beat.pos[id] }] : [],
      )
    : [];

  /**
   * Anyone who finishes somewhere other than where they started.
   *
   * Wider than `routes`, which deliberately skips players whose arrow `ActionLayer`
   * already draws — but those are exactly the players a coach needs to aim a pass at,
   * so they still need a marker saying who ends up here.
   */
  const moved: Array<{ id: PlayerId; to: Vec }> = PLAYER_IDS.flatMap((id) => {
    const from = beat.startPos[id];
    const to = beat.pos[id];
    if (!from || !to || dist(from, to) < IDLE_EPSILON) return [];
    return [{ id, to }];
  });

  if (!routes.length && !handles.length && !moved.length) return null;

  return (
    <g style={{ pointerEvents: "none" }}>
      {routes.map(({ id, from, to }) => {
        const [p, q] = shorten(from, to, 15, 9);
        return (
          <path
            key={`dest-route-${id}`}
            d={pathToSvgD([p, q])}
            fill="none"
            stroke={palette.muted}
            strokeWidth={1.75}
            strokeDasharray="5 5"
            opacity={0.7}
          />
        );
      })}

      {handles.map(({ id, at }) => {
        const active = draggingPlayer === id;
        return (
          <circle
            key={`dest-handle-${id}`}
            cx={at.x}
            cy={at.y}
            r={active ? 9 : 7}
            fill="none"
            stroke={active ? palette.ok : palette.muted}
            strokeWidth={active ? 2 : 1.5}
            opacity={active ? 0.95 : 0.6}
          />
        );
      })}

      {/*
        Numbered, because a bare ring is not a target. A coach passing to a player who
        has already cut needs to see *which* player finishes there — otherwise they aim
        at where the token still is and the pass finds nobody.
      */}
      {labelDestinations && moved.map(({ id, to }) => (
        <g key={`dest-label-${id}`} opacity={0.75}>
          <circle
            cx={to.x}
            cy={to.y}
            r="12"
            fill={palette.wood}
            stroke={palette.muted}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={to.x}
            y={to.y + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={palette.muted}
            style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}
          >
            {id}
          </text>
        </g>
      ))}
    </g>
  );
}
