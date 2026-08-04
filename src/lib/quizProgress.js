/** Client-side quiz history — localStorage for now; swap for Supabase later. */

const STORAGE_KEY = "ps-quiz-progress";
const MAX_ATTEMPTS = 400;

function emptyProgress() {
  return {
    attempts: [],
    byQuestion: {},
    byCategory: {},
    byPlay: {},
  };
}

export function loadQuizProgress(myId) {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[myId] ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function saveQuizProgress(myId, progress) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[myId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
}

/** Record one answered question. Wrong answers weigh heavier for future decks. */
export function recordQuizAttempt(myId, { questionId, category, playName, correct }) {
  if (!questionId || !myId) return loadQuizProgress(myId);

  const progress = loadQuizProgress(myId);
  const at = Date.now();

  progress.attempts.push({ questionId, category, playName, correct, at });
  if (progress.attempts.length > MAX_ATTEMPTS) {
    progress.attempts = progress.attempts.slice(-MAX_ATTEMPTS);
  }

  const bump = (map, key, wrongDelta, rightDelta = -1) => {
    if (!key) return;
    const cur = map[key] ?? 0;
    map[key] = Math.max(0, cur + (correct ? rightDelta : wrongDelta));
  };

  bump(progress.byQuestion, questionId, 8, -2);
  bump(progress.byCategory, category, 3, -1);
  bump(progress.byPlay, playName, 2, -1);

  saveQuizProgress(myId, progress);
  return progress;
}

/** Higher = struggled more recently. Correct answers add a little; wrong adds a lot. */
export function weaknessScore(entry, progress) {
  if (!progress) return 0;
  let score = 0;

  if (entry.id) score += (progress.byQuestion[entry.id] ?? 0) * 3;
  if (entry.category) score += progress.byCategory[entry.category] ?? 0;
  if (entry.playName) score += (progress.byPlay[entry.playName] ?? 0) * 0.6;

  const recent = progress.attempts.filter((a) => {
    if (entry.id && a.questionId === entry.id) return true;
    if (entry.playName && a.playName === entry.playName && a.category === entry.category) return true;
    return false;
  });

  for (const a of recent.slice(-6)) {
    if (!a.correct) score += 8;
    else score -= 1;
  }

  return Math.max(0, score);
}

export function getWeakSummary(progress, categories = {}) {
  if (!progress?.attempts?.length) {
    return { hasHistory: false, weakCategories: [], weakPlays: [], missedCount: 0 };
  }

  const missed = progress.attempts.filter((a) => !a.correct).length;

  const weakCategories = Object.entries(progress.byCategory ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, weight]) => ({
      category: cat,
      label: categories[cat]?.label ?? cat,
      weight,
    }));

  const weakPlays = Object.entries(progress.byPlay ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([play, weight]) => ({ play, weight }));

  return { hasHistory: true, weakCategories, weakPlays, missedCount: missed };
}

export function countReviewCandidates(pool, progress, minScore = 4) {
  if (!progress) return 0;
  return pool.filter((q) => weaknessScore(q, progress) >= minScore).length;
}
