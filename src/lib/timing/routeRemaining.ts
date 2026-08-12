import type { Action, Beat, Vec } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";

import {
  easeInOutCut,
  easeInOutDribble,
  easeInRoll,
  easeOutScreen,
} from "./easing";
import { polylineLength, samplePolyline } from "./pathSample";
import { classifyAction } from "./sequence";
import type { TimedAction } from "./types";

const MIN_ROUTE_PX = 12;

function easeForAction(
  action: TimedAction,
  actions: Action[],
): (u: number) => number {
  const kind = classifyAction(action, actions);
  if (action.type === "screen") return easeOutScreen;
  if (action.type === "dribble") return easeInOutDribble;
  if (kind === "roll") return easeInRoll;
  return easeInOutCut;
}

/** Arc-length progress within an action window — matches positionsAt sampling. */
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

export function buildActionRoute(beat: Beat, action: Action): Vec[] {
  if (action.path && action.path.length >= 2) {
    return action.path.map((p) => ({ x: p.x, y: p.y }));
  }
  const start = beat.startPos[action.by];
  const end = beat.pos[action.by];
  if (!start || !end) return [];
  return [{ ...start }, { ...end }];
}

/**
 * Portion of a route not yet travelled at arc-length progress u ∈ [0, 1].
 * Uses the same polyline sampling as positionsAt so the line and token agree.
 */
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
