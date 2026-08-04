import { IDS } from "@/app/court/Court";
import { beatEndPositions, beatStartPositions } from "@/lib/playModel";

export const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

/** Five flashcard categories — always shown in the UI */
export const QUIZ_CATEGORIES = {
  route: {
    id: "route",
    label: "Draw your route",
    short: "Route",
    hint: "Tap the court where you need to be.",
  },
  screen: {
    id: "screen",
    label: "Screen",
    short: "Screen",
    hint: "Pick who sets the screen.",
  },
  ball: {
    id: "ball",
    label: "Ball movement",
    short: "Ball",
    hint: "Pass, handoff, or who has the ball.",
  },
  sequence: {
    id: "sequence",
    label: "What happens next",
    short: "Sequence",
    hint: "Remember the beat order.",
  },
  read: {
    id: "read",
    label: "The read",
    short: "Read",
    hint: "What to do when the defense adjusts.",
  },
};

export const CATEGORY_ORDER = ["route", "screen", "ball", "sequence", "read"];

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
  const uniq = [...new Set(pool.filter((o) => o && o !== correct))];
  const picks = shuffle(uniq).slice(0, count - 1);
  return shuffle([correct, ...picks]);
}

export function formatMcOptions(correct, pool, count = 4) {
  return mcOptions(correct, pool, count);
}

function playerOption(id) {
  return `#${id} (${POS_NAME[id]})`;
}

/** Infer pass/screen from position deltas when beats have no explicit actions */
function inferBeatActions(prev, cur) {
  const explicit = cur.actions ?? [];
  if (explicit.length) return explicit;

  const inferred = [];

  if (cur.ball && prev.ball && cur.ball !== prev.ball) {
    inferred.push({ type: "pass", by: prev.ball, for: cur.ball });
  }

  for (const cutter of IDS) {
    if (!playerMovedOnBeat(prev, cur, cutter, 40)) continue;
    for (const screener of IDS) {
      if (screener === cutter) continue;
      if (playerMovedOnBeat(prev, cur, screener, 28)) continue;
      const endS = beatEndPositions(prev, cur)[screener];
      const startC = beatStartPositions(prev, cur)[cutter];
      if (endS && startC && dist(endS, startC) < 55) {
        inferred.push({ type: "screen", by: screener, for: cutter });
      }
    }
  }

  return inferred;
}

function beatSummary(prev, cur) {
  const parts = [];
  for (const a of inferBeatActions(prev, cur)) {
    if (a.type === "pass") parts.push(`#${a.by} passes to #${a.for}`);
    if (a.type === "handoff") parts.push(`#${a.by} hands off to #${a.for}`);
    if (a.type === "screen") parts.push(`#${a.by} sets a screen for #${a.for}`);
  }
  for (const id of IDS) {
    if (playerMovedOnBeat(prev, cur, id)) {
      const tagged = inferBeatActions(prev, cur).some((a) => a.by === id || a.for === id);
      if (!tagged) parts.push(`#${id} (${POS_NAME[id]}) moves`);
    }
  }
  if (cur.ball !== prev.ball && !parts.some((p) => p.includes("pass") || p.includes("hand"))) {
    parts.push(`Ball ends with #${cur.ball}`);
  }
  return parts.length ? parts.join(". ") : null;
}

const FALLBACK_READS = [
  { trigger: "Defense switches the screen", answer: "Hit the roll man or skip to the corner" },
  { trigger: "Help rotates early on the drive", answer: "Kick out to the open shooter" },
  { trigger: "They go under the screen", answer: "Pull up or reject and re-screen" },
  { trigger: "Defender denies the first pass", answer: "Backdoor cut or dribble handoff" },
];

function readsForPlay(play) {
  if (play.counters?.length) return play.counters;
  const seeded = play.name.length % FALLBACK_READS.length;
  return [FALLBACK_READS[seeded], FALLBACK_READS[(seeded + 1) % FALLBACK_READS.length]];
}

function questionKey(q) {
  return `${q.category}|${q.kind}|${q.frameIdx ?? "c"}|${q.player ?? ""}|${q.prompt}`;
}

export function movementTarget(prevFrame, frame, playerId) {
  return beatEndPositions(prevFrame, frame)[playerId];
}

export function playerMovedOnBeat(prevFrame, frame, playerId, threshold = 22) {
  const start = beatStartPositions(prevFrame, frame);
  const end = beatEndPositions(prevFrame, frame);
  if (!start[playerId] || !end[playerId]) return false;
  return dist(start[playerId], end[playerId]) > threshold;
}

/** Collect every possible question, bucketed by category */
export function collectQuestionsByCategory(play, myId) {
  const buckets = {
    route: [],
    screen: [],
    ball: [],
    sequence: [],
    read: [],
  };
  const F = play.frames;

  for (let i = 1; i < F.length; i++) {
    const prev = F[i - 1];
    const cur = F[i];

    const beatActions = inferBeatActions(prev, cur);

    // ── 1. Draw your route (always for myId if they move) ──
    if (playerMovedOnBeat(prev, cur, myId)) {
      const target = movementTarget(prev, cur, myId);
      const action = beatActions.find((a) => a.by === myId);
      let sub = "Tap your spot on the floor.";
      if (action?.type === "handoff") sub = "Tap where you cut to hand off.";
      else if (action?.type === "dribble") sub = "Tap where you dribble to.";
      else if (action?.type === "screen") sub = "Tap where you set the screen.";
      else if (action?.type === "cut") sub = "Tap where you cut to.";

      buckets.route.push({
        kind: "spot",
        category: "route",
        player: myId,
        frameIdx: i,
        prompt: `Beat ${i + 1} — where do you go?`,
        sub,
        target,
        from: prev,
      });
    }

    beatActions.forEach((a) => {
      if (a.type === "screen") {
        buckets.screen.push({
          kind: "mc",
          category: "screen",
          frameIdx: i,
          prompt: `Beat ${i + 1} — who sets the screen for #${a.for}?`,
          sub: QUIZ_CATEGORIES.screen.hint,
          correct: playerOption(a.by),
          options: IDS.filter((x) => x !== a.for).map(playerOption),
          from: prev,
        });
      }

      // ── 3. Ball (pass + handoff) ──
      if (a.type === "pass") {
        buckets.ball.push({
          kind: "mc",
          category: "ball",
          frameIdx: i,
          prompt: `Beat ${i + 1} — #${a.by} passes. Who gets it?`,
          sub: QUIZ_CATEGORIES.ball.hint,
          correct: playerOption(a.for),
          options: IDS.filter((x) => x !== a.by).map(playerOption),
          from: prev,
        });
      }
      if (a.type === "handoff") {
        buckets.ball.push({
          kind: "mc",
          category: "ball",
          frameIdx: i,
          prompt: `Beat ${i + 1} — #${a.by} hands off. Who receives?`,
          sub: QUIZ_CATEGORIES.ball.hint,
          correct: playerOption(a.for),
          options: IDS.filter((x) => x !== a.by).map(playerOption),
          from: prev,
        });
      }
    });

    // Ball: who has it after the beat (if it changed and no pass/handoff q dup)
    if (cur.ball !== prev.ball) {
      const hasPassQ = beatActions.some((a) => a.type === "pass" || a.type === "handoff");
      if (!hasPassQ) {
        buckets.ball.push({
          kind: "mc",
          category: "ball",
          frameIdx: i,
          prompt: `Beat ${i + 1} — who has the ball?`,
          sub: QUIZ_CATEGORIES.ball.hint,
          correct: playerOption(cur.ball),
          options: IDS.map(playerOption),
          from: prev,
        });
      }
    }

    // ── 4. Sequence ──
    const beatNote = cur.note?.trim() || beatSummary(prev, cur);
    if (beatNote) {
      const others = F.map((f, j) => {
        if (j === 0 || j === i) return null;
        const p = F[j - 1];
        return f.note?.trim() || beatSummary(p, f);
      }).filter(Boolean);
      if (others.length >= 1) {
        buckets.sequence.push({
          kind: "mc",
          category: "sequence",
          frameIdx: i,
          prompt: `Beat ${i + 1} — what happens on this beat?`,
          sub: QUIZ_CATEGORIES.sequence.hint,
          correct: beatNote,
          options: mcOptions(beatNote, others, 4),
          from: prev,
        });
      }
    }
  }

  // ── 5. Reads ──
  readsForPlay(play).forEach((c) => {
    const wrong = readsForPlay(play).filter((x) => x !== c).map((x) => x.answer);
    buckets.read.push({
      kind: "mc",
      category: "read",
      prompt: c.trigger,
      sub: QUIZ_CATEGORIES.read.hint,
      correct: c.answer,
      options: mcOptions(c.answer, wrong, 4),
      from: F[1] || F[0],
    });
  });

  return buckets;
}

/**
 * Build a flashcard deck: one card per category when available, then fill to max.
 */
export function generateFlashcardDeck(play, myId = "1", opts = {}) {
  const { maxCards = 10 } = opts;
  const buckets = collectQuestionsByCategory(play, myId);
  const deck = [];
  const used = new Set();

  const pick = (bucket, category) => {
    if (!bucket.length) return null;
    const candidates = shuffle(bucket);
    for (const q of candidates) {
      const key = questionKey(q);
      if (used.has(key)) continue;
      used.add(key);
      return { ...q, id: key, categoryMeta: QUIZ_CATEGORIES[category] };
    }
    return null;
  };

  // Round 1: one flashcard from each of the 5 categories
  for (const cat of CATEGORY_ORDER) {
    const card = pick(buckets[cat], cat);
    if (card) deck.push(card);
  }

  // Round 2+: fill deck with remaining cards, rotate categories
  let added = true;
  while (deck.length < maxCards && added) {
    added = false;
    for (const cat of shuffle([...CATEGORY_ORDER])) {
      if (deck.length >= maxCards) break;
      const card = pick(buckets[cat], cat);
      if (card) {
        deck.push(card);
        added = true;
      }
    }
  }

  return {
    deck: shuffle(deck).slice(0, maxCards),
    buckets,
    available: CATEGORY_ORDER.filter((c) => buckets[c].length > 0),
    missing: CATEGORY_ORDER.filter((c) => buckets[c].length === 0),
  };
}

/** @deprecated use generateFlashcardDeck */
export function generateQuestions(play, myId = "1", opts = {}) {
  const { maxQuestions = 8 } = opts;
  return generateFlashcardDeck(play, myId, { maxCards: maxQuestions }).deck;
}

export function summarizeSession(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const byCategory = {};
  for (const cat of CATEGORY_ORDER) {
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
