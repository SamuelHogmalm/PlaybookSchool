import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import type { SeedPlay } from "../../src/lib/play/types.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";

function positions(offset = 0): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  PLAYER_IDS.forEach((id, i) => {
    out[id] = { x: 100 + i * 40 + offset, y: 240 + offset };
  });
  return out;
}

describe("normalizeSeedPlay — beat semantics", () => {
  it("resolves a beat's pos from the NEXT beat's startPos", () => {
    // This is what makes drawn arrows line up with FastDraw frames: the arrow on
    // frame N ends where frame N+1 shows the player standing.
    const seed: SeedPlay = {
      name: "Chain",
      beats: [
        { id: "b1", startPos: positions(0), pos: positions(999), ball: "1" },
        { id: "b2", startPos: positions(50), pos: positions(50), ball: "1" },
      ],
    };

    const play = normalizeSeedPlay(seed);
    assert.deepEqual(
      play.beats[0].pos,
      play.beats[1].startPos,
      "beat 1's pos must come from beat 2's startPos, not its own pos field",
    );
    assert.equal(play.beats[0].pos["1"].x, 150);
  });

  it("keeps the chain invariant across every beat", () => {
    const seed: SeedPlay = {
      name: "Three",
      beats: [
        { id: "b1", startPos: positions(0), pos: positions(0), ball: "1" },
        { id: "b2", startPos: positions(30), pos: positions(30), ball: "1" },
        { id: "b3", startPos: positions(70), pos: positions(70), ball: "1" },
      ],
    };

    const play = normalizeSeedPlay(seed);
    for (let i = 0; i < play.beats.length - 1; i++) {
      for (const id of PLAYER_IDS) {
        assert.deepEqual(
          play.beats[i].pos[id],
          play.beats[i + 1].startPos[id],
          `beat ${i + 1} pos !== beat ${i + 2} startPos for player ${id}`,
        );
      }
    }
  });

  it("the last beat keeps its own pos — there is no next beat to read", () => {
    const seed: SeedPlay = {
      name: "End",
      beats: [
        { id: "b1", startPos: positions(0), pos: positions(0), ball: "1" },
        { id: "b2", startPos: positions(20), pos: positions(60), ball: "1" },
      ],
    };
    const play = normalizeSeedPlay(seed);
    assert.equal(play.beats[1].pos["1"].x, 160);
  });

  it("falls back to pos when a beat has no startPos", () => {
    const seed: SeedPlay = {
      name: "Legacy",
      beats: [
        { id: "b1", pos: positions(0), ball: "1" },
        { id: "b2", pos: positions(40), ball: "1" },
      ],
    };
    const play = normalizeSeedPlay(seed);
    assert.deepEqual(play.beats[0].startPos, play.beats[0].pos && positions(0));
    assert.equal(play.beats[0].pos["1"].x, 140, "pos comes from the next beat");
  });

  it("startBall falls back to ball when absent", () => {
    const seed: SeedPlay = {
      name: "Ball",
      beats: [
        { id: "b1", startPos: positions(), pos: positions(), ball: "3" },
        { id: "b2", startPos: positions(), pos: positions(), startBall: "3", ball: "5" },
      ],
    };
    const play = normalizeSeedPlay(seed);
    assert.equal(play.beats[0].startBall, "3");
    assert.equal(play.beats[1].startBall, "3");
    assert.equal(play.beats[1].ball, "5");
  });
});

describe("normalizeSeedPlay — actions and identity", () => {
  const base = (actions: SeedPlay["beats"][number]["actions"]): SeedPlay => ({
    name: "Horns Rip",
    beats: [
      { id: "b1", startPos: positions(), pos: positions(), ball: "1", actions },
      { id: "b2", startPos: positions(), pos: positions(), ball: "1" },
    ],
  });

  it("slugifies the name into the id", () => {
    assert.equal(normalizeSeedPlay(base([])).id, "horns-rip");
    assert.equal(
      normalizeSeedPlay({ ...base([]), name: "  Open — Kick Backs!  " }).id,
      "open-kick-backs",
    );
  });

  it("defaults category and teamId", () => {
    const play = normalizeSeedPlay(base([]));
    assert.equal(play.category, "Set");
    assert.equal(play.teamId, "seed");
    assert.equal(normalizeSeedPlay(base([]), "team-7").teamId, "team-7");
  });

  it("starts invalid — nothing is trusted until validatePlay runs", () => {
    const play = normalizeSeedPlay(base([]));
    assert.equal(play.valid, false);
    assert.deepEqual(play.validationErrors, []);
  });

  it("carries review flags through, and omits them when absent", () => {
    const play = normalizeSeedPlay(
      base([
        { id: "a1", type: "cut", by: "3", derived: true, needsReview: true, reason: "no arrow" },
        { id: "a2", type: "cut", by: "4" },
      ]),
    );
    const [flagged, clean] = play.beats[0].actions;
    assert.equal(flagged.derived, true);
    assert.equal(flagged.needsReview, true);
    assert.equal(flagged.reason, "no arrow");
    assert.ok(!("derived" in clean), "absent flags must not become false");
    assert.ok(!("needsReview" in clean));
  });

  it("copies action paths rather than aliasing the seed", () => {
    const seed = base([
      { id: "a1", type: "cut", by: "3", path: [{ x: 10, y: 10 }, { x: 90, y: 90 }] },
    ]);
    const play = normalizeSeedPlay(seed);
    play.beats[0].actions[0].path![0].x = -1;
    assert.equal(seed.beats[0].actions![0].path![0].x, 10, "seed data was mutated");
  });

  it("rejects an out-of-range player id", () => {
    assert.throws(
      () => normalizeSeedPlay(base([{ id: "a1", type: "cut", by: "9" }])),
      /Invalid action.by: 9/,
    );
  });

  it("rejects an unknown action type", () => {
    assert.throws(
      () => normalizeSeedPlay(base([{ id: "a1", type: "flop", by: "3" }])),
      /Invalid action type: flop/,
    );
  });

  it("rejects an invalid possession id", () => {
    // startBall is checked first because it falls back to ball when absent, so a bad
    // ball with no startBall surfaces as a startBall error.
    assert.throws(
      () =>
        normalizeSeedPlay({
          name: "Bad ball",
          beats: [{ id: "b1", startPos: positions(), pos: positions(), ball: "0" }],
        }),
      /Invalid beat.startBall: 0/,
    );

    assert.throws(
      () =>
        normalizeSeedPlay({
          name: "Bad end ball",
          beats: [
            {
              id: "b1",
              startPos: positions(),
              pos: positions(),
              startBall: "1",
              ball: "9",
            },
          ],
        }),
      /Invalid beat.ball: 9/,
    );
  });

  it("survives a play with no beats", () => {
    const play = normalizeSeedPlay({ name: "Empty", beats: [] });
    assert.deepEqual(play.beats, []);
  });
});
