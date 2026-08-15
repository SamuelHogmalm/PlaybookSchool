import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import { validatePlay } from "../src/lib/play/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const raw = JSON.parse(
  readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
);

console.log("=== Seed play validation (plays-interpreted.json) ===\n");

let validCount = 0;
let warningCount = 0;
const report: Array<{
  name: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}> = [];

for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  const result = validatePlay(play);
  report.push({
    name: seed.name,
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  });
  if (result.valid) validCount++;
  warningCount += result.warnings.length;
}

for (const { name, valid, errors, warnings } of report) {
  if (valid) {
    console.log(`✓ ${name}${warnings.length ? ` — ${warnings.length} to review` : ""}`);
  } else {
    console.log(`✗ ${name} (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const e of errors) console.log(`    ${e}`);
  }
  // Warnings do not block a play, but they are the review worklist.
  for (const w of warnings) console.log(`    ⚠ ${w}`);
}

console.log(`\n${validCount}/${report.length} plays valid`);
console.log(`${warningCount} warning${warningCount === 1 ? "" : "s"} to review\n`);
