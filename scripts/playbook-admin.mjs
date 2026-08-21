#!/usr/bin/env node
/**
 * Look at, and clear out, the plays saved for a team.
 *
 *   node scripts/playbook-admin.mjs                 # list every play, do nothing
 *   node scripts/playbook-admin.mjs --delete-all    # remove them all
 *   node scripts/playbook-admin.mjs --delete <id>   # remove one
 *   node scripts/playbook-admin.mjs --keep <id,id>  # remove all except these
 *   node scripts/playbook-admin.mjs --restore <file> # put a backup back
 *
 * Listing is the default because `plays` has no soft delete and the app's own delete
 * button exists for one-at-a-time work. This is for clearing the decks — so every
 * delete writes the full rows to backups/ first, and --restore reads one back. A
 * playbook is somebody's season; it should not be one typo away from gone.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. The
 * service key bypasses row-level security, which is exactly why this is a script a
 * person runs deliberately rather than an endpoint.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};

const restorePath = valueOf("--restore");
if (restorePath) {
  const rows = JSON.parse(readFileSync(resolve(root, restorePath), "utf8"));
  const { error: upErr } = await supabase
    .from("plays")
    .upsert(rows, { onConflict: "id" });
  if (upErr) {
    console.error("Restore failed:", upErr.message);
    process.exit(1);
  }
  console.log(`Restored ${rows.length} play(s) from ${restorePath}.`);
  process.exit(0);
}

const { data: plays, error } = await supabase
  .from("plays")
  .select("*")
  .order("updated_at", { ascending: false });

if (error) {
  console.error("Could not read plays:", error.message);
  process.exit(1);
}

if (!plays.length) {
  console.log("The playbook is empty.");
  process.exit(0);
}

console.log(`${plays.length} play(s) saved:\n`);
for (const play of plays) {
  const beats = Array.isArray(play.beats) ? play.beats.length : 0;
  const actions = Array.isArray(play.beats)
    ? play.beats.reduce((n, b) => n + (b.actions?.length ?? 0), 0)
    : 0;
  console.log(
    `  ${play.name.padEnd(20)} ${String(beats).padStart(2)} beats  ` +
      `${String(actions).padStart(2)} actions  v${play.version}  ` +
      `${play.updated_at.slice(0, 16).replace("T", " ")}`,
  );
  console.log(`  ${" ".repeat(20)} id: ${play.id}`);
}

const keep = (valueOf("--keep") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const one = valueOf("--delete");

let doomed = [];
if (has("--delete-all")) doomed = plays;
else if (one) doomed = plays.filter((p) => p.id === one);
else if (keep.length) doomed = plays.filter((p) => !keep.includes(p.id));

if (!doomed.length) {
  console.log(
    "\nNothing deleted. Pass --delete-all, --delete <id>, or --keep <id,id>.",
  );
  process.exit(0);
}

const backupDir = resolve(root, "backups");
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backup = resolve(backupDir, `plays-${stamp}.json`);
writeFileSync(backup, JSON.stringify(doomed, null, 2), "utf8");
console.log(`\nBacked up ${doomed.length} play(s) to ${backup}`);
console.log(`Deleting: ${doomed.map((p) => p.name).join(", ")}`);

const { error: delError } = await supabase
  .from("plays")
  .delete()
  .in(
    "id",
    doomed.map((p) => p.id),
  );

if (delError) {
  console.error("Delete failed:", delError.message);
  process.exit(1);
}

console.log(`Done. ${plays.length - doomed.length} play(s) left.`);
console.log(`Undo with: node scripts/playbook-admin.mjs --restore ${backup}`);
