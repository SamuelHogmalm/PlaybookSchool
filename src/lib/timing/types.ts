import type { Action, PlayerId, Play, Vec } from "@/lib/play/types";

export type Phase = "move" | "hold";

export type PositionsSnapshot = {
  players: Record<PlayerId, Vec>;
  ball: Vec;
  possession: PlayerId;
  ballInFlight: boolean;
};

export type TimedAction = Action & {
  startAt: number;
  endAt: number;
};

export type SequencedBeat = {
  beatIndex: number;
  durationMs: number;
  actions: TimedAction[];
};

export type TimelineFrame = {
  beatIndex: number;
  phase: Phase;
  /** 0–1 within the move phase; 0 during hold. */
  t: number;
  done: boolean;
};

export type PlayTimelineContext = {
  play: Play;
  from: number;
  to: number;
};
