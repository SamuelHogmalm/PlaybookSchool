import { IDS } from "@/lib/playModel";
import { beatEndPositions, beatStartPositions, LINE_TOOLS } from "@/lib/playModel";
import { inferBeatActions, playerMovedOnBeat } from "@/lib/beatActions";
import { playAnimatorDuration } from "@/lib/animation";
import {
  actionAnswer,
  actionDistractorPool,
  balancedMcOptions,
  buildSafeContext,
  contrastiveFeedback,
  drawStem,
  drawSubText,
  formationStem,
  formationSubText,
  watchStem,
} from "@/lib/quizVoice";

export const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

export const SPOT_TOLERANCE = 80;
/** End-point slack for pass/screen draws */
export const DRAW_END_TOLERANCE = 88;
/** Cut/dribble: perpendicular slack from the expected line (px) */
export const DRAW_LANE_TOLERANCE = 72;
/** Cut/dribble: how close the drawn end must be to the target spot (px) */
export const DRAW_CUT_END_TOLERANCE = 110;
/** Min cosine similarity — ~55° cone either side of expected direction */
export const DRAW_DIRECTION_MIN_DOT = 0.57;

/** Quiz runs slightly slower on top of base timing */
export const QUIZ_WATCH_SPEED = 0.9;
export const QUIZ_FULL_PLAY_SPEED = 0.9;

export const QUIZ_CATEGORIES = {
  formation: {
    id: "formation",
    label: "Starting formation",
    short: "Form",
    hint: "See the set — tap where you belong.",
  },
  draw: {
    id: "draw",
    label: "Draw the action",
    short: "Draw",
    hint: "Draw your route on the still frame — then watch it run.",
  },
  watch: {
    id: "watch",
    label: "What do you do next?",
    short: "Next",
    hint: "Watch up to this moment — pick where you go.",
  },
};

export const CATEGORY_ORDER = ["formation", "draw", "watch"];

/** ~95% of cards should show a play clip before answering */
export const WATCH_SESSION_TARGET = 0.95;

/** Categories that teach by watching the play run before answering */
export const WATCH_LEARN_CATEGORIES = ["watch"];

const DECK_FILL_ORDER = ["formation", "draw", "watch"];

function dist(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function shuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function mcOptions(correct, pool, count = 4) {
  return balancedMcOptions(correct, pool, count, shuffle);
}

export function formatMcOptions(correct, pool, count = 4) {
  return mcOptions(correct, pool, count);
}

function watchAnswerForPlayer(prev, cur, myId, beatActions) {
  return actionAnswer(prev, cur, myId, beatActions, playerMovedOnBeat);
}

function watchMcOptions(correct, prev, cur, myId, beatActions, frames, playName) {
  return mcOptions(
    correct,
    actionDistractorPool(prev, cur, myId, beatActions, playerMovedOnBeat, frames, playName),
    4
  );
}

/** Plain-language recap — others only (spoiler-safe by default). */
function beatContextPlain(prev, cur, myId, beatActions) {
  return buildSafeContext(prev, cur, myId, beatActions ?? inferBeatActions(prev, cur));
}

function priorBeatContext(frames, beatIdx, myId) {
  if (beatIdx < 2) return null;
  return beatContextPlain(frames[beatIdx - 2], frames[beatIdx - 1], myId);
}

function roleQuestionContext(frames, beatIdx, prev, cur, myId, beatActions) {
  const prior = priorBeatContext(frames, beatIdx, myId);
  return buildSafeContext(prev, cur, myId, beatActions, { priorContext: prior });
}

function attachFeedback(q, playName) {
  if (q.kind === "formation" || q.kind === "draw") return q;
  if (typeof q.correct !== "string") return q;
  return {
    ...q,
    feedbackWrong: (guess) => {
      if (typeof guess !== "string") return null;
      return contrastiveFeedback({
        playName,
        guess,
        correct: q.correct,
        altPlay: q.altPlay,
      });
    },
  };
}

function expectedDrawForPlayer(prev, cur, myId, beatActions) {
  const mine = beatActions.find((a) => a.by === myId);
  if (mine) return mine;
  const pass = beatActions.find((a) => a.type === "pass" && a.by === myId);
  if (pass) return pass;
  if (playerMovedOnBeat(prev, cur, myId)) {
    return { type: "cut", by: myId };
  }
  return null;
}

export function questionIdFor(q) {
  return `${q.category}|${q.kind}|${q.frameIdx ?? "c"}|${q.player ?? ""}|${q.playName ?? ""}|${q.prompt?.slice(0, 48)}`;
}

function questionKey(q) {
  return questionIdFor(q);
}

function withIntro(q, beatIdx) {
  const watchFirst =
    q.kind === "watch" ||
    (beatIdx >= 1 && q.category === "draw");

  return {
    ...q,
    introMode: watchFirst ? "watch" : (q.introMode ?? "static"),
    watchStopBeat: watchFirst ? Math.max(0, beatIdx - 1) : q.watchStopBeat,
    skipReveal: q.skipReveal ?? (q.kind === "mc" || q.kind === "watch"),
  };
}

/** Every beat question replays the play up to the decision point */
export function ensureWatchFirst(q) {
  if (!q) return q;
  if (q.watchFullPlay) {
    return { ...q, introMode: "watch", skipReveal: q.skipReveal ?? true };
  }
  if (q.frameIdx != null && q.frameIdx >= 1) {
    return {
      ...q,
      introMode: "watch",
      watchStopBeat: q.watchStopBeat ?? q.frameIdx - 1,
      beatRecap: q.frameIdx >= 2 ? true : q.beatRecap,
    };
  }
  return q;
}

export function isWatchBasedQuestion(q) {
  if (!q) return false;
  if (q.watchFullPlay || q.introMode === "watch" || q.beatRecap) return true;
  if (WATCH_LEARN_CATEGORIES.includes(q.category)) return true;
  return false;
}

/** Avoid back-to-back same category or same beat */
function spreadDeck(cards) {
  const out = [...cards];
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 1; i < out.length; i++) {
      const sameCat = out[i].category === out[i - 1].category;
      const sameBeat = out[i].frameIdx != null && out[i].frameIdx === out[i - 1].frameIdx;
      if (!sameCat && !sameBeat) continue;
      for (let j = i + 1; j < out.length; j++) {
        if (out[j].category !== out[i - 1].category && out[j].frameIdx !== out[i - 1].frameIdx) {
          [out[i], out[j]] = [out[j], out[i]];
          break;
        }
      }
    }
  }
  return out;
}

export function movementTarget(prevFrame, frame, playerId) {
  return beatEndPositions(prevFrame, frame)[playerId];
}

export { playerMovedOnBeat } from "@/lib/beatActions";

export function scoreSpot(guess, target, tolerance = SPOT_TOLERANCE) {
  if (!guess || !target) return false;
  return dist(guess, target) <= tolerance;
}

const MOVE_DRAW_TOOLS = new Set(["cut", "dribble", "fill", "relocate"]);

function drawToolMatches(expected, tool) {
  if (!expected) return true;
  if (MOVE_DRAW_TOOLS.has(expected) && MOVE_DRAW_TOOLS.has(tool)) return true;
  if ((expected === "pass" || expected === "handoff") && (tool === "pass" || tool === "handoff")) {
    return true;
  }
  return tool === expected;
}

/** Cuts/dribbles: same general direction toward the spot — line need not be exact */
function scoreMovementDraw(points, start, target) {
  if (!points?.length || points.length < 2 || !start || !target) return false;

  const drawnStart = points[0];
  const drawnEnd = points[points.length - 1];

  const expectedDx = target.x - start.x;
  const expectedDy = target.y - start.y;
  const expectedLen = Math.hypot(expectedDx, expectedDy);
  if (expectedLen < 12) return scoreSpot(drawnEnd, target, DRAW_CUT_END_TOLERANCE);

  const drawnDx = drawnEnd.x - drawnStart.x;
  const drawnDy = drawnEnd.y - drawnStart.y;
  const drawnLen = Math.hypot(drawnDx, drawnDy);
  if (drawnLen < 16) return false;

  const directionDot =
    (drawnDx * expectedDx + drawnDy * expectedDy) / (drawnLen * expectedLen);
  if (directionDot < DRAW_DIRECTION_MIN_DOT) return false;

  if (scoreSpot(drawnEnd, target, DRAW_CUT_END_TOLERANCE)) return true;

  const alongT =
    ((drawnEnd.x - start.x) * expectedDx + (drawnEnd.y - start.y) * expectedDy) /
    (expectedLen * expectedLen);
  if (alongT < 0.3) return false;

  const proj = {
    x: start.x + Math.min(alongT, 1.15) * expectedDx,
    y: start.y + Math.min(alongT, 1.15) * expectedDy,
  };
  if (dist(drawnEnd, proj) <= DRAW_LANE_TOLERANCE) return true;

  const startDist = dist(drawnStart, target);
  const endDist = dist(drawnEnd, target);
  if (endDist < startDist * 0.55 && endDist <= DRAW_CUT_END_TOLERANCE * 1.35) return true;

  return false;
}

export function scoreDrawAnswer(guess, question) {
  if (!guess?.points?.length || guess.points.length < 2) return false;
  if (!drawToolMatches(question.expectedTool, guess.tool)) return false;

  const start = question.pathStart ?? guess.points[0];
  const end = guess.points[guess.points.length - 1];
  const target = question.target;
  if (!target) return false;

  const expected = question.expectedTool;
  const isMovement =
    !expected || expected === "cut" || expected === "dribble" || MOVE_DRAW_TOOLS.has(expected);

  if (isMovement) {
    return scoreMovementDraw(guess.points, start, target);
  }

  return scoreSpot(end, target, DRAW_END_TOLERANCE);
}

export function collectQuestionsByCategory(play, myId) {
  const buckets = {
    formation: [],
    draw: [],
    watch: [],
  };
  const F = play.frames;
  const playName = play.name;

  const startPos = F[0]?.pos?.[myId];
  if (startPos) {
    const formationQ = {
      kind: "formation",
      category: "formation",
      player: myId,
      frameIdx: 0,
      prompt: formationStem(playName, myId),
      sub: formationSubText(),
      target: startPos,
      showFrame: F[0],
      from: F[0],
      introMode: "static",
    };
    buckets.formation.push(attachFeedback(formationQ, playName));
  }

  for (let i = 1; i < F.length; i++) {
    const prev = F[i - 1];
    const cur = F[i];
    const beatActions = inferBeatActions(prev, cur);
    const roleContext = roleQuestionContext(F, i, prev, cur, myId, beatActions);
    const start = beatStartPositions(prev, cur);
    const target = movementTarget(prev, cur, myId);
    const exp = expectedDrawForPlayer(prev, cur, myId, beatActions);

    if (exp && target && start[myId]) {
      const isPassBeat = exp.type === "pass" || exp.type === "handoff";
      const tool =
        exp.type === "dribble"
          ? "dribble"
          : isPassBeat
            ? "cut"
            : exp.type === "screen"
              ? "screen"
              : "cut";
      const drawTarget = isPassBeat ? cur.pos[exp.for] ?? target : target;
      const drawQ = {
        kind: "draw",
        category: "draw",
        player: myId,
        frameIdx: i,
        prompt: drawStem(playName, myId),
        sub: drawSubText(roleContext),
        expectedTool: tool,
        allowedTools: ["cut", "dribble"],
        target: drawTarget,
        pathStart: start[myId],
        showFrame: prev,
        from: prev,
      };
      buckets.draw.push(attachFeedback(withIntro(drawQ, i), playName));
    }

    const watchAnswer = watchAnswerForPlayer(prev, cur, myId, beatActions);
    if (watchAnswer) {
      const watchQ = {
        kind: "watch",
        category: "watch",
        player: myId,
        frameIdx: i,
        introMode: "watch",
        watchStopBeat: i - 1,
        prompt: watchStem(playName, myId),
        sub: roleContext || "Watch what ran — then pick where you go.",
        correct: watchAnswer,
        options: watchMcOptions(watchAnswer, prev, cur, myId, beatActions, F, playName),
        from: prev,
        showFrame: prev,
      };
      buckets.watch.push(attachFeedback(watchQ, playName));
    }
  }

  return buckets;
}

/** Formation (frame 0) + draw per beat where the role moves */
function pickRoleVariants(buckets, myId) {
  const picked = [];
  const formation = buckets.formation?.find((q) => q.player === myId);
  if (formation) picked.push(formation);
  for (const q of buckets.draw ?? []) {
    if (q.player === myId) picked.push(q);
  }
  return picked;
}

export function generateFlashcardDeck(play, myId = "1", opts = {}) {
  const { maxCards = 10 } = opts;
  const buckets = collectQuestionsByCategory(play, myId);
  const used = new Set();
  const minWatch = Math.ceil(maxCards * WATCH_SESSION_TARGET);

  const finalize = (q) => {
    let enriched = ensureWatchFirst(enrichBeatRecap(q));
    const key = questionKey(enriched);
    if (used.has(key)) return null;
    used.add(key);
    return { ...enriched, id: key, categoryMeta: QUIZ_CATEGORIES[enriched.category] };
  };

  const pool = [];

  for (const q of shuffle(pickRoleVariants(buckets, myId))) {
    const card = finalize(q);
    if (card) pool.push(card);
  }

  for (const q of shuffle(buckets.watch)) {
    const card = finalize(q);
    if (card) pool.push(card);
  }

  let deck = spreadDeck(shuffle(pool));

  if (deck.length < maxCards) {
    for (const cat of DECK_FILL_ORDER) {
      for (const q of shuffle(buckets[cat])) {
        if (deck.length >= maxCards) break;
        const card = finalize(q);
        if (card && !deck.some((d) => d.id === card.id)) {
          deck.push(card);
        }
      }
    }
    deck = spreadDeck(shuffle(deck));
  }

  deck = deck.slice(0, maxCards);

  const watchCount = deck.filter(isWatchBasedQuestion).length;
  if (watchCount < minWatch && deck.length > 0) {
    const extras = [];
    for (const cat of DECK_FILL_ORDER) {
      for (const q of buckets[cat]) {
        const card = finalize(q);
        if (card && isWatchBasedQuestion(card) && !deck.some((d) => d.id === card.id)) {
          extras.push(card);
        }
      }
    }
    deck = [...deck, ...extras].slice(0, maxCards);
    deck = spreadDeck(deck);
  }

  return {
    deck,
    buckets,
    available: CATEGORY_ORDER.filter((c) => buckets[c].length > 0),
    missing: CATEGORY_ORDER.filter((c) => buckets[c].length === 0),
  };
}

export function generateQuestions(play, myId = "1", opts = {}) {
  const { maxQuestions = 8 } = opts;
  return generateFlashcardDeck(play, myId, { maxCards: maxQuestions }).deck;
}

export function summarizeSession(results, categories = QUIZ_CATEGORIES) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const byCategory = {};
  const order = Object.keys(categories);
  for (const cat of order) {
    const catResults = results.filter((r) => r.category === cat);
    byCategory[cat] = {
      total: catResults.length,
      correct: catResults.filter((r) => r.correct).length,
    };
  }
  return { total, correct, byCategory };
}

export function getCategoryLabel(category) {
  return QUIZ_CATEGORIES[category]?.label ?? category;
}

const BEAT_RECAP_CATEGORIES = new Set(["watch"]);

/** Beat N questions need a visual recap of beats 0…N-1 first */
export function needsBeatRecap(q) {
  if (!q?.frameIdx || q.frameIdx < 2) return false;
  return BEAT_RECAP_CATEGORIES.has(q.category);
}

/** Ensure beat questions always replay from the start through the prior beat */
export function enrichBeatRecap(q) {
  if (!q) return q;
  if (q.kind === "formation" || q.kind === "draw") return q;
  if (!needsBeatRecap(q)) return q;
  return {
    ...q,
    introMode: "watch",
    watchStopBeat: q.frameIdx - 1,
    beatRecap: true,
  };
}

export function getQuizWatchStopBeat(q) {
  if (q?.watchFullPlay && q?.play?.frames?.length) return q.play.frames.length - 1;
  if (q?.watchStopBeat != null) return q.watchStopBeat;
  if (q?.frameIdx != null && q.frameIdx > 0) return q.frameIdx - 1;
  return 0;
}
export function needsWatchIntro(q) {
  if (!q) return false;
  if (q.kind === "formation") return false;
  if (q.kind === "draw" && q.frameIdx != null && q.frameIdx >= 1) return true;
  if (q?.watchFullPlay) return true;
  if (q?.beatRecap || needsBeatRecap(q)) return true;
  if (q.introMode === "watch") return true;
  if (WATCH_LEARN_CATEGORIES.includes(q.category) && q.frameIdx != null) return true;
  return false;
}

export function watchPlaybackTargetMs(frames, watchStopBeat, speed = 1) {
  const last = Math.max(0, (frames?.length ?? 1) - 1);
  const to = watchStopBeat ?? last;
  return playAnimatorDuration(frames, 0, to, speed) * 0.98;
}

/** Beat range for reveal playback after a question is answered. */
export function questionBeatRange(q, frameCount) {
  if (q.frameIdx != null && q.frameIdx > 0) {
    return { fromIdx: q.frameIdx - 1, toIdx: frameCount - 1 };
  }
  const toIdx = Math.max(0, frameCount - 1);
  return { fromIdx: 0, toIdx };
}
