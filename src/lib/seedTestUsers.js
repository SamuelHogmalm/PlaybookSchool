/** Shared logic for coach + player test accounts (script + admin API). */

export const TEST_COACH = {
  email: "coach@test.playbookschool.dev",
  password: "TestCoach123!",
  fullName: "Test Coach",
  teamName: "Demo Eagles",
};

export const TEST_PLAYER = {
  email: "player@test.playbookschool.dev",
  password: "TestPlayer123!",
  fullName: "Test Player",
  position: "PG",
  jersey: 7,
};

function randomJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let prefix = "";
  for (let i = 0; i < 3; i++) prefix += chars[Math.floor(Math.random() * chars.length)];
  const num = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${prefix}-${num}`;
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(admin, { email, password, fullName, role }) {
  let user = await findUserByEmail(admin, email);
  if (user) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { full_name: fullName, role },
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) throw error;
    user = data.user;
  }
  return user;
}

async function ensureProfile(admin, userId, patch) {
  const { data: existing } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing) {
    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("profiles").insert({ id: userId, ...patch });
    if (error) throw error;
  }
}

/**
 * Create or reset test coach + player on the same team.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin service-role client
 */
export async function seedTestUsers(admin) {
  const coachUser = await ensureUser(admin, {
    email: TEST_COACH.email,
    password: TEST_COACH.password,
    fullName: TEST_COACH.fullName,
    role: "coach",
  });

  await ensureProfile(admin, coachUser.id, {
    full_name: TEST_COACH.fullName,
    role: "coach",
  });

  let teamId;
  let joinCode;
  let teamName = TEST_COACH.teamName;

  const { data: coachProf } = await admin
    .from("profiles")
    .select("team_id")
    .eq("id", coachUser.id)
    .single();

  if (coachProf?.team_id) {
    const { data: t } = await admin
      .from("teams")
      .select("id, join_code, name")
      .eq("id", coachProf.team_id)
      .single();
    teamId = t.id;
    joinCode = t.join_code;
    teamName = t.name;
  } else {
    joinCode = randomJoinCode();
    const { data: team, error: teamErr } = await admin
      .from("teams")
      .insert({ name: TEST_COACH.teamName, join_code: joinCode })
      .select("id, join_code, name")
      .single();
    if (teamErr) throw teamErr;
    teamId = team.id;
    joinCode = team.join_code;
    teamName = team.name;
    await admin.from("profiles").update({ team_id: teamId }).eq("id", coachUser.id);
  }

  const playerUser = await ensureUser(admin, {
    email: TEST_PLAYER.email,
    password: TEST_PLAYER.password,
    fullName: TEST_PLAYER.fullName,
    role: "player",
  });

  await ensureProfile(admin, playerUser.id, {
    full_name: TEST_PLAYER.fullName,
    role: "player",
    team_id: teamId,
    position: TEST_PLAYER.position,
    jersey: TEST_PLAYER.jersey,
  });

  return {
    ok: true,
    team: { name: teamName, joinCode },
    coach: { email: TEST_COACH.email, password: TEST_COACH.password },
    player: { email: TEST_PLAYER.email, password: TEST_PLAYER.password },
  };
}
