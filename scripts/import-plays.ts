#!/usr/bin/env npx tsx
/**
 * Put an imported book into a team's playbook.
 *
 *   npx tsx scripts/import-plays.ts <candidate.json> [--team <id>] [--dry-run]
 *
 * The pipeline's output is a file; this is the step that makes it a playbook. It runs
 * `validatePlay` first and refuses anything invalid, because a play that does not
 * validate must never reach a quiz — the same bar the save endpoint enforces. That check
 * cannot be skipped from here: this uses the service key and bypasses row-level
 * security, so it also bypasses the API route that would otherwise have caught it.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { SeedPlay } from "../src/lib/play/types.js";
import { validatePlay } from "../src/lib/play/validation.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of existsSync(join(root, ".env.local"))
  ? readFileSync(join(root, ".env.local"), "utf8").split("\n")
  : []) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const key = t.slice(0, i).trim();
  if (!process.env[key]) process.env[key] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };

  const file = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--team");
  if (!file) {
    console.error("Usage: npx tsx scripts/import-plays.ts <candidate.json> [--team <id>]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let teamId = flag("--team");
  if (!teamId) {
    const { data } = await supabase.from("teams").select("id, name").order("created_at");
    if (!data?.length) {
      console.error("No teams exist. Pass --team <id>.");
      process.exit(1);
    }
    teamId = data[0].id;
    console.log(`No --team given; using ${data[0].name} (${teamId}).`);
  }

  const raw = JSON.parse(
    readFileSync(isAbsolute(file) ? file : resolve(root, file), "utf8"),
  ) as SeedPlay[];

  const slug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "play";

  const rows = [];
  let refused = 0;
  for (const seed of raw) {
    const play = normalizeSeedPlay(seed);
    const result = validatePlay(play);
    if (!result.valid) {
      refused++;
      console.log(`✗ ${seed.name} — not imported`);
      for (const e of result.errors) console.log(`    ${e}`);
      continue;
    }
    for (const w of result.warnings) console.log(`  ⚠ ${seed.name}: ${w}`);

    const id = slug(seed.name);
    const { data: existing } = await supabase
      .from("plays")
      .select("version")
      .eq("id", id)
      .maybeSingle();

    const now = new Date().toISOString();
    rows.push({
      id,
      team_id: teamId,
      name: seed.name,
      category: seed.category || "Set",
      folder_id: null,
      beats: play.beats,
      version: existing ? existing.version + 1 : 1,
      valid: true,
      validation_errors: [],
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
    });
    console.log(`✓ ${seed.name} — ${play.beats.length} beats, id ${id}`);
  }

  if (argv.includes("--dry-run")) {
    console.log(`\nDry run. ${rows.length} would be imported, ${refused} refused.`);
    process.exit(0);
  }
  if (!rows.length) {
    console.log("\nNothing to import.");
    process.exit(refused ? 1 : 0);
  }

  const { error } = await supabase.from("plays").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Import failed:", error.message);
    process.exit(1);
  }
  console.log(`\nImported ${rows.length} play(s)${refused ? `, refused ${refused}` : ""}.`);
}

main();
