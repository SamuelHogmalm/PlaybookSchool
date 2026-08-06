/** Auth helpers — single source of truth for roles and post-login routing. */

export const COACH_HOME = "/coach/playbook";
export const PLAYER_HOME = "/player/today";
export const AUTH_ENTER = "/api/auth/enter";

export function resolveRole(profile, user) {
  if (profile?.role === "coach" || user?.user_metadata?.role === "coach") return "coach";
  if (profile?.role === "player" || user?.user_metadata?.role === "player") return "player";
  return "player";
}

export function isCoach(profile, user) {
  return profile?.role === "coach" || user?.user_metadata?.role === "coach";
}

export function homeForUser(profile, user) {
  return isCoach(profile, user) ? COACH_HOME : PLAYER_HOME;
}

/** Load profile: RPC sync → get_my_profile → direct select */
export async function loadProfileForUser(client, userId) {
  if (!client || !userId) return null;

  const { data: synced, error: syncErr } = await client.rpc("sync_profile_from_auth");
  if (!syncErr && synced) return synced;

  const { data: viaRpc, error: rpcErr } = await client.rpc("get_my_profile");
  if (!rpcErr && viaRpc) return viaRpc;

  const { data: row } = await client
    .from("profiles")
    .select("id, full_name, role, position, jersey, team_id")
    .eq("id", userId)
    .maybeSingle();

  return row ?? null;
}

/** Load team via my_team RPC */
export async function loadTeamForUser(client) {
  if (!client) return null;
  const { data, error } = await client.rpc("my_team");
  if (error || !data?.has_team) return null;
  return {
    id: data.team_id,
    name: data.team_name,
    join_code: data.join_code,
  };
}

export async function ensureCoachTeam(client, teamName) {
  if (!client) return null;
  const { data, error } = await client.rpc("create_coach_team", {
    team_name: teamName ?? "My Team",
  });
  if (error) throw error;
  return data;
}
