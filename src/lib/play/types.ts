export type Vec = { x: number; y: number };

export type PlayerId = "1" | "2" | "3" | "4" | "5";

export type ActionType = "cut" | "dribble" | "pass" | "screen" | "handoff";

export type Action = {
  id: string;
  type: ActionType;
  by: PlayerId;
  for?: PlayerId;
  path?: Vec[];
  /**
   * Which step of the beat this action belongs to. 1-based.
   *
   * Actions sharing a step run together; steps run one after another. This is the
   * coach saying "these two cut at the same time" — it is grouping, not timing, and
   * the engine still decides the actual milliseconds.
   *
   * Absent on every action means the beat has no steps and falls back to the derived
   * lanes. Imported plays arrive that way until someone reviews them.
   */
  step?: number;
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
  /** Non-blocking issues (e.g. AI misreads flagged for review). */
  warnings: string[];
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
      step?: number;
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
