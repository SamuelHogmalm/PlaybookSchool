#!/usr/bin/env node
/**
 * Reset test coach + player accounts; ensure personal Gmail is coach on same team.
 * Usage: node scripts/reset-accounts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PERSONAL_EMAIL = "samuel.hogmalm@gmail.com";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const { seedTestUsers } = await import(pathToFileURL(resolve(root, "src/lib/seedTestUsers.js")).href);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Resetting accounts…\n");
const result = await seedTestUsers(admin);

const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
const personal = usersData.users.find((u) => u.email?.toLowerCase() === PERSONAL_EMAIL.toLowerCase());

if (personal) {
  const { data: coachProf } = await admin
    .from("profiles")
    .select("team_id")
    .eq("email" in personal ? "id" : "id", personal.id)
    .maybeSingle();

  const { data: testCoachProf } = await admin
    .from("profiles")
    .select("team_id")
    .eq("role", "coach")
    .not("team_id", "is", null)
    .limit(1)
    .single();

  const teamId = coachProf?.team_id ?? testCoachProf?.team_id;

  await admin.auth.admin.updateUserById(personal.id, {
    user_metadata: { full_name: "Samuel", role: "coach" },
    email_confirm: true,
  });

  await admin.from("profiles").upsert({
    id: personal.id,
    full_name: "Samuel",
    role: "coach",
    team_id: teamId,
  });

  console.log(`Updated ${PERSONAL_EMAIL} → coach`);
}

console.log("\n--- Log in at playlab-omega.vercel.app/login ---\n");
console.log("Coach:", result.coach.email, "/", result.coach.password);
console.log("Player:", result.player.email, "/", result.player.password);
console.log("Join code:", result.team.joinCode);
