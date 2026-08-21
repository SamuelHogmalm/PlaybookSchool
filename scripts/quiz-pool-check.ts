#!/usr/bin/env npx tsx
/** How many questions the current playbook can actually ask. */
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { SeedPlay } from "../src/lib/play/types.js";
import { validatePlay } from "../src/lib/play/validation.js";
import { generateForPlays } from "../src/lib/quiz/generate.js";
import { SESSION_MIN, buildSession } from "../src/lib/quiz/session.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (!files.length) files.push("src/data/plays-interpreted.json");

const plays = files.flatMap((f) => {
  const raw = JSON.parse(
    readFileSync(isAbsolute(f) ? f : resolve(root, f), "utf8"),
  ) as SeedPlay[];
  return raw.map((seed) => {
    const play = normalizeSeedPlay(seed);
    const result = validatePlay(play);
    return { ...play, valid: result.valid, validationErrors: result.errors };
  });
});

const pool = generateForPlays(plays.filter((p) => p.valid), 1);
const byType = new Map<string, number>();
for (const q of pool) byType.set(q.type, (byType.get(q.type) ?? 0) + 1);

console.log(`${plays.length} play(s), ${pool.length} question(s) in the pool\n`);
for (const [type, n] of [...byType].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${type}`);
}
const session = buildSession(pool, { seed: 1 });
console.log(`\nA session would be ${session.length} question(s) (minimum ${SESSION_MIN}).`);
console.log(session.map((q, i) => `  ${i + 1}. ${q.type}`).join("\n"));
