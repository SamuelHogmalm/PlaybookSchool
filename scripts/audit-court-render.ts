/**
 * Audit CourtRenderer inputs: every seed beat action must resolve endpoints.
 * Run: npx tsx scripts/audit-court-render.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveActionEndpoints } from "../src/lib/court/actionGeometry.js";
import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { SeedPlay } from "../src/lib/play/types.js";
import { PLAYER_IDS } from "../src/lib/play/types.js";

const root = process.cwd();
const raw = JSON.parse(
  readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
) as SeedPlay[];

let beatCount = 0;
const issues: string[] = [];

for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (const beat of play.beats) {
    beatCount++;
    for (const id of PLAYER_IDS) {
      if (!beat.startPos[id]) {
        issues.push(`${seed.name} ${beat.id}: missing startPos P${id}`);
      }
      if (!beat.pos[id]) {
        issues.push(`${seed.name} ${beat.id}: missing pos P${id}`);
      }
    }
    for (const action of beat.actions) {
      const ep = resolveActionEndpoints(beat, action);
      if (!ep) {
        issues.push(
          `${seed.name} ${beat.id} ${action.id} (${action.type}): unresolved endpoints`,
        );
      }
    }
  }
}

console.log(`Audited ${raw.length} plays, ${beatCount} beats`);
if (issues.length) {
  console.log(`\n${issues.length} issue(s):\n${issues.join("\n")}`);
  process.exit(1);
}
console.log("All beats render-ready — no unresolved actions or missing positions.");
