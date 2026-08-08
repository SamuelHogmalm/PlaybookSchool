export type Vec = { x: number; y: number };

export type PlayerId = "1" | "2" | "3" | "4" | "5";

export type ActionType = "cut" | "dribble" | "pass" | "screen" | "handoff";

export type Action = {
  id: string;
  type: ActionType;
  by: PlayerId;
  for?: PlayerId;
  path?: Vec[];
  startAt?: number;
  endAt?: number;
  derived?: boolean;
  needsReview?: boolean;
  reason?: string;
};

export type Beat = {
  id: string;
  /** Token positions at start of this frame (parser observation). */
  startPos: Record<PlayerId, Vec>;
  /** Token positions at end of beat (= next frame startPos). */
  pos: Record<PlayerId, Vec>;
  /** Circled number at frame start (parser observation). */
  startBall: PlayerId;
  /** Possession at end of beat (derived by deriveBall). */
  ball: PlayerId;
  actions: Action[];
  durationMs?: number;
};

export type Play = {
  id: string;
  teamId: string;
  name: string;
  category: string;
  folderId?: string;
  beats: Beat[];
  version: number;
  valid: boolean;
  validationErrors: string[];
  createdAt: string;
  updatedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/** Raw shape in src/data/plays-interpreted.json (seed import). */
export type SeedPlay = {
  name: string;
  category?: string;
  beats: Array<{
    id: string;
    startPos?: Record<string, Vec>;
    pos: Record<string, Vec>;
    startBall?: string;
    ball: string;
    actions?: Array<{
      id: string;
      type: string;
      by: string;
      for?: string;
      path?: Vec[];
      derived?: boolean;
      needsReview?: boolean;
      reason?: string;
    }>;
    note?: string;
  }>;
};

export const PLAYER_IDS: PlayerId[] = ["1", "2", "3", "4", "5"];

export const ACTION_TYPES: ActionType[] = [
  "cut",
  "dribble",
  "pass",
  "screen",
  "handoff",
];
