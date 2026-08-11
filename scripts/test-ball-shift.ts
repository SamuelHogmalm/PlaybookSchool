import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { Play, PlayerId } from "../src/lib/play/types.js";
import { validatePlay } from "../src/lib/play/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const interpreted = JSON.parse(
  readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
);
const parserOnly = JSON.parse(
  readFileSync(join(root, "_legacy/src/data/plays.json"), "utf8"),
);

function holderAfterActions(start: PlayerId, actions: Play["beats"][0]["actions"]): PlayerId {
  let h = start;
  for (const a of actions) {
    if (a.type === "pass" || a.type === "handoff") {
      if (a.for) h = a.for;
    } else if (a.type === "dribble") h = a.by;
  }
  return h;
}

/** Hypothesis: parser/AI stored frame START ball in beat.ball; END = next frame START. */
function shiftBallToEnd(play: Play): Play {
  const beats = play.beats.map((b) => ({
    ...b,
    pos: { ...b.pos },
    actions: [...b.actions],
  }));
  for (let i = 0; i < beats.length - 1; i++) {
    beats[i].ball = beats[i + 1].ball;
  }
  const last = beats[beats.length - 1];
  last.ball = holderAfterActions(last.ball, last.actions);
  return { ...play, beats };
}

function countValid(plays: Play[]): number {
  return plays.filter((p) => validatePlay(p).valid).length;
}

console.log("=== Parser-only ball sequences (circled = frame START) ===\n");
for (const p of parserOnly) {
  console.log(`${p.name}: ${p.beats.map((b: { ball: string }) => b.ball).join(" → ")}`);
}

console.log("\n=== Interpreted vs parser ball per beat (Alabama, Kansas) ===\n");
for (const name of ["Alabama", "Kansas"]) {
  const interp = interpreted.find((p: { name: string }) => p.name === name);
  const parser = parserOnly.find((p: { name: string }) => p.name === name);
  console.log(name);
  for (let i = 0; i < interp.beats.length; i++) {
    const ib = interp.beats[i].ball;
    const pb = parser?.beats[i]?.ball ?? "?";
    const next = parser?.beats[i + 1]?.ball ?? "(last)";
    console.log(`  b${i + 1}: parser=${pb}  interpreted=${ib}  next-frame-start=${next}`);
  }
}

console.log("\n=== Validation after ball-end shift (interpreted balls) ===\n");
const original = interpreted.map(normalizeSeedPlay);
const shifted = original.map(shiftBallToEnd);

console.log(`Original interpreted:  ${countValid(original)}/12`);
console.log(`After shift fix:       ${countValid(shifted)}/12\n`);

for (const seed of interpreted) {
  const before = validatePlay(normalizeSeedPlay(seed));
  const after = validatePlay(shiftBallToEnd(normalizeSeedPlay(seed)));
  const delta = before.errors.length - after.errors.length;
  console.log(
    `${seed.name}: ${before.errors.length} → ${after.errors.length} errors (${delta >= 0 ? "-" : "+"}${Math.abs(delta)})`,
  );
}

function applyParserBallEnd(seed: (typeof interpreted)[0]): Play {
  const parser = parserOnly.find((p: { name: string }) => p.name === seed.name);
  if (!parser) return normalizeSeedPlay(seed);
  const play = normalizeSeedPlay(seed);
  const beats = play.beats.map((b) => ({
    ...b,
    pos: { ...b.pos },
    actions: [...b.actions],
  }));
  const pballs = parser.beats.map((b: { ball: string }) => String(b.ball));
  for (let i = 0; i < beats.length - 1; i++) {
    beats[i].ball = pballs[i + 1] as PlayerId;
  }
  const last = beats[beats.length - 1];
  last.ball = holderAfterActions(pballs[pballs.length - 1] as PlayerId, last.actions);
  return { ...play, beats };
}

console.log("\n=== Validation using PARSER ball sequence → beat END ===\n");
const parserFixed = interpreted.map(applyParserBallEnd);
console.log(`Parser ball-end fix: ${countValid(parserFixed)}/12\n`);

for (const seed of interpreted) {
  const r = validatePlay(applyParserBallEnd(seed));
  console.log(
    `${r.valid ? "OK  " : "FAIL"} ${seed.name} (${r.errors.length} err)`,
  );
  if (!r.valid) {
    const ballErrs = r.errors.filter(
      (e) =>
        /ball|pass|handoff|Pass/i.test(e) && !e.includes("moved without"),
    );
    if (ballErrs.length) {
      console.log(`      ball-related (${ballErrs.length}):`);
      ballErrs.slice(0, 3).forEach((e) => console.log(`        ${e}`));
    }
  }
}

function fixEndFromParserStartAndActions(seed: (typeof interpreted)[0]): Play {
  const parser = parserOnly.find((p: { name: string }) => p.name === seed.name);
  if (!parser) return normalizeSeedPlay(seed);
  const play = normalizeSeedPlay(seed);
  const beats = play.beats.map((b) => ({
    ...b,
    pos: { ...b.pos },
    actions: [...b.actions],
  }));
  const pballs = parser.beats.map((b: { ball: string }) => String(b.ball));
  for (let i = 0; i < beats.length; i++) {
    beats[i].ball = holderAfterActions(pballs[i] as PlayerId, beats[i].actions);
  }
  return { ...play, beats };
}

console.log("\n=== beat.ball = simulate(parser START, actions) ===\n");
const actionEnd = interpreted.map(fixEndFromParserStartAndActions);
console.log(`Valid: ${countValid(actionEnd)}/12\n`);
for (const seed of interpreted) {
  const r = validatePlay(fixEndFromParserStartAndActions(seed));
  const ballErrs = r.errors.filter((e) => /ball|pass|handoff/i.test(e) && !e.includes("moved without"));
  console.log(`${r.valid ? "OK  " : "FAIL"} ${seed.name} (${r.errors.length} err, ${ballErrs.length} ball)`);
}
