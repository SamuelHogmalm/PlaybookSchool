/** Demo-only progress — localStorage when logged out or Supabase not configured. */

import {
  applyAttempt,
  buildProgressFromAttempts,
  emptyProgress,
} from "@/lib/quizProgressCore";

const STORAGE_KEY = "ps-quiz-progress-demo";
const LEGACY_KEY = "ps-quiz-progress";

function migrateLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadQuizProgressLocal(playerRole) {
  if (typeof window === "undefined") return emptyProgress();
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const rows = all[playerRole] ?? [];
    return buildProgressFromAttempts(rows);
  } catch {
    return emptyProgress();
  }
}

function saveRows(playerRole, rows) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[playerRole] = rows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function recordQuizAttemptLocal(playerRole, payload) {
  const progress = loadQuizProgressLocal(playerRole);
  const at = Date.now();
  const next = applyAttempt(progress, { ...payload, at });
  saveRows(playerRole, next.attempts);
  return next;
}

export function clearDemoProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
