import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  applyAttempt,
  buildProgressFromAttempts,
  emptyProgress,
  MAX_ATTEMPTS,
} from "@/lib/quizProgressCore";

function mapRow(row) {
  return {
    questionId: row.question_id,
    category: row.category,
    playName: row.play_name ?? undefined,
    correct: row.correct,
    at: new Date(row.created_at).getTime(),
  };
}

/** Load recent attempts for a signed-in user and rebuild weakness maps. */
export async function loadQuizProgressRemote(userId) {
  const supabase = await getSupabaseBrowserClient();
  if (!supabase || !userId) return emptyProgress();

  const { data, error } = await supabase
    .from("attempts")
    .select("question_id, category, play_name, correct, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ATTEMPTS);

  if (error) {
    console.warn("loadQuizProgressRemote:", error.message);
    return emptyProgress();
  }

  const rows = (data ?? []).map(mapRow).reverse();
  return buildProgressFromAttempts(rows);
}

/** Insert attempt — mastery updated by DB trigger. */
export async function recordQuizAttemptRemote(userId, playerRole, payload, currentProgress) {
  const supabase = await getSupabaseBrowserClient();
  if (!supabase || !userId) return currentProgress ?? emptyProgress();

  const { questionId, category, playName, correct } = payload;
  const { error } = await supabase.from("attempts").insert({
    user_id: userId,
    question_id: questionId,
    category,
    play_name: playName ?? null,
    player_role: playerRole,
    correct,
  });

  if (error) {
    console.warn("recordQuizAttemptRemote:", error.message);
    return currentProgress ?? emptyProgress();
  }

  return applyAttempt(currentProgress ?? emptyProgress(), {
    questionId,
    category,
    playName,
    correct,
    at: Date.now(),
  });
}

/** Coach dashboard — team play miss rates. */
export async function fetchTeamForgottenPlays(teamId, limit = 5) {
  const supabase = await getSupabaseBrowserClient();
  if (!supabase || !teamId) return [];

  const { data, error } = await supabase
    .from("team_play_mastery")
    .select("play_name, avg_miss_pct, player_count")
    .eq("team_id", teamId)
    .order("avg_miss_pct", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchTeamForgottenPlays:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    name: row.play_name,
    missRate: row.avg_miss_pct ?? 0,
    playerCount: row.player_count ?? 0,
  }));
}

/** Player mastery list for /player/me. */
export async function fetchUserMastery(userId) {
  const supabase = await getSupabaseBrowserClient();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from("mastery")
    .select("play_name, attempts_count, correct_count, last_attempt_at")
    .eq("user_id", userId)
    .order("last_attempt_at", { ascending: false });

  if (error) {
    console.warn("fetchUserMastery:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const pct =
      row.attempts_count > 0
        ? Math.round((row.correct_count / row.attempts_count) * 100)
        : 0;
    return {
      play: row.play_name,
      pct,
      status: pct >= 85 ? "mastered" : "learning",
      attempts: row.attempts_count,
    };
  });
}
