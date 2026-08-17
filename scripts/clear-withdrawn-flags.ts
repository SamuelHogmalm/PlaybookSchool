/**
 * Clear review flags raised by rules that have since been withdrawn.
 *
 *   npx tsx scripts/clear-withdrawn-flags.ts            # report only
 *   npx tsx scripts/clear-withdrawn-flags.ts --write    # apply
 *
 * A flag is a request for a coach's attention. When the rule behind one is withdrawn,
 * leaving it in the data asks for attention on a question nobody is asking any more —
 * and a review queue full of those teaches people to skim past the real ones.
 *
 * This exists rather than a re-import because re-running interpretation re-rolls every
 * read in the book. The 2026-08-16 candidate did exactly that and came back with an
 * invalid play, so the safe subset of the win is taken directly instead.
 */

import { readFileSync, writeFileSync } from "node:fs";

import type { SeedPlay } from "../src/lib/play/types.js";

/** Reasons whose rule no longer exists. Match on a distinctive fragment. */
const WITHDRAWN = [
  {
    match: "passes and cuts on the same beat",
    why: "rule 12, withdrawn 2026-08-16 — pass-then-cut is unambiguous",
  },
];

const FILE = "src/data/plays-interpreted.json";
const write = process.argv.includes("--write");

const plays = JSON.parse(readFileSync(FILE, "utf8")) as SeedPlay[];

let cleared = 0;
const byReason = new Map<string, number>();

for (const play of plays) {
  for (const beat of play.beats ?? []) {
    for (const action of beat.actions ?? []) {
      const reason = action.reason;
      if (!reason) continue;
      const hit = WITHDRAWN.find((w) => reason.includes(w.match));
      if (!hit) continue;

      byReason.set(hit.why, (byReason.get(hit.why) ?? 0) + 1);
      cleared++;
      delete action.needsReview;
      delete action.reason;
    }
  }
}

console.log(`${cleared} flag(s) raised by withdrawn rules:`);
for (const [why, count] of byReason) console.log(`  ${count}  ${why}`);

if (!cleared) {
  console.log("\nNothing to clear.");
} else if (write) {
  writeFileSync(FILE, JSON.stringify(plays, null, 1) + "\n", "utf8");
  console.log(`\nWrote ${FILE}`);
} else {
  console.log("\nDry run — pass --write to apply.");
}
