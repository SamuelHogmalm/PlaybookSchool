#!/usr/bin/env node
/**
 * Create example coach + player test accounts linked to the same team.
 *
 * Requires in .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Settings → API → service_role)
 *
 * Usage: node scripts/seed-test-users.mjs
 * Or on Vercel: POST /api/admin/seed-test-users with Bearer SEED_SECRET
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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
loadEnvFile(resolve(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never commit it).");
  console.error("Or deploy and POST /api/admin/seed-test-users with SEED_SECRET on Vercel.");
  process.exit(1);
}

const { seedTestUsers, TEST_COACH, TEST_PLAYER } = await import(
  pathToFileURL(resolve(root, "src/lib/seedTestUsers.js")).href
);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const result = await seedTestUsers(admin);
  console.log("\n--- Test accounts ready ---\n");
  console.log("Coach");
  console.log(`  Email:    ${result.coach.email}`);
  console.log(`  Password: ${result.coach.password}`);
  console.log(`  Login →   /coach/playbook`);
  console.log(`  Join code: ${result.team.joinCode}\n`);
  console.log("Player");
  console.log(`  Email:    ${result.player.email}`);
  console.log(`  Password: ${result.player.password}`);
  console.log(`  Login →   /player/today`);
  console.log(`  Team:     ${result.team.name}\n`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
