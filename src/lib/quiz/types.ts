import type { PlayerId, Vec } from "@/lib/play/types";

export type QuestionType =
  | "spot"
  | "draw"
  | "identify"
  | "next-action"
  | "pass-target"
  | "sequence";

/**
 * The four phases every question runs through, in order.
 *
 * REVEAL always runs, right or wrong — repetition is the product, and a correct answer
 * earns the rep too.
 */
export type QuizPhase = "lead-in" | "ask" | "reveal" | "result";

type QuestionBase = {
  id: string;
  playId: string;
  playName: string;
  type: QuestionType;
  /** Lead-in animates beats 0 → askAtBeat, then freezes here. */
  askAtBeat: number;
  /** Reveal animates askAtBeat → revealToBeat with the answer drawn. */
  revealToBeat: number;
  prompt: string;
  /** Player the question is about, where it has one. */
  subject?: PlayerId;
};

export type Choice = {
  id: string;
  label: string;
  /** Player this choice names, for highlighting on the court during reveal. */
  playerId?: PlayerId;
};

/** Tap where you belong. The subject's token is hidden during ASK. */
export type SpotQuestion = QuestionBase & {
  type: "spot";
  subject: PlayerId;
  answer: Vec;
  /** Correct within this many court units. Loose on purpose. */
  tolerance: number;
};

/** Multiple choice: who gets the ball, what happens next, which play is this. */
export type ChoiceQuestion = QuestionBase & {
  type: "pass-target" | "next-action" | "identify";
  choices: Choice[];
  answerId: string;
};

export type Question = SpotQuestion | ChoiceQuestion;

export type Answer =
  | { kind: "point"; at: Vec }
  | { kind: "choice"; choiceId: string };

export type Grade = {
  correct: boolean;
  /** How far off a spot answer was, in court units. Absent for choices. */
  distance?: number;
  /** What should have been answered, for the reveal. */
  expected: string;
};

export function isSpot(q: Question): q is SpotQuestion {
  return q.type === "spot";
}

export function isChoice(q: Question): q is ChoiceQuestion {
  return q.type !== "spot";
}
