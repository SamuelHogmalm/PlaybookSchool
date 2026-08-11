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

export function pathToSvgD(points: Vec[]): string {
  if (!points.length) return "";
  return points.reduce(
    (d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
    "",
  );
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
