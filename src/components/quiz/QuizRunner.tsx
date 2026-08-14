"use client";

import { useCallback, useMemo, useState } from "react";

import type { Play, Vec } from "@/lib/play/types";
import {
  gradeAnswer,
  isSpot,
  type Answer,
  type Grade,
  type Question,
  type QuizPhase,
} from "@/lib/quiz";

import { QuizCourt } from "./QuizCourt";

type Props = {
  questions: Question[];
  playsById: Map<string, Play>;
  onFinished?: (results: Array<{ question: Question; grade: Grade }>) => void;
};

/**
 * Runs a session: LEAD-IN → ASK → REVEAL → RESULT, once per question.
 *
 * REVEAL always runs, right or wrong. Repetition is the product — a correct answer
 * earns the rep too, and a wrong one has to see what it should have been.
 */
export function QuizRunner({ questions, playsById, onFinished }: Props) {
  const [index, setIndex] = useState(0);
  const question = questions[index];

  // A question at beat 0 has nothing to lead in with.
  const openingPhase = useCallback(
    (q: Question): QuizPhase => (q.askAtBeat > 0 ? "lead-in" : "ask"),
    [],
  );

  const [phase, setPhase] = useState<QuizPhase>(() =>
    questions.length ? openingPhase(questions[0]) : "result",
  );
  const [guess, setGuess] = useState<Vec | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [results, setResults] = useState<
    Array<{ question: Question; grade: Grade }>
  >([]);
  /** Bumped to restart playback without changing phase — "watch again". */
  const [replay, setReplay] = useState(0);

  const play = question ? playsById.get(question.playId) : undefined;

  const answered = grade !== null;
  const score = results.filter((r) => r.grade.correct).length;

  const submit = useCallback(
    (answer: Answer) => {
      if (!question || answered) return;
      const result = gradeAnswer(question, answer);
      setGrade(result);
      setResults((prev) => [...prev, { question, grade: result }]);
      setPhase("reveal");
    },
    [question, answered],
  );

  const next = useCallback(() => {
    const following = index + 1;
    if (following >= questions.length) {
      onFinished?.(results);
      setPhase("result");
      setIndex(following);
      return;
    }
    setIndex(following);
    setGuess(null);
    setGrade(null);
    setReplay(0);
    setPhase(openingPhase(questions[following]));
  }, [index, questions, results, onFinished, openingPhase]);

  const finished = index >= questions.length;

  const summary = useMemo(
    () => ({
      total: questions.length,
      correct: results.filter((r) => r.grade.correct).length,
    }),
    [questions.length, results],
  );

  if (!questions.length) {
    return (
      <p className="text-sm text-stone-400">
        No questions available. Every play in the book needs to validate first.
      </p>
    );
  }

  if (finished) {
    return (
      <section className="space-y-4" role="status">
        <h2 className="text-xl font-semibold">
          {summary.correct} of {summary.total}
        </h2>
        <p className="text-sm text-stone-400">
          {summary.correct === summary.total
            ? "Clean sheet."
            : "The ones you missed will come round again sooner."}
        </p>
        <ul className="space-y-1 text-sm">
          {results.map(({ question: q, grade: g }) => (
            <li key={q.id} className="flex gap-2">
              <span aria-hidden="true">{g.correct ? "✓" : "✗"}</span>
              <span className={g.correct ? "text-emerald-300" : "text-red-300"}>
                {q.playName} — {q.prompt}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!play) {
    return (
      <p className="text-sm text-red-300">
        Play <code>{question.playId}</code> is missing from this session.
      </p>
    );
  }

  const spot = isSpot(question);
  const showAnswer = phase === "reveal" || phase === "result";

  // Lead-in stops before the asked beat, or the answer plays out before the question.
  const leadIn = phase === "lead-in";
  const from = leadIn ? 0 : question.askAtBeat;
  const to = leadIn
    ? Math.max(0, question.askAtBeat - 1)
    : showAnswer
      ? question.revealToBeat
      : question.askAtBeat;

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-stone-400">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-sm text-stone-500">
          {score} right so far
        </p>
      </header>

      <div
        className="h-1 w-full overflow-hidden rounded bg-stone-800"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <QuizCourt
        play={play}
        from={from}
        to={to}
        playing={leadIn || phase === "reveal"}
        // The whole point of a spot question is that they cannot see the answer.
        hidePlayer={spot && !showAnswer ? question.subject : null}
        onComplete={() => setPhase(leadIn ? "ask" : "result")}
        onPick={spot && phase === "ask" ? (at) => {
          setGuess(at);
          submit({ kind: "point", at });
        } : undefined}
        guess={spot ? guess : null}
        answer={spot && showAnswer ? question.answer : null}
        runKey={`${question.id}-${phase}-${replay}`}
      />

      <div aria-live="polite" className="space-y-3">
        {phase === "lead-in" && (
          <p className="text-sm text-stone-400">Watch — {question.playName}</p>
        )}

        {phase === "ask" && (
          <>
            <p className="font-medium">{question.prompt}</p>
            {spot ? (
              <p className="text-sm text-stone-400">
                Tap the court where player {question.subject} belongs.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {question.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => submit({ kind: "choice", choiceId: choice.id })}
                    className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
            {question.askAtBeat > 0 && (
              <button
                type="button"
                onClick={() => {
                  setReplay((n) => n + 1);
                  setPhase("lead-in");
                }}
                className="text-sm text-stone-400 underline underline-offset-4 hover:text-stone-200"
              >
                Watch again
              </button>
            )}
          </>
        )}

        {phase === "reveal" && (
          <p className="text-sm text-stone-400">Here&rsquo;s what happens…</p>
        )}

        {phase === "result" && grade && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              grade.correct
                ? "border-emerald-700 bg-emerald-950/30 text-emerald-100"
                : "border-red-800 bg-red-950/30 text-red-100"
            }`}
          >
            <p className="font-medium">
              {grade.correct ? "Right" : "Not quite"}
            </p>
            <p className="mt-1 opacity-90">{grade.expected}</p>
            {grade.distance !== undefined && !grade.correct && (
              <p className="mt-1 opacity-75">
                You were {Math.round(grade.distance)} units off — within{" "}
                {isSpot(question) ? question.tolerance : 0} counts.
              </p>
            )}
            <button
              type="button"
              onClick={next}
              className="mt-3 rounded border border-stone-500 px-4 py-1.5 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {index + 1 >= questions.length ? "See your score" : "Next"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
