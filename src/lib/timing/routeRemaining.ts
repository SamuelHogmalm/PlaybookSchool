import type { Action, Vec } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";

import { polylineLength, samplePolyline } from "./pathSample";
import { easeForAction } from "./positionsAt";
import type { TimedAction } from "./types";

const MIN_ROUTE_PX = 12;

/** Arc-length progress within an action window. */
export function actionArcProgress(
  beatT: number,
  action: TimedAction,
  actions: Action[],
): number {
  if (beatT <= action.startAt) return 0;
  if (beatT >= action.endAt) return 1;
  const local = (beatT - action.startAt) / (action.endAt - action.startAt);
  return easeForAction(action, actions)(local);
}

/** Portion of a route not yet travelled at arc-length progress u ∈ [0, 1]. */
export function routeRemaining(route: Vec[], progress: number): Vec[] {
  if (!route?.length || route.length < 2) return [];

  const u = Math.max(0, Math.min(1, progress));
  if (u >= 1) return [];
  if (u <= 0) return route.map((p) => ({ x: p.x, y: p.y }));

  const head = samplePolyline(route, u);
  const end = route[route.length - 1];
  if (dist(head, end) < MIN_ROUTE_PX * 0.5) return [];

  const total = polylineLength(route);
  let target = total * u;

  for (let i = 1; i < route.length; i++) {
    const segLen = dist(route[i - 1], route[i]);
    if (target <= segLen + 1e-6) {
      const out: Vec[] = [{ ...head }];
      for (let j = i; j < route.length; j++) {
        out.push({ x: route[j].x, y: route[j].y });
      }
      return out.length >= 2 ? out : [];
    }
    target -= segLen;
  }

  return [];
}
