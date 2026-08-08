#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const browser = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

const email = "coach@test.playbookschool.dev";
const password = "TestCoach123!";

const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const coach = users.users.find((u) => u.email === email);
console.log("Auth user metadata:", coach?.user_metadata);

const { data: profAdmin } = await admin.from("profiles").select("*").eq("id", coach.id).single();
console.log("Profile (admin):", profAdmin);

const { data: signIn, error: signErr } = await browser.auth.signInWithPassword({ email, password });
if (signErr) {
  console.error("Sign in error:", signErr);
  process.exit(1);
}

const { data: profClient, error: profErr } = await browser
  .from("profiles")
  .select("id, full_name, role, team_id")
  .eq("id", signIn.user.id)
  .maybeSingle();

console.log("Profile (as logged-in user):", profClient, profErr?.message ?? "");

const { data: syncData, error: syncErr } = await browser.rpc("sync_profile_from_auth");
console.log("sync_profile_from_auth:", syncData, syncErr?.message ?? "");

const { data: myTeam, error: teamErr } = await browser.rpc("my_team");
console.log("my_team RPC:", myTeam, teamErr?.message ?? "");

const { data: team } = await browser.from("teams").select("*").eq("id", profAdmin.team_id).maybeSingle();
console.log("Team direct query:", team);
