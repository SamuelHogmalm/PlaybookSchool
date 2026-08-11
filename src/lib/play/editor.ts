import type { PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";
import {
  COURT_HEIGHT,
  COURT_MARGIN,
  COURT_WIDTH,
} from "./geometry";

export const GRID_SIZE = 10;

export type AlignmentPresetName =
  | "Horns"
  | "4-out 1-in"
  | "5-out"
  | "Box"
  | "Stack"
  | "1-4 High";

export const ALIGNMENT_PRESETS: Record<
  AlignmentPresetName,
  Record<PlayerId, Vec>
> = {
  Horns: {
    "1": { x: 250, y: 400 },
    "2": { x: 40, y: 60 },
    "3": { x: 460, y: 60 },
    "4": { x: 180, y: 190 },
    "5": { x: 320, y: 190 },
  },
  "4-out 1-in": {
    "1": { x: 250, y: 380 },
    "2": { x: 60, y: 120 },
    "3": { x: 440, y: 120 },
    "4": { x: 120, y: 280 },
    "5": { x: 250, y: 200 },
  },
  "5-out": {
    "1": { x: 250, y: 380 },
    "2": { x: 60, y: 100 },
    "3": { x: 440, y: 100 },
    "4": { x: 120, y: 300 },
    "5": { x: 380, y: 300 },
  },
  Box: {
    "1": { x: 250, y: 380 },
    "2": { x: 180, y: 280 },
    "3": { x: 320, y: 280 },
    "4": { x: 180, y: 180 },
    "5": { x: 320, y: 180 },
  },
  Stack: {
    "1": { x: 250, y: 400 },
    "2": { x: 230, y: 320 },
    "3": { x: 270, y: 320 },
    "4": { x: 230, y: 240 },
    "5": { x: 270, y: 240 },
  },
  "1-4 High": {
    "1": { x: 250, y: 400 },
    "2": { x: 80, y: 140 },
    "3": { x: 420, y: 140 },
    "4": { x: 160, y: 140 },
    "5": { x: 340, y: 140 },
  },
};

export const PRESET_NAMES = Object.keys(
  ALIGNMENT_PRESETS,
) as AlignmentPresetName[];

export function copyPositions(
  src: Record<PlayerId, Vec>,
): Record<PlayerId, Vec> {
  const out = {} as Record<PlayerId, Vec>;
  for (const id of PLAYER_IDS) {
    out[id] = { x: src[id].x, y: src[id].y };
  }
  return out;
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(p: Vec): Vec {
  return { x: snapToGrid(p.x), y: snapToGrid(p.y) };
}

export function clampToCourt(p: Vec, margin = COURT_MARGIN): Vec {
  return {
    x: Math.max(margin, Math.min(COURT_WIDTH - margin, p.x)),
    y: Math.max(margin, Math.min(COURT_HEIGHT - margin, p.y)),
  };
}

export function snapClampPoint(p: Vec): Vec {
  return clampToCourt(snapPoint(p));
}

export function clientToCourt(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
): Vec {
  return {
    x: ((clientX - svgRect.left) / svgRect.width) * COURT_WIDTH,
    y: ((clientY - svgRect.top) / svgRect.height) * COURT_HEIGHT,
  };
}
