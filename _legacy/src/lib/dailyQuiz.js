import {
  generateFlashcardDeck,
  QUIZ_CATEGORIES,
  CATEGORY_ORDER,
  ensureWatchFirst,
  enrichBeatRecap,
} from "@/lib/quiz";
import { enrichPlayForQuiz } from "@/lib/playData";
import { identifyStem, identifySub, categoryStem } from "@/lib/quizVoice";
import {
  loadQuizProgress,
  weaknessScore,
  getWeakSummary,
  countReviewCandidates,
} from "@/lib/quizProgress";

export const DAILY_QUIZ_CATEGORIES = {
  identify: {
    id: "identify",
    label: "Name that play",
    short: "Play",
    hint: "Watch the animation, then pick the play name.",
  },
  category: {
    id: "category",
    label: "Play type",
    short: "Type",
    hint: "What kind of set is this?",
  },
  beats: {
    id: "beats",
    label: "Beat count",
    short: "Beats",
    hint: "How many beats in this play?",
  },
  ...QUIZ_CATEGORIES,
};

export const DAILY_CATEGORY_ORDER = ["identify", "category", "beats", ...CATEGORY_ORDER];

function dateSeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 0x100000000;
  };
}

function seededShuffle(arr, seed) {
  const rng = createRng(seed);
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function mcOptions(correct, pool, count, seed) {
  const rng = createRng(seed);
  const uniq = [...new Set(pool.filter((o) => o && o !== correct))];
  const picks = seededShuffle(uniq, seed + 17).slice(0, count - 1);
  const merged = [correct, ...picks];
  const r = [...merged];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function questionKey(q) {
  return `${q.category}|${q.playName ?? ""}|${q.kind}|${q.frameIdx ?? ""}|${q.prompt?.slice(0, 48)}`;
}

function spreadDeck(cards) {
  const out = [...cards];
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 1; i < out.length; i++) {
      const sameCat = out[i].category === out[i - 1].category;
      const samePlay = out[i].playName && out[i].playName === out[i - 1].playName;
      if (!sameCat && !samePlay) continue;
      for (let j = i + 1; j < out.length; j++) {
        if (out[j].category !== out[i - 1].category && out[j].playName !== out[i - 1].playName) {
          [out[i], out[j]] = [out[j], out[i]];
          break;
        }
      }
    }
  }
  return out;
}

function sortByWeakness(items, progress, seed) {
  const rng = createRng(seed);
  return [...items].sort((a, b) => {
    const diff = weaknessScore(b, progress) - weaknessScore(a, progress);
    if (diff !== 0) return diff;
    return rng() - 0.5;
  });
}

function identifyQuestions(plays, seed, count = 2, progress = null) {
  const names = plays.map((p) => p.name);
  const ordered = progress?.attempts?.length
    ? sortByWeakness(
        plays.map((play) => ({ play, playName: play.name, category: "identify" })),
        progress,
        seed
      ).map((x) => x.play)
    : seededShuffle(plays, seed);

  return ordered.slice(0, Math.min(count, plays.length)).map((play, i) => ({
    kind: "mc",
    category: "identify",
    play,
    playName: play.name,
    watchFullPlay: true,
    skipReveal: true,
    introMode: "watch",
    prompt: identifyStem(),
    sub: identifySub(),
    correct: play.name,
    options: mcOptions(play.name, names, 4, seed + i * 53),
  }));
}

function beatsQuestions(plays, seed, count = 2, progress = null) {
  const ordered = progress?.attempts?.length
    ? sortByWeakness(
        plays.map((play) => ({ play, playName: play.name, category: "beats" })),
        progress,
        seed + 11
      ).map((x) => x.play)
    : seededShuffle(plays, seed + 11);

  return ordered.slice(0, Math.min(count, plays.length)).map((play, i) => {
    const n = play.frames?.length ?? 0;
    const pool = ["3", "4", "5", "6", "7", "8", "9"].filter((x) => x !== String(n));
    return {
      kind: "mc",
      category: "beats",
      play,
      playName: play.name,
      watchFullPlay: true,
      skipReveal: true,
      introMode: "watch",
      prompt: "How many beats in this play?",
      sub: "Watch the full play — then count the steps.",
      correct: String(n),
      options: mcOptions(String(n), pool, 4, seed + i * 67),
    };
  });
}

function categoryQuestions(plays, seed, count = 1, progress = null) {
  const categories = [...new Set(plays.map((p) => p.category || "Set"))];
  if (categories.length < 2) return [];

  const ordered = progress?.attempts?.length
    ? sortByWeakness(
        plays.map((play) => ({ play, playName: play.name, category: "category" })),
        progress,
        seed + 7
      ).map((x) => x.play)
    : seededShuffle(plays, seed + 7);

  return ordered.slice(0, Math.min(count, plays.length)).map((play, i) => ({
    kind: "mc",
    category: "category",
    play,
    playName: play.name,
    watchFullPlay: true,
    skipReveal: true,
    introMode: "watch",
    prompt: categoryStem(),
    sub: "Watch what ran — then pick the type.",
    correct: play.category || "Set",
    options: mcOptions(play.category || "Set", categories, Math.min(4, categories.length), seed + i * 41),
  }));
}

function collectRolePool(plays, myId, seed) {
  const pool = [];
  const order = seededShuffle(plays, seed + 200);

  for (const play of order) {
    const enriched = enrichPlayForQuiz(play);
    const { deck } = generateFlashcardDeck(enriched, myId, { maxCards: 10 });
    for (const q of deck) {
      if (["identify", "category", "beats"].includes(q.category)) continue;
      pool.push({
        ...q,
        play: enriched,
        playName: play.name,
      });
    }
  }

  return pool;
}

function pickRoleCards(pool, target, seed, progress = null) {
  if (!pool.length || target <= 0) return [];

  const ranked = progress?.attempts?.length
    ? sortByWeakness(pool, progress, seed + 401)
    : seededShuffle(pool, seed + 401);

  const picked = [];
  const usedKeys = new Set();
  const usedPlayCat = new Set();

  for (const q of ranked) {
    if (picked.length >= target) break;
    const key = questionKey(q);
    if (usedKeys.has(key)) continue;

    const playCat = `${q.playName}|${q.category}`;
    if (usedPlayCat.has(playCat) && weaknessScore(q, progress) < 6) continue;

    usedKeys.add(key);
    usedPlayCat.add(playCat);
    picked.push(q);
  }

  if (picked.length < target) {
    for (const q of ranked) {
      if (picked.length >= target) break;
      const key = questionKey(q);
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      picked.push(q);
    }
  }

  return spreadDeck(seededShuffle(picked, seed + 601));
}

export function generateDailyQuizDeck(plays, myId = "4", opts = {}) {
  const { maxCards = 15, seed = dateSeed(), progress = loadQuizProgress(myId) } = opts;
  const eligible = plays.filter((p) => p.frames?.length >= 2);
  if (!eligible.length) {
    return {
      deck: [],
      buckets: {},
      available: [],
      seed,
      myId,
      weakSummary: getWeakSummary(null, DAILY_QUIZ_CATEGORIES),
      reviewCount: 0,
    };
  }

  const playerSeed = seed + Number(myId) * 9973;
  const roleTarget = maxCards;

  const rolePool = collectRolePool(eligible, myId, playerSeed);
  const roleCards = pickRoleCards(rolePool, roleTarget, playerSeed, progress);

  const used = new Set();
  const finalize = (q) => {
    const enriched = ensureWatchFirst(enrichBeatRecap(q));
    const key = questionKey(enriched);
    if (used.has(key)) return null;
    used.add(key);
    return {
      ...enriched,
      id: key,
      categoryMeta: DAILY_QUIZ_CATEGORIES[enriched.category] ?? QUIZ_CATEGORIES[enriched.category],
    };
  };

  const pool = [];
  for (const q of roleCards) {
    const card = finalize(q);
    if (card) pool.push(card);
  }

  let deck = spreadDeck(seededShuffle(pool, playerSeed + 701)).slice(0, maxCards);

  if (deck.length < maxCards && rolePool.length) {
    const extra = sortByWeakness(rolePool, progress, playerSeed + 809);
    for (const q of extra) {
      if (deck.length >= maxCards) break;
      const card = finalize(q);
      if (card) deck.push(card);
    }
    deck = spreadDeck(deck).slice(0, maxCards);
  }

  const buckets = {};
  for (const cat of DAILY_CATEGORY_ORDER) {
    buckets[cat] = deck.filter((q) => q.category === cat);
  }

  const weakSummary = getWeakSummary(progress, DAILY_QUIZ_CATEGORIES);
  const reviewCount = countReviewCandidates(deck, progress);

  return {
    deck,
    buckets,
    available: DAILY_CATEGORY_ORDER.filter((c) => (buckets[c]?.length ?? 0) > 0),
    seed: playerSeed,
    myId,
    playCount: new Set(deck.map((q) => q.playName).filter(Boolean)).size,
    rolePoolSize: rolePool.length,
    weakSummary,
    reviewCount,
  };
}

export function getTodayQuizLabel(seed = dateSeed()) {
  return `Today's quiz · #${seed % 10000}`;
}

export { dateSeed, enrichPlayForQuiz, loadQuizProgress, getWeakSummary };
