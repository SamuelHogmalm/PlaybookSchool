"use client";

import { useCourtColors } from "@/app/court/Court";
import { routeRemainingAhead } from "@/lib/sequentialPlayback";

const MIN_DRAW_PX = 18;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathToSvgD(points) {
  if (!points?.length) return "";
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

function squigglePath(a, b, amp = 6, waves = 5) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i <= waves; i++) {
    const t1 = (i - 0.5) / waves;
    const t2 = i / waves;
    const s = (i % 2 ? 1 : -1) * amp;
    d += ` Q ${a.x + dx * t1 + px * s} ${a.y + dy * t1 + py * s} ${a.x + dx * t2} ${a.y + dy * t2}`;
  }
  return d;
}

function shorten(a, b, padA = 14, padB = 14) {
  const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return [
    { x: a.x + ux * padA, y: a.y + uy * padA },
    { x: b.x - ux * padB, y: b.y - uy * padB },
  ];
}

function isValidRoute(type, route) {
  if (!route?.length || route.length < 2) return false;
  const a = route[0];
  const b = route[route.length - 1];
  if (!a || !b || dist(a, b) < MIN_DRAW_PX) return false;
  if (type === "pass" || type === "handoff") return true;
  return true;
}

/**
 * One arrow per active step — pass lines only player-to-player.
 */
export default function ActiveRouteLayer({ activeRoute, activeRoutes, suffix = "" }) {
  const colors = useCourtColors();
  const routes = activeRoutes?.length ? activeRoutes : activeRoute ? [activeRoute] : [];
  if (!routes.length) return null;

  return (
    <>
      {routes.map((routeState, i) => (
        <ActiveRoute
          key={`${routeState.playerId ?? "p"}-${routeState.passTarget ?? ""}-${i}`}
          activeRoute={routeState}
          suffix={suffix}
          colors={colors}
        />
      ))}
    </>
  );
}

function ActiveRoute({ activeRoute, suffix, colors }) {
  const { type, route, progress } = activeRoute ?? {};
  if (!isValidRoute(type, route)) return null;

  const remaining = routeRemainingAhead(route, progress ?? 0);
  if (remaining.length < 2) return null;

  const [a, b] = [remaining[0], remaining[remaining.length - 1]];
  if (dist(a, b) < MIN_DRAW_PX) return null;

  const cutMarker = `url(#arrowCut${suffix})`;
  const ballMarker = `url(#arrowBall${suffix})`;

  if (type === "dribble") {
    return (
      <path
        d={squigglePath(a, b)}
        fill="none"
        stroke={colors.ball}
        strokeWidth="2.5"
        markerEnd={ballMarker}
        opacity="0.9"
      />
    );
  }

  if (type === "pass" || type === "handoff") {
    const [p, q] = shorten(a, b, 14, 16);
    return (
      <line
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={colors.ball}
        strokeWidth="2.5"
        strokeDasharray="8 6"
        markerEnd={ballMarker}
        opacity="0.9"
      />
    );
  }

  if (type === "screen") {
    const [p, q] = shorten(a, b, 12, 2);
    const len = Math.hypot(b.x - q.x, b.y - q.y) || 1;
    const px = (-(b.y - q.y) / len) * 12;
    const py = ((b.x - q.x) / len) * 12;
    return (
      <g opacity="0.9">
        <line x1={a.x} y1={a.y} x2={q.x} y2={q.y} stroke={colors.screen} strokeWidth="2.5" />
        <line
          x1={q.x - px}
          y1={q.y - py}
          x2={q.x + px}
          y2={q.y + py}
          stroke={colors.screen}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    );
  }

  const [p, q] = shorten(a, b, 12, 12);
  return (
    <line
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      stroke={colors.cut}
      strokeWidth="2.5"
      markerEnd={cutMarker}
      opacity="0.9"
    />
  );
}
