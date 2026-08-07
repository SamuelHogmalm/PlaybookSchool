"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { IDS, CourtSurface, Token, toSvg } from "@/app/court/Court";
import QuizRevealCourt from "@/app/play/QuizRevealCourt";
import QuizWatchCourt from "@/app/play/QuizWatchCourt";
import QuizPlayClip from "@/app/play/QuizPlayClip";
import QuizContextCourt from "@/app/play/QuizContextCourt";
import QuizCorrectionCourt from "@/app/play/QuizCorrectionCourt";
import QuizSequentialCourt from "@/app/play/QuizSequentialCourt";
import { LINE_TOOLS, sampleStroke, clampCourt } from "@/lib/playModel";
import {
  generateFlashcardDeck,
  QUIZ_CATEGORIES,
  CATEGORY_ORDER,
  POS_NAME,
  summarizeSession,
  formatMcOptions,
  scoreSpot,
  scoreDrawAnswer,
  SPOT_TOLERANCE,
  needsWatchIntro,
  getQuizWatchStopBeat,
  QUIZ_WATCH_SPEED,
  QUIZ_FULL_PLAY_SPEED,
  questionBeatRange,
} from "@/lib/quiz";
import {
  generateDailyQuizDeck,
  DAILY_QUIZ_CATEGORIES,
  DAILY_CATEGORY_ORDER,
  getTodayQuizLabel,
} from "@/lib/dailyQuiz";
import { useQuizProgress } from "@/hooks/useQuizProgress";
import { enrichPlayForQuiz } from "@/lib/playData";
import { questionHeadline, needsManualWatchStart, QUESTION_READ_MS, needsContextPhase, contextHeadline, watchHeadline, CONTEXT_READ_MS, CORRECTION_READ_MS } from "@/lib/quizInstructions";
import QuizProgressBar from "@/components/player/QuizProgressBar";

function pathToSvgD(points) {
  if (!points?.length) return "";
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

function CategoryBadge({ category, active = false, categories = QUIZ_CATEGORIES }) {
  const meta = categories[category];
  if (!meta) return null;
  return (
    <span
      className={`font-data text-[10px] uppercase tracking-widest px-2 py-1 border ${
        active ? "border-jersey text-jersey bg-jersey/10" : "border-rule text-ink-soft"
      }`}
    >
      {meta.short}
    </span>
  );
}

export default function PlayerQuizSession({
  play,
  plays,
  myId: initialMyId = "4",
  onExit,
  maxQuestions = 10,
  variant,
}) {
  const isDaily = variant === "daily" || (Array.isArray(plays) && plays.length > 0 && !play);
  const categoryMap = isDaily ? DAILY_QUIZ_CATEGORIES : QUIZ_CATEGORIES;
  const categoryOrder = isDaily ? DAILY_CATEGORY_ORDER : CATEGORY_ORDER;
  const [myId, setMyId] = useState(initialMyId);
  const [phase, setPhase] = useState("idle");
  const [deck, setDeck] = useState([]);
  const [n, setN] = useState(0);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [revealDone, setRevealDone] = useState(false);
  const [prefaceDone, setPrefaceDone] = useState(false);
  const [contextDone, setContextDone] = useState(false);
  const [contextAnimDone, setContextAnimDone] = useState(false);
  const [correctionDone, setCorrectionDone] = useState(false);
  const [results, setResults] = useState([]);
  const [lineTool, setLineTool] = useState(null);
  const [draftPoints, setDraftPoints] = useState([]);
  const [progressTick, setProgressTick] = useState(0);
  const [watchStarted, setWatchStarted] = useState(false);
  const { progress, ready, modeLabel, isDemo, recordAttempt } = useQuizProgress(myId);

  const svgRef = useRef(null);
  const drawing = useRef(false);
  const strokeRef = useRef([]);

  const quizPlay = useMemo(() => (play ? enrichPlayForQuiz(play) : null), [play]);

  const preview = useMemo(() => {
    if (!ready) {
      return {
        deck: [],
        buckets: {},
        available: [],
        weakSummary: { hasHistory: false },
        reviewCount: 0,
        seed: 0,
      };
    }
    if (isDaily) return generateDailyQuizDeck(plays, myId, { maxCards: maxQuestions, progress });
    if (!quizPlay) return { deck: [], buckets: {}, available: [] };
    return generateFlashcardDeck(quizPlay, myId, { maxCards: maxQuestions });
  }, [isDaily, plays, quizPlay, myId, maxQuestions, progress, ready, progressTick]);

  const resetQuestion = useCallback(() => {
    setGuess(null);
    setResult(null);
    setRevealDone(false);
    setPrefaceDone(false);
    setContextDone(false);
    setContextAnimDone(false);
    setCorrectionDone(false);
    setWatchStarted(false);
    setLineTool(null);
    setDraftPoints([]);
    drawing.current = false;
    strokeRef.current = [];
  }, []);

  const begin = () => {
    if (isDaily) {
      if (!plays?.length) {
        setPhase("empty");
        return;
      }
      const { deck: cards } = generateDailyQuizDeck(plays, myId, {
        maxCards: maxQuestions,
        progress,
      });
      setDeck(cards);
      setN(0);
      setResults([]);
      resetQuestion();
      setPhase(cards.length ? "active" : "empty");
      return;
    }
    if (!play?.frames?.length) {
      setPhase("empty");
      return;
    }
    const { deck: cards } = generateFlashcardDeck(quizPlay, myId, { maxCards: maxQuestions });
    setDeck(cards);
    setN(0);
    setResults([]);
    resetQuestion();
    setPhase(cards.length ? "active" : "empty");
  };

  const q = deck[n];
  const activePlay = q?.play ?? quizPlay ?? play;
  const beatRange =
    q && activePlay?.frames?.length ? questionBeatRange(q, activePlay.frames.length) : null;
  const showFrame = q?.showFrame ?? q?.from;
  const catMeta = q ? categoryMap[q.category] : null;

  const isFormation = q?.kind === "formation";
  const isDraw = q?.kind === "draw";
  const isInteractive = isFormation || isDraw;
  const isWatchKind = q?.kind === "watch";
  const isMc = q?.kind === "mc";
  const needsWatch = q && needsWatchIntro(q) && result === null;
  const needsContext = q && needsContextPhase(q) && result === null;
  const showAnswerUi = (!needsWatch || prefaceDone) && (!needsContext || contextDone);

  const playLabel = q?.playName ?? activePlay?.name;
  const showingQuestion = showAnswerUi && result === null;
  const headline =
    result !== null || showingQuestion
      ? questionHeadline(q)
      : needsWatch && !prefaceDone
        ? watchHeadline(q)
        : questionHeadline(q);
  const manualWatch = needsManualWatchStart(headline);
  const waitingToWatch = needsWatch && !prefaceDone && !watchStarted;
  const watching = needsWatch && !prefaceDone && watchStarted;
  const watchStopBeat = getQuizWatchStopBeat(q);

  useEffect(() => {
    if (!needsWatch || prefaceDone || watchStarted || manualWatch) return;
    const t = setTimeout(() => setWatchStarted(true), QUESTION_READ_MS);
    return () => clearTimeout(t);
  }, [needsWatch, prefaceDone, watchStarted, manualWatch, n, q?.id]);

  useEffect(() => {
    if (!prefaceDone || contextDone) return;
    if (!needsContextPhase(q)) {
      setContextDone(true);
      return;
    }
    if (q?.frameIdx >= 2 && !contextAnimDone) return;
    const t = setTimeout(() => setContextDone(true), CONTEXT_READ_MS);
    return () => clearTimeout(t);
  }, [prefaceDone, contextDone, contextAnimDone, n, q?.id, q?.frameIdx]);

  useEffect(() => {
    if (result !== false || correctionDone || !isInteractive) return;
    const t = setTimeout(() => setCorrectionDone(true), CORRECTION_READ_MS);
    return () => clearTimeout(t);
  }, [result, correctionDone, isInteractive, n]);

  const options = useMemo(() => {
    if (!q || (!isMc && !isWatchKind)) return [];
    return formatMcOptions(q.correct, q.options ?? []);
  }, [q, isMc, isWatchKind]);

  const allowedTools = useMemo(() => {
    if (!isDraw || !q?.allowedTools) return [];
    return LINE_TOOLS.filter((t) => q.allowedTools.includes(t.id));
  }, [isDraw, q]);

  const courtPoint = (e) => {
    if (!svgRef.current) return null;
    return clampCourt(toSvg(svgRef.current, e));
  };

  const onCourtDown = (e) => {
    if (result !== null) return;
    if (isFormation) {
      setGuess(toSvg(svgRef.current, e));
      return;
    }
    if (!isDraw || !lineTool) return;
    const p = courtPoint(e);
    if (!p) return;
    drawing.current = true;
    strokeRef.current = [p];
    setDraftPoints([p]);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onCourtMove = (e) => {
    if (!drawing.current || !isDraw) return;
    const p = courtPoint(e);
    if (!p) return;
    const last = strokeRef.current[strokeRef.current.length - 1];
    const added = sampleStroke(last, p);
    if (!added.length) return;
    strokeRef.current = [...strokeRef.current, ...added];
    setDraftPoints([...strokeRef.current]);
  };

  const onCourtUp = () => {
    if (!drawing.current || !isDraw) return;
    drawing.current = false;
    const points = strokeRef.current;
    if (points.length >= 2) {
      setGuess({ tool: lineTool, points: [...points] });
    }
  };

  const submitAnswer = useCallback(
    (answerOverride) => {
      const g = answerOverride ?? guess;
      if (g == null || !q) return;
      if (needsWatchIntro(q) && result === null && !prefaceDone) return;
      if (needsContextPhase(q) && result === null && !contextDone) return;

      let right = false;
      if (isFormation) right = scoreSpot(g, q.target);
      else if (isDraw) right = scoreDrawAnswer(g, q);
      else right = g === q.correct;

      setGuess(g);
      setResult(right);
      setCorrectionDone(false);
      const needsReveal =
        isInteractive ||
        (!right && (q.frameIdx != null || q.watchFullPlay) && beatRange != null);
      setRevealDone(!needsReveal);
      setResults((prev) => [...prev, { kind: q.kind, category: q.category, correct: right }]);
      recordAttempt({
        questionId: q.id,
        category: q.category,
        playName: q.playName ?? activePlay?.name,
        correct: right,
      });
      setProgressTick((t) => t + 1);
    },
    [
      guess,
      q,
      isFormation,
      isDraw,
      isInteractive,
      result,
      prefaceDone,
      contextDone,
      activePlay?.name,
      recordAttempt,
    ],
  );

  const submit = () => submitAnswer();

  const pickOption = (o) => {
    if (result !== null) return;
    submitAnswer(o);
  };

  const next = () => {
    if (n + 1 >= deck.length) {
      setPhase("done");
      return;
    }
    setN(n + 1);
    resetQuestion();
    const nextQ = deck[n + 1];
    if (nextQ?.kind === "draw" && nextQ.allowedTools?.length) {
      setLineTool(nextQ.allowedTools[0]);
    }
  };

  useEffect(() => {
    if (isDraw && q?.allowedTools?.length) {
      setLineTool(q.allowedTools[0]);
    }
  }, [n, isDraw, q?.allowedTools]);

  const summary = summarizeSession(results, categoryMap);

  if (phase === "empty") {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-ink-soft mb-4">
          {isDaily
            ? "No quiz cards could be built from the playbook yet."
            : `No practice cards for #${myId} on this play yet.`}
        </p>
        <button type="button" onClick={() => setPhase("idle")} className="ps-btn ps-btn-secondary">
          Back
        </button>
      </div>
    );
  }

  if (phase === "idle" || phase === "done") {
    return (
      <div>
        {phase === "done" ? (
          <div className="text-center py-4 mb-4">
            <p className="font-display text-2xl font-bold text-ink mb-1">
              {summary.correct === summary.total
                ? "Perfect!"
                : summary.correct >= summary.total * 0.7
                  ? "Great work!"
                  : "Keep going!"}
            </p>
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-3">Lesson complete</p>
            <p className="font-display text-4xl font-bold text-ink mb-4">
              {summary.correct}
              <span className="text-ink-soft font-data text-xl">/{summary.total}</span>
            </p>
            <div className="border border-rule text-left mb-4">
              {categoryOrder.map((cat) => {
                const s = summary.byCategory[cat];
                if (!s?.total) return null;
                return (
                  <div key={cat} className="flex justify-between px-3 py-2 border-b border-rule last:border-0 text-sm">
                    <span>{categoryMap[cat]?.label ?? cat}</span>
                    <span className="font-data text-ink-soft">
                      {s.correct}/{s.total}
                    </span>
                  </div>
                );
              })}
            </div>
            {isDaily && (
              <p className="text-xs text-ink-soft text-center mb-4">
                Next quiz will bring back what you missed.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-2">
              {isDaily ? getTodayQuizLabel(preview.seed) : "Practice"}
            </p>
            <h2 className="font-display text-xl font-bold mb-1">
              {isDaily ? "Team playbook quiz" : play.name}
            </h2>
            <p className="text-sm text-ink-soft mb-4">
              {isDaily
                ? "Memorize your plays — watch each step, then answer. Missed questions come back."
                : "Still frame → answer → watch the play run."}
            </p>
            {isDemo && (
              <p className="text-xs text-flag border border-flag/30 bg-flag/5 px-3 py-2 mb-4">
                {modeLabel}
              </p>
            )}
            <div className="mb-4">
              <p className="ps-label">{isDaily ? "Your number — whole playbook" : "Your number"}</p>
              <div className="flex gap-1 flex-wrap">
                {IDS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMyId(i)}
                    className={`font-data px-3 py-2 border min-h-[44px] text-sm ${
                      i === myId ? "border-jersey bg-jersey/10 text-jersey" : "border-rule text-ink-soft"
                    }`}
                  >
                    {i} {POS_NAME[i]}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-rule mb-4">
              <p className="px-3 py-2 bg-paper-2 font-data text-[10px] uppercase tracking-widest text-ink-soft border-b border-rule">
                Question types
              </p>
              <ul className="divide-y divide-rule">
                {categoryOrder.map((cat) => {
                  const has = preview.available.includes(cat);
                  const count = preview.buckets[cat]?.length ?? 0;
                  if (isDaily && !has) return null;
                  return (
                    <li key={cat} className="px-3 py-2.5 flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{categoryMap[cat]?.label ?? cat}</p>
                        <p className="text-xs text-ink-soft">{categoryMap[cat]?.hint}</p>
                      </div>
                      <span className={`font-data text-xs shrink-0 ${has ? "text-go" : "text-ink-soft"}`}>
                        {has ? count : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {isDaily && preview.weakSummary?.hasHistory && (
              <div className="border border-rule mb-4 px-3 py-3 bg-paper-2">
                <p className="font-data text-[10px] uppercase tracking-widest text-jersey mb-2">
                  Based on your results
                </p>
                {preview.reviewCount > 0 ? (
                  <p className="text-sm text-ink-soft mb-2">
                    {preview.reviewCount} question{preview.reviewCount === 1 ? "" : "s"} from areas you missed before.
                  </p>
                ) : (
                  <p className="text-sm text-ink-soft mb-2">Mixing in fresh plays today.</p>
                )}
                {preview.weakSummary.weakCategories.length > 0 && (
                  <p className="text-xs text-ink-soft">
                    Focus: {preview.weakSummary.weakCategories.map((c) => c.label).join(", ")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
        <button type="button" onClick={begin} className="ps-btn ps-btn-primary w-full">
          {phase === "done" ? (isDaily ? "Try again" : "Practice again") : isDaily ? "Start today's quiz" : "Start practice"}
        </button>
        {onExit && (
          <button type="button" onClick={onExit} className="ps-btn ps-btn-ghost mt-2 w-full">
            Back
          </button>
        )}
      </div>
    );
  }

  const interactive = isInteractive && result === null && showAnswerUi;
  const showingContext = needsContext && prefaceDone && !contextDone;
  const showCorrection = result === false && isInteractive && !correctionDone;
  const playStartBeat = 0;
  const showPlayAnimation =
    result !== null && isInteractive && (result === true || correctionDone) && !revealDone;
  const showReveal =
    result === false && !isInteractive && (beatRange != null || q?.watchFullPlay);
  const hidePlayLabel = isDaily && q.playName && (watching || waitingToWatch);
  const stillFrame = activePlay?.frames?.[0] ?? null;
  const contextFrame = showFrame ?? stillFrame;
  const mcCourtFrame =
    showFrame ??
    activePlay?.frames?.[Math.max(0, (q?.frameIdx ?? 1) - 1)] ??
    stillFrame;
  const showMcStill =
    showAnswerUi &&
    (isMc || isWatchKind) &&
    result === null &&
    prefaceDone &&
    !showPlayAnimation &&
    !showCorrection &&
    !showingContext;
  const continueStopBeat = Math.max(0, (activePlay?.frames?.length ?? 1) - 1);

  return (
    <div className="flex flex-col gap-3">
      <QuizProgressBar current={n} total={deck.length} results={results} />

      <div className="flex flex-wrap gap-1">
        <CategoryBadge category={q.category} active categories={categoryMap} />
        {playLabel && !hidePlayLabel && (
          <span className="font-data text-[10px] uppercase tracking-widest px-2 py-1 border border-rule text-ink-soft">
            {playLabel}
          </span>
        )}
      </div>

      <article className="border border-rule bg-paper">
        <header className="px-3 py-2 border-b border-rule bg-paper-2">
          <span className="font-data text-[10px] uppercase tracking-widest text-jersey">
            {catMeta?.short}
          </span>
        </header>

        <div className="p-3">
          <h3
            className={`font-display font-bold leading-tight mb-3 ${
              showingQuestion && (isDraw || isFormation)
                ? "text-[1.75rem] sm:text-4xl tracking-tight"
                : showingQuestion
                  ? "text-2xl sm:text-3xl"
                  : needsWatch && !prefaceDone
                    ? "text-xl sm:text-2xl text-ink-soft"
                    : "text-lg"
            }`}
          >
            {headline}
          </h3>

          {isDraw && showAnswerUi && allowedTools.length > 1 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {allowedTools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setLineTool(t.id);
                    setGuess(null);
                    setDraftPoints([]);
                    strokeRef.current = [];
                  }}
                  className={`ps-editor-beat-btn text-xs ${lineTool === t.id ? "is-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div
            className={`ps-court-frame border border-rule ${
              interactive ? "ring-2 ring-jersey/25 cursor-crosshair" : ""
            }`}
          >
            {waitingToWatch ? (
              <CourtSurface suffix="-wait" theme="paper">
                {stillFrame &&
                  IDS.map((id) => {
                    const p = stillFrame.pos?.[id];
                    if (!p) return null;
                    return (
                      <Token
                        key={id}
                        id={id}
                        p={p}
                        hasBall={stillFrame.ball === id}
                        focus={id === myId}
                      />
                    );
                  })}
              </CourtSurface>
            ) : watching ? (
              q.watchFullPlay ? (
                <QuizPlayClip
                  play={activePlay}
                  speed={QUIZ_FULL_PLAY_SPEED}
                  highlightPlayer={myId}
                  onReady={() => setPrefaceDone(true)}
                />
              ) : (
                <QuizWatchCourt
                  play={activePlay}
                  watchStopBeat={watchStopBeat}
                  speed={QUIZ_WATCH_SPEED}
                  beatRecap={q.beatRecap}
                  highlightPlayer={q.player ?? myId}
                  onReady={() => setPrefaceDone(true)}
                />
              )
            ) : showingContext ? (
              <QuizContextCourt
                frame={contextFrame}
                playerId={q.player}
                myId={myId}
                play={activePlay}
                frameIdx={q.frameIdx}
                label={contextHeadline(q)}
                onAnimReady={() => setContextAnimDone(true)}
              />
            ) : showCorrection ? (
              <QuizCorrectionCourt
                frame={contextFrame}
                question={q}
                guess={guess}
                highlightPlayer={q.player ?? myId}
              />
            ) : showPlayAnimation ? (
              <QuizSequentialCourt
                key={`${n}-play-${q.id}`}
                play={activePlay}
                fromBeat={0}
                startBeatIdx={0}
                stopBeatIdx={continueStopBeat}
                highlightPlayer={q.player ?? myId}
                onReady={() => setRevealDone(true)}
              />
            ) : showReveal ? (
              q.watchFullPlay ? (
                <QuizPlayClip
                  play={activePlay}
                  speed={QUIZ_FULL_PLAY_SPEED}
                  highlightPlayer={myId}
                  onReady={() => setRevealDone(true)}
                />
              ) : (
                <QuizRevealCourt
                  key={`${n}-reveal-${q.id}`}
                  play={activePlay}
                  fromIdx={beatRange.fromIdx}
                  toIdx={beatRange.toIdx}
                  active
                  highlightPlayer={q.player ?? myId}
                  onFinished={() => setRevealDone(true)}
                />
              )
            ) : showMcStill && mcCourtFrame ? (
              <CourtSurface suffix="-mc" theme="paper">
                {IDS.map((id) => {
                  const p = mcCourtFrame.pos?.[id];
                  if (!p) return null;
                  return (
                    <Token
                      key={id}
                      id={id}
                      p={p}
                      hasBall={mcCourtFrame.ball === id}
                      focus={id === (q.player ?? myId)}
                    />
                  );
                })}
              </CourtSurface>
            ) : (
              <CourtSurface
                svgRef={svgRef}
                theme="paper"
                suffix="-fc"
                onPointerDown={onCourtDown}
                onPointerMove={onCourtMove}
                onPointerUp={onCourtUp}
              >
                {showFrame &&
                  IDS.map((id) => {
                    if (isFormation && id === q.player) return null;
                    const p = showFrame.pos?.[id];
                    if (!p) return null;
                    return (
                      <Token
                        key={id}
                        id={id}
                        p={p}
                        hasBall={showFrame.ball === id}
                        faded={isDraw && id !== q.player}
                        highlight={isDraw && id === q.player}
                        focus={id === (q.player ?? myId) && !isDraw}
                      />
                    );
                  })}
                {isDraw && draftPoints.length > 1 && (
                  <path
                    d={pathToSvgD(draftPoints)}
                    fill="none"
                    stroke="#e8560f"
                    strokeWidth="2.5"
                    strokeDasharray={lineTool === "pass" ? "9 7" : undefined}
                    opacity="0.95"
                  />
                )}
                {isDraw && guess?.points?.length > 1 && draftPoints.length <= 1 && (
                  <path
                    d={pathToSvgD(guess.points)}
                    fill="none"
                    stroke="#e8560f"
                    strokeWidth="2.5"
                    opacity="0.95"
                  />
                )}
                {isFormation && guess && (
                  <>
                    <circle
                      cx={guess.x}
                      cy={guess.y}
                      r={SPOT_TOLERANCE * 0.45}
                      fill="none"
                      stroke="#e8560f"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      opacity="0.35"
                    />
                    <circle
                      cx={guess.x}
                      cy={guess.y}
                      r="12"
                      fill="#e8560f"
                      fillOpacity="0.25"
                      stroke="#e8560f"
                      strokeWidth="2"
                    />
                    <text
                      x={guess.x}
                      y={guess.y + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#e8560f"
                    >
                      ?
                    </text>
                  </>
                )}
                {isFormation && !guess && (
                  <text x="250" y="28" textAnchor="middle" fontSize="11" fill="#e8560f">
                    TAP YOUR SPOT — #{q.player} is hidden
                  </text>
                )}
              </CourtSurface>
            )}
          </div>

          {result !== null && (
            <div
              className={`mt-3 text-center py-2 px-3 font-display font-bold text-base rounded-lg ${
                result ? "bg-go/15 text-go" : "bg-flag/15 text-flag"
              }`}
            >
              {result ? "Correct!" : "Wrong"}
            </div>
          )}

          {showAnswerUi && (isMc || isWatchKind) && (
            <div className="flex flex-col gap-2 mt-3">
              {options.map((o) => {
                const reveal = result !== null;
                const isRight = o === q.correct;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={reveal}
                    onClick={() => pickOption(o)}
                    className={`text-left px-3 py-3 text-sm border min-h-[48px] transition-colors ${
                      reveal && isRight
                        ? "border-go bg-go/10 font-semibold"
                        : "border-rule bg-paper hover:bg-paper-2 active:scale-[0.99]"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {waitingToWatch && manualWatch && (
          <footer className="px-3 py-3 border-t border-rule">
            <button
              type="button"
              onClick={() => setWatchStarted(true)}
              className="ps-btn ps-btn-primary w-full"
            >
              Watch play
            </button>
          </footer>
        )}

        {showAnswerUi && (
          <footer className="px-3 py-3 border-t border-rule">
            <button
              type="button"
              onClick={result === null ? submit : next}
              disabled={
                !showAnswerUi ||
                (result === null && guess == null) ||
                (result !== null && !revealDone)
              }
              className="ps-btn ps-btn-primary w-full disabled:opacity-40"
            >
              {result === null
                ? "Check"
                : !revealDone
                  ? "Playing…"
                  : n + 1 >= deck.length
                    ? "Finish"
                    : "Continue"}
            </button>
          </footer>
        )}
      </article>

      {result !== null && !revealDone && (showPlayAnimation || showReveal) && (
        <button
          type="button"
          onClick={() => setRevealDone(true)}
          className="text-xs text-ink-soft text-center w-full py-1"
        >
          Skip →
        </button>
      )}
    </div>
  );
}
