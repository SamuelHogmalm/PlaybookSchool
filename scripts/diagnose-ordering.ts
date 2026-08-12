import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeSeedPlay } from "../src/lib/play/normalize.js";
import type { Action, Beat, SeedPlay } from "../src/lib/play/types.js";
import { classifyAction, isMovement, sequenceBeat } from "../src/lib/timing/sequence.js";
import type { TimedAction } from "../src/lib/timing/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const raw = JSON.parse(
  readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
) as SeedPlay[];

type Kind =
  | "screen"
  | "cut"
  | "cut_off_screen"
  | "dribble"
  | "roll"
  | "handoff"
  | "pass";

function defaultLane(kind: Kind): [number, number] {
  switch (kind) {
    case "screen":
      return [0, 0.3];
    case "cut":
      return [0.1, 0.7];
    case "cut_off_screen":
      return [0.25, 0.7];
    case "dribble":
      return [0.25, 0.85];
    case "roll":
      return [0.45, 1];
    case "handoff":
      return [0.4, 0.6];
    case "pass":
      return [0.75, 0.9];
    default:
      return [0.1, 0.7];
  }
}

function cloneTimed(action: Action, startAt: number, endAt: number): TimedAction {
  return {
    ...action,
    path: action.path?.map((p) => ({ x: p.x, y: p.y })),
    startAt,
    endAt,
  };
}

function applyDependenciesWithTrace(
  timed: TimedAction[],
  actions: Action[],
): string[] {
  const log: string[] = [];

  for (const screen of timed.filter((a) => a.type === "screen")) {
    const cutter = screen.for;
    if (!cutter) continue;
    for (const a of timed) {
      if (a.by === cutter && isMovement(a)) {
        const prev = [a.startAt, a.endAt];
        a.startAt = Math.max(a.startAt, screen.endAt);
        if (a.endAt <= a.startAt) a.endAt = a.startAt + 0.25;
        if (prev[0] !== a.startAt || prev[1] !== a.endAt) {
          log.push(
            `Rule1 screen→cutter: ${a.id} (${a.type} P${a.by}) waits for ${screen.id} screen end ${screen.endAt.toFixed(3)} → [${a.startAt.toFixed(3)}, ${a.endAt.toFixed(3)}]`,
          );
        }
      }
    }
  }

  for (const screen of timed.filter((a) => a.type === "screen")) {
    const cutter = screen.for;
    const roll = timed.find(
      (a) =>
        a.type === "cut" &&
        a.by === screen.by &&
        classifyAction(a, actions) === "roll",
    );
    const cutterCut = timed.find((a) => a.by === cutter && isMovement(a));
    if (roll && cutterCut) {
      const prev = [roll.startAt, roll.endAt];
      roll.startAt = Math.max(roll.startAt, cutterCut.endAt);
      if (roll.endAt <= roll.startAt) roll.endAt = roll.startAt + 0.45;
      if (prev[0] !== roll.startAt || prev[1] !== roll.endAt) {
        log.push(
          `Rule2 roll after cutter: ${roll.id} roll P${roll.by} after ${cutterCut.id} end ${cutterCut.endAt.toFixed(3)} → [${roll.startAt.toFixed(3)}, ${roll.endAt.toFixed(3)}]`,
        );
      }
    }
  }

  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const recv = pass.for;
    if (!recv) continue;
    const recvMove = timed.find((a) => a.by === recv && isMovement(a));
    if (recvMove) {
      const releaseAt =
        recvMove.startAt + 0.6 * (recvMove.endAt - recvMove.startAt);
      const prev = [pass.startAt, pass.endAt];
      pass.startAt = Math.max(pass.startAt, releaseAt);
      if (pass.endAt <= pass.startAt) pass.endAt = pass.startAt + 0.15;
      if (prev[0] !== pass.startAt || prev[1] !== pass.endAt) {
        log.push(
          `Rule3 pass after recv 60%: ${pass.id} pass P${pass.by}→P${pass.for} waits recv ${recvMove.id} @ ${releaseAt.toFixed(3)} → [${pass.startAt.toFixed(3)}, ${pass.endAt.toFixed(3)}]`,
        );
      }
    }
  }

  for (const pass of timed.filter(
    (a) => a.type === "pass" || a.type === "handoff",
  )) {
    const recv = pass.for;
    if (!recv) continue;
    for (const a of timed) {
      if (
        a.by === recv &&
        (a.type === "pass" || a.type === "dribble" || a.type === "handoff") &&
        a.id !== pass.id
      ) {
        const prev = [a.startAt, a.endAt];
        a.startAt = Math.max(a.startAt, pass.endAt);
        if (a.endAt <= a.startAt) a.endAt = a.startAt + 0.15;
        if (prev[0] !== a.startAt || prev[1] !== a.endAt) {
          log.push(
            `Rule4 recv catch first: ${a.id} (${a.type} P${a.by}) after ${pass.id} end ${pass.endAt.toFixed(3)} → [${a.startAt.toFixed(3)}, ${a.endAt.toFixed(3)}]`,
          );
        }
      }
    }
  }

  for (const a of timed) {
    if (classifyAction(a, actions) === "cut_off_screen") {
      const screen = timed.find(
        (s) => s.type === "screen" && s.for === a.by,
      );
      if (screen) {
        const prev = [a.startAt, a.endAt];
        a.startAt = Math.max(a.startAt, screen.endAt);
        a.endAt = Math.max(a.endAt, a.startAt + 0.45);
        if (prev[0] !== a.startAt || prev[1] !== a.endAt) {
          log.push(
            `Rule cut_off_screen: ${a.id} after ${screen.id} → [${a.startAt.toFixed(3)}, ${a.endAt.toFixed(3)}]`,
          );
        }
      }
    }
  }

  return log;
}

function sequenceWithTrace(beat: Beat): {
  timed: TimedAction[];
  log: string[];
} {
  const actions = beat.actions ?? [];
  const timed: TimedAction[] = actions.map((action) => {
    const kind = classifyAction(action, actions) as Kind;
    const [startAt, endAt] = defaultLane(kind);
    return cloneTimed(action, startAt, endAt);
  });

  const initial = timed
    .map(
      (a) =>
        `${a.id} ${a.type} P${a.by}${a.for ? `→P${a.for}` : ""} lane [${a.startAt.toFixed(2)}, ${a.endAt.toFixed(2)}]`,
    )
    .join("\n    ");

  const log = [`Default lanes:\n    ${initial}`];
  log.push(...applyDependenciesWithTrace(timed, actions));

  const maxEnd = Math.max(0.001, ...timed.map((a) => a.endAt));
  if (maxEnd !== 1) {
    const scale = 1 / maxEnd;
    for (const a of timed) {
      a.startAt *= scale;
      a.endAt *= scale;
    }
    log.push(`Normalized ×${scale.toFixed(4)} so last endAt = 1.0`);
  }

  timed.sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
  return { timed, log };
}

console.log("=== Beats with pass AND cut ===\n");
for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (const beat of play.beats) {
    const hasPass = beat.actions.some((a) => a.type === "pass");
    const hasCut = beat.actions.some((a) => a.type === "cut");
    if (!hasPass || !hasCut) continue;

    const { timed, log } = sequenceWithTrace(beat);
    const official = sequenceBeat(beat);

    console.log(`--- ${seed.name} ${beat.id} startBall=${beat.startBall} ---`);
    for (const line of log) console.log(line);
    console.log("Final timing:");
    for (const a of timed) {
      const o = official.find((x) => x.id === a.id)!;
      console.log(
        `  ${a.id} ${a.type} P${a.by}${a.for ? `→P${a.for}` : ""} [${a.startAt.toFixed(3)}, ${a.endAt.toFixed(3)}]`,
      );
    }
    console.log("");
  }
}

console.log("\n=== Pass receiver same as cutter on beat ===\n");
for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (const beat of play.beats) {
    for (const pass of beat.actions.filter((a) => a.type === "pass" && a.for)) {
      const cutter = beat.actions.find(
        (a) => a.type === "cut" && a.by === pass.for,
      );
      if (cutter) {
        const t = sequenceBeat(beat);
        const p = t.find((x) => x.id === pass.id)!;
        const c = t.find((x) => x.id === cutter.id)!;
        console.log(
          `${seed.name} ${beat.id}: pass ${pass.id} P${pass.by}→P${pass.for}, cut ${cutter.id} P${cutter.by} | cut [${c.startAt.toFixed(3)},${c.endAt.toFixed(3)}] pass [${p.startAt.toFixed(3)},${p.endAt.toFixed(3)}] cut${c.startAt < p.startAt ? " BEFORE" : " AFTER"} pass`,
        );
      }
    }
  }
}

console.log("\n=== Same player pass AND cut on beat ===\n");
for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (const beat of play.beats) {
    const byPlayer = new Map<string, Action[]>();
    for (const a of beat.actions) {
      if (a.type !== "pass" && a.type !== "cut") continue;
      const list = byPlayer.get(a.by) ?? [];
      list.push(a);
      byPlayer.set(a.by, list);
    }
    for (const [pid, acts] of byPlayer) {
      const types = new Set(acts.map((a) => a.type));
      if (types.has("pass") && types.has("cut")) {
        const t = sequenceBeat(beat);
        console.log(`${seed.name} ${beat.id} P${pid}:`);
        for (const a of acts) {
          const x = t.find((y) => y.id === a.id)!;
          console.log(
            `  ${a.id} ${a.type}${a.for ? `→P${a.for}` : ""} [${x.startAt.toFixed(3)}, ${x.endAt.toFixed(3)}]`,
          );
        }
      }
    }
  }
}

console.log("\n=== Suspicious: holder pass+cut/dribble wrong order ===\n");
for (const seed of raw) {
  const play = normalizeSeedPlay(seed);
  for (const beat of play.beats) {
    const holder = beat.startBall;
    const holderPass = beat.actions.find(
      (a) => a.type === "pass" && a.by === holder,
    );
    const holderMove = beat.actions.find(
      (a) =>
        (a.type === "cut" || a.type === "dribble") && a.by === holder,
    );
    if (!holderPass || !holderMove) continue;
    const t = sequenceBeat(beat);
    const p = t.find((x) => x.id === holderPass.id)!;
    const m = t.find((x) => x.id === holderMove.id)!;
    if (m.startAt < p.startAt) {
      console.log(
        `${seed.name} ${beat.id}: holder P${holder} ${holderMove.type} ${holderMove.id} [${m.startAt.toFixed(3)},${m.endAt.toFixed(3)}] BEFORE pass ${holderPass.id} [${p.startAt.toFixed(3)},${p.endAt.toFixed(3)}]`,
      );
    }
  }
}
