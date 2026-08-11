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
const report: Array<{ name: string; valid: boolean; errors: string[] }> = [];

for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  const result = validatePlay(play);
  report.push({ name: seed.name, valid: result.valid, errors: result.errors });
  if (result.valid) validCount++;
}

for (const { name, valid, errors } of report) {
  if (valid) {
    console.log(`✓ ${name}`);
  } else {
    console.log(`✗ ${name} (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const e of errors) console.log(`    ${e}`);
  }
}

console.log(`\n${validCount}/${report.length} plays valid\n`);
