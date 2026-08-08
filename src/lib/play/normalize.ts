import type { Action, ActionType, Beat, Play, PlayerId, SeedPlay } from "./types";
import { ACTION_TYPES, PLAYER_IDS } from "./types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function asPlayerId(value: string, field: string): PlayerId {
  if (!PLAYER_IDS.includes(value as PlayerId)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value as PlayerId;
}

function asActionType(value: string): ActionType {
  if (!ACTION_TYPES.includes(value as ActionType)) {
    throw new Error(`Invalid action type: ${value}`);
  }
  return value as ActionType;
}

function readPositions(
  raw: SeedPlay["beats"][number],
  key: "startPos" | "pos",
): Record<PlayerId, { x: number; y: number }> {
  const out = {} as Record<PlayerId, { x: number; y: number }>;
  const source =
    key === "startPos"
      ? raw.startPos ?? raw.pos
      : raw.pos ?? raw.startPos;
  for (const id of PLAYER_IDS) {
    const p = source?.[id];
    if (p) out[id] = { x: p.x, y: p.y };
  }
  return out;
}

function normalizeBeat(raw: SeedPlay["beats"][number], next?: SeedPlay["beats"][number]): Beat {
  const startPos = readPositions(raw, "startPos");
  let pos = readPositions(raw, "pos");
  if (next?.startPos) {
    pos = readPositions(next, "startPos");
  } else if (next?.pos && !raw.startPos) {
    pos = readPositions(next, "pos");
  }

  const actions: Action[] = (raw.actions ?? []).map((a) => {
    const action: Action = {
      id: a.id,
      type: asActionType(a.type),
      by: asPlayerId(String(a.by), "action.by"),
    };
    if (a.for != null) action.for = asPlayerId(String(a.for), "action.for");
    if (a.path?.length) action.path = a.path.map((p) => ({ x: p.x, y: p.y }));
    if (a.derived) action.derived = true;
    if (a.needsReview) action.needsReview = true;
    if (a.reason) action.reason = a.reason;
    return action;
  });

  const startBall = raw.startBall ?? raw.ball;

  return {
    id: raw.id,
    startPos,
    pos,
    startBall: asPlayerId(String(startBall), "beat.startBall"),
    ball: asPlayerId(String(raw.ball), "beat.ball"),
    actions,
  };
}

/** Map seed JSON (beats key) to canonical Play. */
export function normalizeSeedPlay(raw: SeedPlay, teamId = "seed"): Play {
  const now = new Date().toISOString();
  const beatsRaw = raw.beats ?? [];
  return {
    id: slugify(raw.name),
    teamId,
    name: raw.name,
    category: raw.category ?? "Set",
    beats: beatsRaw.map((b, i) => normalizeBeat(b, beatsRaw[i + 1])),
    version: 1,
    valid: false,
    validationErrors: [],
    createdAt: now,
    updatedAt: now,
  };
}
