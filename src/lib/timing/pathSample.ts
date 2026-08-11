import type { Vec } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";

export function polylineLength(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

/** Sample a polyline at arc-length fraction u ∈ [0, 1]. */
export function samplePolyline(points: Vec[], u: number): Vec {
  if (!points.length) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  const clamped = Math.max(0, Math.min(1, u));
  const total = polylineLength(points);
  if (total === 0) return { ...points[0] };

  let target = total * clamped;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (target <= seg) {
      const f = seg === 0 ? 0 : target / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * f,
      };
    }
    target -= seg;
  }
  return { ...points[points.length - 1] };
}

export function lerpVec(a: Vec, b: Vec, u: number): Vec {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
  };
}
