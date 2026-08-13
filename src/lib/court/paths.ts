import type { Vec } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";

export function shorten(
  a: Vec,
  b: Vec,
  padA = 16,
  padB = 16,
): [Vec, Vec] {
  const len = dist(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return [
    { x: a.x + ux * padA, y: a.y + uy * padA },
    { x: b.x - ux * padB, y: b.y - uy * padB },
  ];
}

export function squigglePath(a: Vec, b: Vec, amp = 7, waves = 6): string {
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

/** Straight segments between every point. Hit testing and tests want the raw shape. */
export function polylineToSvgD(points: Vec[]): string {
  if (!points.length) return "";
  return points.reduce(
    (d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
    "",
  );
}

/** Control points are derived, not data — round them so the `d` string stays readable. */
function ctrl(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A route as a smooth curve: Catmull-Rom through the points, emitted as cubic Béziers.
 *
 * Every consumer of a route calls this — the builder's committed arrows, the live draw
 * preview, and the animator's `RouteLayer` — so a drawn route and a played route are the
 * same curve rather than two renderings that happen to look similar.
 *
 * Catmull-Rom is an interpolating spline: the curve passes exactly through each point it
 * is given, so the first and last stay put. A smoothing scheme that only approximates its
 * control points would pull the arrow off the player it starts on.
 */
export function pathToSvgD(points: Vec[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    // Ends duplicate their neighbour, which makes the curve start and finish along the
    // drawn direction instead of overshooting past the endpoint.
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];

    const c1x = ctrl(p1.x + (p2.x - p0.x) / 6);
    const c1y = ctrl(p1.y + (p2.y - p0.y) / 6);
    const c2x = ctrl(p2.x - (p3.x - p1.x) / 6);
    const c2y = ctrl(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }

  return d;
}

export function pathArrowEnd(points: Vec[], pad = 15): Vec | null {
  if (!points.length) return null;
  if (points.length < 2) return points[0];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return shorten(a, b, 0, pad)[1];
}

/** Perpendicular bar segment centered on `at`, facing toward `toward`. */
export function perpendicularBar(
  at: Vec,
  toward: Vec,
  halfLen = 11,
): [Vec, Vec] {
  const len = dist(at, toward) || 1;
  const px = (-(toward.y - at.y) / len) * halfLen;
  const py = ((toward.x - at.x) / len) * halfLen;
  return [
    { x: at.x - px, y: at.y - py },
    { x: at.x + px, y: at.y + py },
  ];
}

/** T-bar perpendicular to travel direction, centered on route endpoint. */
export function perpendicularBarAtTravelEnd(
  from: Vec,
  at: Vec,
  halfLen = 11,
): [Vec, Vec] {
  const len = dist(from, at) || 1;
  const ux = (at.x - from.x) / len;
  const uy = (at.y - from.y) / len;
  const px = -uy * halfLen;
  const py = ux * halfLen;
  return [
    { x: at.x - px, y: at.y - py },
    { x: at.x + px, y: at.y + py },
  ];
}
