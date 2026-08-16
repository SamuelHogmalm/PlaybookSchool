/**
 * Score two interpretation runs against the app's own validation.
 *
 *   npx tsx scripts/compare-interpret.ts src/data/plays-interpreted.json src/data/plays-interpreted-gemini.json
 *
 * Token counts and action tallies say how much a model produced. This says whether
 * what it produced holds together as basketball, which is the only comparison that
 * decides whether a run is allowed to become the seed.
 */

import { readFileSync } from "node:fs";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import { validatePlay } from "../src/lib/play/validation.js";
import { reviewPlaybook } from "../src/lib/review/index.js";
import type { Play, SeedPlay } from "../src/lib/play/types.js";

function score(file: string) {
  const raw = JSON.parse(readFileSync(file, "utf8")) as SeedPlay[];
  const plays: Play[] = raw.map((seed) => {
    const play = normalizeSeedPlay(seed);
    const result = validatePlay(play);
    return { ...play, valid: result.valid, validationErrors: result.errors };
  });

  const reviews = reviewPlaybook(plays);
  let bent = 0;
  for (const play of plays) {
    for (const beat of play.beats) {
      for (const action of beat.actions) {
        if ((action.path?.length ?? 0) >= 3) bent++;
      }
    }
  }

  return {
    file,
    plays: reviews.length,
    valid: reviews.filter((r) => r.valid).length,
    actions: reviews.reduce((n, r) => n + r.totalActions, 0),
    derived: reviews.reduce((n, r) => n + r.derivedCount, 0),
    unsure: reviews.reduce((n, r) => n + r.needsReviewCount, 0),
    warnings: reviews.reduce((n, r) => n + r.warnings.length, 0),
    flags: reviews.reduce((n, r) => n + r.flagged.length, 0),
    bent,
    avgConfidence:
      reviews.reduce((n, r) => n + r.confidence, 0) / (reviews.length || 1),
    invalid: reviews.filter((r) => !r.valid).map((r) => `${r.name}: ${r.errors[0]}`),
  };
}

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: compare-interpret.ts <baseline.json> <candidate.json>");
  process.exit(1);
}

const left = score(a);
const right = score(b);

const rows: Array<[string, number, number, "up" | "down"]> = [
  ["Plays valid", left.valid, right.valid, "up"],
  ["Total actions", left.actions, right.actions, "down"],
  ["Derived (invented)", left.derived, right.derived, "down"],
  ["Unsure (needsReview)", left.unsure, right.unsure, "down"],
  ["Validation warnings", left.warnings, right.warnings, "down"],
  ["Review flags", left.flags, right.flags, "down"],
  ["Bent routes", left.bent, right.bent, "up"],
];

console.log(`\nbaseline:  ${left.file}`);
console.log(`candidate: ${right.file}\n`);
console.log("metric".padEnd(24) + "base".padStart(6) + "cand".padStart(7) + "   ");
console.log("-".repeat(48));
for (const [label, l, r, better] of rows) {
  const delta = r - l;
  const good = delta === 0 ? "  " : (better === "up") === delta > 0 ? "✓ " : "✗ ";
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  console.log(
    label.padEnd(24) + String(l).padStart(6) + String(r).padStart(7) + "   " + good + sign,
  );
}
console.log(
  "avg confidence".padEnd(24) +
    left.avgConfidence.toFixed(2).padStart(6) +
    right.avgConfidence.toFixed(2).padStart(7),
);

for (const [label, run] of [["baseline", left], ["candidate", right]] as const) {
  if (run.invalid.length) {
    console.log(`\n${label} has ${run.invalid.length} invalid play(s):`);
    for (const line of run.invalid) console.log(`  ${line}`);
  }
}
console.log();
