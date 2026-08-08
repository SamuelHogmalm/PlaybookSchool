import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isCoach, homeForUser, COACH_HOME, PLAYER_HOME } from "@/lib/auth";

// Re-export for backwards compatibility
export { isCoach as isCoachUser, homeForUser as homePathForUser, COACH_HOME, PLAYER_HOME };

export function homePathForProfile(profile) {
  return profile?.role === "coach" ? COACH_HOME : PLAYER_HOME;
}

export async function syncProfileFromAuth() {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("sync_profile_from_auth");
  if (error) throw error;
  return data;
}

export async function fetchMyTeam() {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("my_team");
  if (error) throw error;
  return data;
}

export async function createCoachTeam(teamName) {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_coach_team", {
    team_name: teamName ?? "My Team",
  });
  if (error) throw error;
  return data;
}

export async function joinTeamByCode(joinCode) {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("join_team_by_code", {
    join_code_input: joinCode,
  });
  if (error) throw error;
  return data;
}

export async function fetchCoachRoster() {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("coach_team_roster");
  if (error) throw error;
  return data ?? [];
}

export function formatJoinInvite(joinCode, origin) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `Join our team on Playbook School!\nCode: ${joinCode}\n${base}/player/join?code=${encodeURIComponent(joinCode)}`;
}
