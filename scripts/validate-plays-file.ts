import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import { validatePlay } from "../src/lib/play/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const file = process.argv[2] ?? "src/data/plays-interpreted-v2.json";

const raw = JSON.parse(readFileSync(join(root, file), "utf8"));

let validCount = 0;
let warningCount = 0;
const report: Array<{ name: string; valid: boolean; errors: string[]; warnings: string[] }> = [];

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

console.log(`=== validatePlay: ${file} ===\n`);

for (const { name, valid, errors, warnings } of report) {
  if (valid && warnings.length === 0) {
    console.log(`✓ ${name}`);
  } else if (valid) {
    console.log(`✓ ${name} (${warnings.length} warning${warnings.length === 1 ? "" : "s"})`);
    for (const w of warnings) console.log(`    ⚠ ${w}`);
  } else {
    console.log(`✗ ${name} (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const e of errors) console.log(`    ${e}`);
  }
}

console.log(`\n${validCount}/${report.length} plays valid`);
console.log(`${warningCount} rule-12 warnings total\n`);
