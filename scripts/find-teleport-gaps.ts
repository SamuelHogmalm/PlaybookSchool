import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { PlayerId, SeedPlay } from "../src/lib/play/types.js";
import { PLAYER_IDS } from "../src/lib/play/types.js";
import { dist } from "../src/lib/play/geometry.js";

const THRESHOLD = 25;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const raw = JSON.parse(
  readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
) as SeedPlay[];

function coversPlayer(
  actions: { type: string; by: string }[],
  id: PlayerId,
): boolean {
  return actions.some(
    (a) =>
      a.by === id &&
      (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
  );
}

type Gap = {
  play: string;
  beat: string;
  player: PlayerId;
  distance: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  actions: string[];
};

const gaps: Gap[] = [];

for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (let i = 0; i < play.beats.length; i++) {
    const beat = play.beats[i];
    for (const id of PLAYER_IDS) {
      const a = beat.startPos[id];
      const b = beat.pos[id];
      if (!a || !b) continue;
      const d = dist(a, b);
      if (d <= THRESHOLD) continue;
      if (coversPlayer(beat.actions, id)) continue;
      gaps.push({
        play: play.name,
        beat: beat.id,
        player: id,
        distance: Math.round(d * 10) / 10,
        start: a,
        end: b,
        actions: beat.actions.map((x) => `${x.id}:${x.type}:${x.by}`),
      });
    }
  }
}

gaps.sort(
  (x, y) =>
    x.play.localeCompare(y.play) ||
    x.beat.localeCompare(y.beat) ||
    x.player.localeCompare(y.player),
);

console.log(`Uncovered moves > ${THRESHOLD}u (no action by player):\n`);
for (const g of gaps) {
  console.log(
    `${g.play.padEnd(14)} ${g.beat}  P${g.player}  ${g.distance}u  (${g.start.x},${g.start.y})→(${g.end.x},${g.end.y})`,
  );
}
console.log(`\nTotal: ${gaps.length}`);

const band25_60 = gaps.filter((g) => g.distance <= 60);
const bandOver60 = gaps.filter((g) => g.distance > 60);
console.log(`  25–60u (rule 9 spacing gap): ${band25_60.length}`);
console.log(`  >60u (large, pass-only or missing derive): ${bandOver60.length}`);

if (band25_60.length) {
  console.log("\n25–60u band:");
  for (const g of band25_60) {
    console.log(`  ${g.play} ${g.beat} P${g.player} ${g.distance}u`);
  }
}

const hornsP2 = gaps.filter((g) => g.play === "Horns" && g.player === "2");
console.log("\nHorns P2 gaps:", hornsP2.length ? hornsP2 : "none");

// Horns b1 raw seed actions for P2
const horns = raw.find((p) => p.name === "Horns");
if (horns) {
  const b1 = horns.beats[0];
  const p2s = b1.startPos?.["2"] ?? b1.pos["2"];
  const p2e = b1.pos["2"];
  console.log("\nHorns b1 raw P2:", p2s, "→", p2e);
  if (p2s && p2e) {
    console.log("Horns b1 raw P2 distance:", dist(p2s, p2e));
  }
  console.log(
    "Horns b1 actions:",
    (b1.actions ?? []).map((a) => `${a.id} ${a.type} by ${a.by}`).join(", "),
  );
}

// P1 on Horns b1 - pass covers but no cut path
const hornsB1 = normalizeSeedPlay(horns!).beats[0];
const p1d = dist(hornsB1.startPos["1"], hornsB1.pos["1"]);
console.log("\nHorns b1 normalized P1 distance:", p1d, "actions cover P1:", coversPlayer(hornsB1.actions, "1"));
