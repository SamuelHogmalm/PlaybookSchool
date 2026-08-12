import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import type { Beat, Play, PlayerId, SeedPlay } from "../../src/lib/play/types.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import { validatePlay } from "../../src/lib/play/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

function pos(
  entries: Partial<Record<PlayerId, { x: number; y: number }>>,
): Record<PlayerId, { x: number; y: number }> {
  const base: Record<PlayerId, { x: number; y: number }> = {
    "1": { x: 250, y: 350 },
    "2": { x: 400, y: 200 },
    "3": { x: 100, y: 200 },
    "4": { x: 330, y: 100 },
    "5": { x: 170, y: 100 },
  };
  return { ...base, ...entries };
}

function beat(
  id: string,
  ball: PlayerId,
  startPositions: Partial<Record<PlayerId, { x: number; y: number }>>,
  actions: Beat["actions"] = [],
  startBall?: PlayerId,
  endPositions?: Partial<Record<PlayerId, { x: number; y: number }>>,
): Beat {
  return {
    id,
    ball,
    startBall: startBall ?? ball,
    startPos: pos(startPositions),
    pos: pos(endPositions ?? startPositions),
    actions,
  };
}

function minimalPlay(beats: Beat[]): Play {
  const now = new Date().toISOString();
  return {
    id: "test-play",
    teamId: "test",
    name: "Test Play",
    category: "Set",
    beats,
    version: 1,
    valid: false,
    validationErrors: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("validatePlay — hand-written fixtures", () => {
  it("accepts a minimal valid two-beat play", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat("b2", "1", {}, [{ id: "a1", type: "dribble", by: "1" }], "1", {
        "1": { x: 200, y: 320 },
      }),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, true, result.errors.join("; "));
  });

  it("rejects a play with fewer than two beats (rule 10)", () => {
    const play = minimalPlay([beat("b1", "1", {})]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("at least two beats")));
  });

  it("rejects missing player positions (rule 1)", () => {
    const b = beat("b1", "1", {});
    delete (b.pos as Partial<Record<PlayerId, { x: number; y: number }>>)["5"];
    const play = minimalPlay([b, beat("b2", "1", {})]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("missing position")));
  });

  it("rejects off-court coordinates (rule 1)", () => {
    const play = minimalPlay([
      beat("b1", "1", { "1": { x: 900, y: 50 } }),
      beat("b2", "1", {}),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("off the court")));
  });

  it("rejects ball teleport without pass (rule 3)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat("b2", "5", {}, [{ id: "a1", type: "cut", by: "2" }]),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("no pass/handoff")));
  });

  it("rejects pass where beat.ball is not the receiver (rule 4)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat("b2", "1", {}, [{ id: "a1", type: "pass", by: "1", for: "5" }]),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("beat.ball")));
  });

  it("rejects pass from non-holder (rule 5)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat("b2", "5", {}, [{ id: "a1", type: "pass", by: "2", for: "5" }]),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("has the ball")));
  });

  it("rejects self pass (rule 6)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat("b2", "1", {}, [{ id: "a1", type: "pass", by: "1", for: "1" }]),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("cannot target themselves")));
  });

  it("rejects screener moving too far (rule 7)", () => {
    const play = minimalPlay([
      beat("b1", "1", { "5": { x: 170, y: 100 } }),
      beat(
        "b2",
        "1",
        { "5": { x: 170, y: 100 } },
        [{ id: "a1", type: "screen", by: "5", for: "2" }],
        "1",
        { "5": { x: 400, y: 300 } },
      ),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("screener")));
  });

  it("rejects teleport distance (rule 8)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat(
        "b2",
        "1",
        { "3": { x: 30, y: 200 } },
        [{ id: "a1", type: "cut", by: "3" }],
        "1",
        { "3": { x: 520, y: 450 } },
      ),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("500")));
  });

  it("allows jitter without action (rule 9, ≤25 units)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat(
        "b2",
        "1",
        { "4": { x: 330, y: 100 } },
        [{ id: "a1", type: "cut", by: "2" }],
        "1",
        { "4": { x: 320, y: 110 } },
      ),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, true, result.errors.join("; "));
  });

  it("rejects idle player movement beyond jitter (rule 9)", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat(
        "b2",
        "1",
        { "4": { x: 330, y: 100 } },
        [{ id: "a1", type: "cut", by: "2" }],
        "1",
        { "4": { x: 280, y: 150 } },
      ),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("moved without an action")));
  });

  it("accepts pass chain when final beat.ball matches last receiver", () => {
    const play = minimalPlay([
      beat("b1", "1", {}),
      beat(
        "b2",
        "4",
        {},
        [
          { id: "a1", type: "pass", by: "1", for: "5" },
          { id: "a2", type: "pass", by: "5", for: "4" },
        ],
        "1",
      ),
    ]);
    const result = validatePlay(play);
    assert.equal(result.valid, true, result.errors.join("; "));
  });
});

describe("validatePlay — seed data (plays-interpreted.json)", () => {
  const raw = JSON.parse(
    readFileSync(join(root, "src/data/plays-interpreted.json"), "utf8"),
  );

  it("loads 12 seed plays", () => {
    assert.equal(raw.length, 12);
  });

  it("all 12 seed plays pass validatePlay (regression)", () => {
    const failures: string[] = [];
    let warningBeats = 0;
    for (const seed of raw) {
      const play = normalizeSeedPlay(seed);
      const { valid, errors, warnings } = validatePlay(play);
      warningBeats += warnings.length;
      if (!valid) {
        failures.push(`${seed.name}: ${errors.join("; ")}`);
      }
    }
    assert.equal(
      failures.length,
      0,
      `Expected 12/12 valid:\n${failures.join("\n")}`,
    );
    // Rule 12 (pass+cut on the same beat) is a non-blocking review queue, not a
    // failure — the count moves whenever the interpret prompt improves. Ceiling, so
    // a legitimate change doesn't look like a regression. 10 at last check.
    assert.ok(
      warningBeats <= 15,
      `rule-12 warnings ${warningBeats} exceeds ceiling 15 — review queue is growing`,
    );
  });

  it("no derived cut/dribble duplicates AI-read on previous beat (idle on N)", () => {
    const violations: string[] = [];
    for (const seed of raw as SeedPlay[]) {
      const beats = seed.beats ?? [];
      for (let i = 1; i < beats.length; i++) {
        const prev = beats[i - 1];
        const cur = beats[i];
        const prevAiMovers = new Set(
          (prev.actions ?? [])
            .filter(
              (a) =>
                (a.type === "cut" || a.type === "dribble") && !a.derived,
            )
            .map((a) => String(a.by)),
        );
        for (const a of cur.actions ?? []) {
          if (!a.derived) continue;
          if (a.type !== "cut" && a.type !== "dribble") continue;
          const pid = String(a.by);
          if (!prevAiMovers.has(pid)) continue;
          const start = cur.startPos?.[pid as PlayerId];
          const end = cur.pos?.[pid as PlayerId];
          const moved =
            start &&
            end &&
            (start.x !== end.x || start.y !== end.y);
          if (!moved) {
            violations.push(
              `${seed.name} ${cur.id}: derived ${a.type} P${pid} duplicates idle AI on ${prev.id}`,
            );
          }
        }
      }
    }
    assert.equal(violations.length, 0, violations.join("\n"));
  });

  it("every beat has startPos and pos; beat N pos equals beat N+1 startPos", () => {
    const failures: string[] = [];
    for (const seed of raw as SeedPlay[]) {
      const beats = seed.beats ?? [];
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        const label = `${seed.name} ${b.id}`;
        if (!b.startPos) {
          failures.push(`${label}: missing startPos`);
          continue;
        }
        if (!b.pos) {
          failures.push(`${label}: missing pos`);
          continue;
        }
        for (const id of PLAYER_IDS) {
          if (!b.startPos[id]) {
            failures.push(`${label}: missing startPos for player ${id}`);
          }
          if (!b.pos[id]) {
            failures.push(`${label}: missing pos for player ${id}`);
          }
        }
        if (i + 1 >= beats.length) continue;
        const next = beats[i + 1];
        if (!next.startPos) {
          failures.push(`${seed.name} ${next.id}: missing startPos for link`);
          continue;
        }
        for (const id of PLAYER_IDS) {
          const end = b.pos?.[id];
          const nextStart = next.startPos[id];
          if (
            end &&
            nextStart &&
            (end.x !== nextStart.x || end.y !== nextStart.y)
          ) {
            failures.push(
              `${label}->${next.id} P${id}: pos (${end.x},${end.y}) != next startPos (${nextStart.x},${nextStart.y})`,
            );
          }
        }
      }
    }
    assert.equal(failures.length, 0, failures.join("\n"));
  });

  // Derived actions are pipeline guesses, not read from the page. A sharp rise means
  // either the AI is missing things or derivation is over-firing. Currently 21 derived
  // of 123 total actions (17%); a jump toward 40+ means investigate.
  it("total derived actions across seed (canary)", () => {
    let derived = 0;
    for (const seed of raw as SeedPlay[]) {
      for (const b of seed.beats ?? []) {
        derived += (b.actions ?? []).filter((a) => a.derived).length;
      }
    }
    assert.ok(
      derived <= 30,
      `derived count ${derived} exceeds canary ceiling 30 — check AI misses or over-derivation`,
    );
  });
});
