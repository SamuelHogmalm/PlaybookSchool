import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function homePathForProfile(profile) {
  if (profile?.role === "coach") return "/coach/playbook";
  return "/player/today";
}

/** Also check auth metadata when profile row is unavailable (RLS edge cases). */
export function isCoachUser(profile, user) {
  return profile?.role === "coach" || user?.user_metadata?.role === "coach";
}

export function homePathForUser(profile, user) {
  if (isCoachUser(profile, user)) return "/coach/playbook";
  return "/player/today";
}

/** Sync role/full_name from signup metadata into profiles row. */
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

/** Coach: create team + join code (idempotent). */
export async function createCoachTeam(teamName) {
  const supabase = await getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("create_coach_team", {
    team_name: teamName ?? "My Team",
  });
  if (error) throw error;
  return data;
}

/** Player: join team with invite code. */
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
