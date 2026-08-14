import { dist } from "@/lib/play/geometry";

import type { Answer, Grade, Question } from "./types";
import { isSpot } from "./types";

/**
 * Grade one answer. Pure — no session state, no storage, no clock.
 *
 * `expected` is filled in on every grade, right or wrong, because the reveal always
 * runs and always shows the correct answer.
 */
export function gradeAnswer(question: Question, answer: Answer): Grade {
  if (isSpot(question)) {
    if (answer.kind !== "point") {
      return { correct: false, expected: describeExpected(question) };
    }
    const distance = dist(answer.at, question.answer);
    return {
      correct: distance <= question.tolerance,
      distance,
      expected: describeExpected(question),
    };
  }

  if (answer.kind !== "choice") {
    return { correct: false, expected: describeExpected(question) };
  }

  return {
    correct: answer.choiceId === question.answerId,
    expected: describeExpected(question),
  };
}

/** Human-readable correct answer, for the result panel. */
export function describeExpected(question: Question): string {
  if (isSpot(question)) {
    return `Player ${question.subject} belongs at ${Math.round(
      question.answer.x,
    )}, ${Math.round(question.answer.y)}`;
  }
  const answer = question.choices.find((c) => c.id === question.answerId);
  return answer?.label ?? question.answerId;
}
