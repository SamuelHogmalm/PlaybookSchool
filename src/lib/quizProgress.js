/**
 * Quiz progress — Supabase when signed in, localStorage demo fallback otherwise.
 */

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { emptyProgress } from "@/lib/quizProgressCore";
import {
  loadQuizProgressLocal,
  recordQuizAttemptLocal,
} from "@/lib/quizProgressLocal";
import {
  loadQuizProgressRemote,
  recordQuizAttemptRemote,
} from "@/lib/quizProgressSupabase";

export {
  emptyProgress,
  buildProgressFromAttempts,
  weaknessScore,
  getWeakSummary,
  countReviewCandidates,
  MAX_ATTEMPTS,
} from "@/lib/quizProgressCore";

export { fetchTeamForgottenPlays, fetchUserMastery } from "@/lib/quizProgressSupabase";

/** @deprecated Prefer useQuizProgress hook — sync demo-only load. */
export function loadQuizProgress(playerRole) {
  return loadQuizProgressLocal(playerRole);
}

export async function loadQuizProgressForUser(userId, playerRole) {
  if (userId && isSupabaseConfigured()) {
    return loadQuizProgressRemote(userId);
  }
  return loadQuizProgressLocal(playerRole);
}

export async function recordQuizAttempt(ctx, payload) {
  const { userId, playerRole, progress } = ctx;
  if (userId && isSupabaseConfigured()) {
    return recordQuizAttemptRemote(userId, playerRole, payload, progress);
  }
  return recordQuizAttemptLocal(playerRole, payload);
}

export function progressMode(userId) {
  if (userId && isSupabaseConfigured()) return "cloud";
  if (isSupabaseConfigured()) return "demo-login";
  return "demo-offline";
}

export function progressModeLabel(mode) {
  if (mode === "cloud") return "Progress saved to your account.";
  if (mode === "demo-login") return "Demo mode — log in to save progress across devices.";
  return "Demo mode — progress saved on this device only.";
}
