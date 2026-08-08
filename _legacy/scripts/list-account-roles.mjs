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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });

console.log("\nAll accounts in Supabase:\n");
for (const u of data.users) {
  const { data: prof } = await admin.from("profiles").select("role, team_id, full_name").eq("id", u.id).maybeSingle();
  const metaRole = u.user_metadata?.role ?? "(none)";
  const dbRole = prof?.role ?? "(no profile)";
  console.log(`  ${u.email}`);
  console.log(`    metadata role: ${metaRole}`);
  console.log(`    database role: ${dbRole}`);
  console.log(`    → lands on: ${dbRole === "coach" || metaRole === "coach" ? "/coach/playbook" : "/player/today"}`);
  console.log();
}
