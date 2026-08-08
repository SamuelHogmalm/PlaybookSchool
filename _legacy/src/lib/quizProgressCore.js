/** Shared quiz progress shape + scoring helpers (no storage). */

export const MAX_ATTEMPTS = 400;

export function emptyProgress() {
  return {
    attempts: [],
    byQuestion: {},
    byCategory: {},
    byPlay: {},
  };
}

/** Rebuild weakness maps from attempt log (same weights as record). */
export function buildProgressFromAttempts(rows) {
  const progress = emptyProgress();
  const sorted = [...rows].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  for (const row of sorted) {
    const { questionId, category, playName, correct, at } = row;
    progress.attempts.push({ questionId, category, playName, correct, at });

    const bump = (map, key, wrongDelta, rightDelta = -1) => {
      if (!key) return;
      const cur = map[key] ?? 0;
      map[key] = Math.max(0, cur + (correct ? rightDelta : wrongDelta));
    };

    bump(progress.byQuestion, questionId, 8, -2);
    bump(progress.byCategory, category, 3, -1);
    bump(progress.byPlay, playName, 2, -1);
  }

  if (progress.attempts.length > MAX_ATTEMPTS) {
    progress.attempts = progress.attempts.slice(-MAX_ATTEMPTS);
  }

  return progress;
}

/** Higher = struggled more recently. */
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

/** Apply one attempt onto an in-memory progress object. */
export function applyAttempt(progress, { questionId, category, playName, correct, at = Date.now() }) {
  const next = {
    attempts: [...progress.attempts],
    byQuestion: { ...progress.byQuestion },
    byCategory: { ...progress.byCategory },
    byPlay: { ...progress.byPlay },
  };

  next.attempts.push({ questionId, category, playName, correct, at });
  if (next.attempts.length > MAX_ATTEMPTS) {
    next.attempts = next.attempts.slice(-MAX_ATTEMPTS);
  }

  const bump = (map, key, wrongDelta, rightDelta = -1) => {
    if (!key) return;
    const cur = map[key] ?? 0;
    map[key] = Math.max(0, cur + (correct ? rightDelta : wrongDelta));
  };

  bump(next.byQuestion, questionId, 8, -2);
  bump(next.byCategory, category, 3, -1);
  bump(next.byPlay, playName, 2, -1);

  return next;
}
