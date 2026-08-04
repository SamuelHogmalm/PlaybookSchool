"use client";

import { useState, useMemo, useRef } from "react";
import { IDS, CourtSurface, Token, ActionLayer, toSvg } from "@/app/court/Court";
import QuizRevealCourt, { questionBeatRange } from "@/app/play/QuizRevealCourt";
import {
  generateFlashcardDeck,
  QUIZ_CATEGORIES,
  CATEGORY_ORDER,
  POS_NAME,
  summarizeSession,
  formatMcOptions,
} from "@/lib/quiz";

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function CategoryBadge({ category, active = false }) {
  const meta = QUIZ_CATEGORIES[category];
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
  myId: initialMyId = "4",
  onExit,
  maxQuestions = 10,
}) {
  const [myId, setMyId] = useState(initialMyId);
  const [phase, setPhase] = useState("idle");
  const [deck, setDeck] = useState([]);
  const [deckInfo, setDeckInfo] = useState({ available: [], missing: [] });
  const [n, setN] = useState(0);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [revealDone, setRevealDone] = useState(false);
  const [results, setResults] = useState([]);
  const svgRef = useRef(null);

  const preview = useMemo(
    () => generateFlashcardDeck(play, myId, { maxCards: maxQuestions }),
    [play, myId, maxQuestions]
  );

  const begin = () => {
    const { deck: cards, available, missing } = generateFlashcardDeck(play, myId, {
      maxCards: maxQuestions,
    });
    setDeck(cards);
    setDeckInfo({ available, missing });
    setN(0);
    setResults([]);
    setGuess(null);
    setResult(null);
    setRevealDone(false);
    setPhase(cards.length ? "active" : "empty");
  };

  const q = deck[n];
  const beatRange = q ? questionBeatRange(q, play.frames.length) : null;
  const curFrame = q?.frameIdx != null ? play.frames[q.frameIdx] : null;
  const catMeta = q ? QUIZ_CATEGORIES[q.category] : null;

  const options = useMemo(() => {
    if (!q || q.kind !== "mc") return [];
    return formatMcOptions(q.correct, q.options ?? []);
  }, [q]);

  const submit = () => {
    if (guess == null) return;
    let right;
    if (q.kind === "spot") right = dist(guess, q.target) <= 52;
    else right = guess === q.correct;
    setResult(right);
    setRevealDone(false);
    setResults((prev) => [...prev, { kind: q.kind, category: q.category, correct: right }]);
  };

  const next = () => {
    if (n + 1 >= deck.length) {
      setPhase("done");
      return;
    }
    setN(n + 1);
    setGuess(null);
    setResult(null);
    setRevealDone(false);
  };

  const summary = summarizeSession(results);

  if (phase === "empty") {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-ink-soft mb-4">This play has no flashcards for #{myId} yet.</p>
        <p className="text-xs text-ink-soft mb-4">Try Horns or a play with more beats and actions.</p>
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
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-2">Deck complete</p>
            <p className="font-display text-4xl font-bold text-ink mb-4">
              {summary.correct}
              <span className="text-ink-soft font-data text-xl">/{summary.total}</span>
            </p>
            <div className="border border-rule text-left mb-4">
              {CATEGORY_ORDER.map((cat) => {
                const s = summary.byCategory[cat];
                if (!s?.total) return null;
                return (
                  <div key={cat} className="flex justify-between px-3 py-2 border-b border-rule last:border-0 text-sm">
                    <span>{QUIZ_CATEGORIES[cat].label}</span>
                    <span className="font-data text-ink-soft">
                      {s.correct}/{s.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-2">Flashcard deck</p>
            <h2 className="font-display text-xl font-bold mb-1">{play.name}</h2>
            <p className="text-sm text-ink-soft mb-4">
              Five question types — one flashcard from each when the play has them.
            </p>

            <div className="mb-4">
              <p className="ps-label">Your number</p>
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
                In this deck
              </p>
              <ul className="divide-y divide-rule">
                {CATEGORY_ORDER.map((cat) => {
                  const has = preview.available.includes(cat);
                  const count = preview.buckets[cat]?.length ?? 0;
                  return (
                    <li key={cat} className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{QUIZ_CATEGORIES[cat].label}</p>
                        <p className="text-xs text-ink-soft">{QUIZ_CATEGORIES[cat].hint}</p>
                      </div>
                      <span className={`font-data text-xs shrink-0 ${has ? "text-go" : "text-ink-soft"}`}>
                        {has ? `${count} card${count !== 1 ? "s" : ""}` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <button type="button" onClick={begin} className="ps-btn ps-btn-primary w-full">
          {phase === "done" ? "Run deck again" : "Start flashcards"}
        </button>
        {onExit && (
          <button type="button" onClick={onExit} className="ps-btn ps-btn-ghost mt-2 w-full">
            Back
          </button>
        )}
      </div>
    );
  }

  const isRoute = q.category === "route";

  return (
    <div className="flex flex-col gap-3">
      {/* Category progress strip */}
      <div className="flex flex-wrap gap-1">
        {CATEGORY_ORDER.map((cat) => {
          const current = q.category === cat;
          return <CategoryBadge key={cat} category={cat} active={current} />;
        })}
      </div>

      {/* Flashcard */}
      <article className="border border-rule bg-paper shadow-none">
        <header className="px-3 py-2 border-b border-rule bg-paper-2 flex items-center justify-between">
          <CategoryBadge category={q.category} active />
          <span className="font-data text-xs text-ink-soft">
            {n + 1} / {deck.length}
          </span>
        </header>

        <div className="p-3">
          <h3 className="font-display text-lg font-bold leading-snug mb-1">{q.prompt}</h3>
          <p className="text-sm text-ink-soft mb-3">{q.sub ?? catMeta?.hint}</p>

          <div className={`ps-court-frame border border-rule ${isRoute ? "ring-2 ring-jersey/30 cursor-crosshair" : ""}`}>
            {result !== null && beatRange ? (
              <QuizRevealCourt
                key={`${n}-${result}`}
                play={play}
                fromIdx={beatRange.fromIdx}
                toIdx={beatRange.toIdx}
                active
                result={result}
                highlightPlayer={q.player ?? myId}
                wrongSpot={isRoute && !result ? guess : null}
                correctSpot={isRoute ? q.target : null}
                onFinished={() => setRevealDone(true)}
              />
            ) : (
              <CourtSurface
                svgRef={svgRef}
                suffix="-fc"
                onPointerDown={(e) => {
                  if (!isRoute || result !== null) return;
                  setGuess(toSvg(svgRef.current, e));
                }}
              >
                {curFrame && !isRoute && (
                  <ActionLayer frame={curFrame} prev={q.from} suffix="-fc-mc" />
                )}
                {isRoute && q.from && (
                  <g opacity="0.2">
                    <circle
                      cx={q.from.pos[q.player]?.x}
                      cy={q.from.pos[q.player]?.y}
                      r="15"
                      fill="none"
                      stroke="#888"
                      strokeDasharray="4 4"
                    />
                  </g>
                )}
                {IDS.map((id) => (
                  <Token
                    key={id}
                    id={id}
                    p={q.from.pos[id]}
                    hasBall={q.from.ball === id}
                    faded={isRoute && id !== q.player}
                    highlight={isRoute && id === q.player}
                  />
                ))}
                {isRoute && guess && (
                  <circle cx={guess.x} cy={guess.y} r="15" fill="none" stroke="#E8560F" strokeWidth="3" strokeDasharray="4 3" />
                )}
                {isRoute && !guess && (
                  <text x="250" y="24" textAnchor="middle" fontSize="11" fill="#E8560F" style={{ userSelect: "none" }}>
                    TAP THE COURT
                  </text>
                )}
              </CourtSurface>
            )}
          </div>

          {isRoute ? (
            <p className="text-sm text-jersey font-semibold mt-3 text-center">
              {guess ? "Tap Check — or tap again to move your mark." : "Tap where you go on the floor."}
            </p>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {options.map((o) => {
                const chosen = guess === o;
                const reveal = result !== null;
                const isRight = o === q.correct;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={reveal}
                    onClick={() => setGuess(o)}
                    className={`text-left px-3 py-3 text-sm border min-h-[44px] ${
                      reveal && isRight
                        ? "border-go bg-go/10"
                        : reveal && chosen
                          ? "border-flag bg-flag/10"
                          : chosen
                            ? "border-jersey bg-paper-2"
                            : "border-rule bg-paper hover:bg-paper-2"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}

          {result !== null && (
            <div className={`mt-3 border px-3 py-2 text-sm ${result ? "border-go bg-go/5" : "border-flag bg-flag/5"}`}>
              <p className="font-semibold">{result ? "Correct" : "Not quite"}</p>
              <p className="text-ink-soft mt-1 text-sm">
                {isRoute
                  ? play.frames[q.frameIdx]?.note || "Watch the replay for the right spot."
                  : q.correct}
              </p>
            </div>
          )}
        </div>

        <footer className="px-3 py-3 border-t border-rule flex gap-2">
          <button
            type="button"
            onClick={result === null ? submit : next}
            disabled={guess == null || (result !== null && !revealDone)}
            className="ps-btn ps-btn-primary flex-1 disabled:opacity-40"
          >
            {result === null ? "Check" : !revealDone ? "Playing…" : n + 1 >= deck.length ? "Finish deck" : "Next card"}
          </button>
        </footer>
      </article>

      {result !== null && !revealDone && (
        <button type="button" onClick={() => setRevealDone(true)} className="text-xs text-ink-soft text-center">
          Skip animation
        </button>
      )}
    </div>
  );
}
