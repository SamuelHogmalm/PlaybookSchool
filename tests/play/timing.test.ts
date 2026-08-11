import assert from "node:assert/strict";
import { describe, it } from "node:test";

import seedPlays from "../../src/data/plays-interpreted.json" with { type: "json" };
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import type { SeedPlay } from "../../src/lib/play/types.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";
import {
  beatDurationMs,
  beatRangeDurationMs,
  HOLD_MS,
  positionsAt,
  sequenceBeat,
  validateSnapshot,
} from "../../src/lib/timing/index.js";

const conn = normalizeSeedPlay(
  (seedPlays as SeedPlay[]).find((p) => p.name === "Conn")!,
);

describe("positionsAt — purity", () => {
  it("returns null for out-of-range beat index", () => {
    assert.equal(positionsAt(conn, -1, 0, "move"), null);
    assert.equal(positionsAt(conn, 99, 0, "move"), null);
  });

  it("idle players stay at startPos during move", () => {
    const beat = conn.beats[0];
    const idle = PLAYER_IDS.find(
      (id) => !beat.actions.some((a) => a.by === id),
    );
    assert.ok(idle);
    const snap = positionsAt(conn, 0, 0.5, "move");
    assert.ok(snap);
    assert.equal(snap!.players[idle!].x, beat.startPos[idle!].x);
    assert.equal(snap!.players[idle!].y, beat.startPos[idle!].y);
  });

  it("hold phase matches beat end positions", () => {
    const snap = positionsAt(conn, 0, 0, "hold");
    assert.ok(snap);
    for (const id of PLAYER_IDS) {
      assert.equal(snap!.players[id].x, conn.beats[0].pos[id].x);
    }
    assert.equal(snap!.possession, conn.beats[0].ball);
  });

  it("never produces NaN coordinates", () => {
    for (let b = 0; b < conn.beats.length; b++) {
      for (const t of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
        const snap = positionsAt(conn, b, t, "move");
        assert.ok(snap);
        assert.equal(validateSnapshot(snap!), true);
      }
    }
  });
});

describe("positionsAt — ball and screen", () => {
  it("ball is in flight mid-pass on Conn b1", () => {
    const timed = sequenceBeat(conn.beats[0]);
    const pass = timed.find((a) => a.type === "pass");
    assert.ok(pass);
    const mid = (pass!.startAt + pass!.endAt) / 2;
    const snap = positionsAt(conn, 0, mid, "move");
    assert.ok(snap);
    assert.equal(snap!.ballInFlight, true);
    const passer = snap!.players[pass!.by];
    const receiver = snap!.players[pass!.for!];
    assert.notDeepEqual(snap!.ball, passer);
    assert.notDeepEqual(snap!.ball, receiver);
  });

  it("screener stops after screen endAt", () => {
    const horns = normalizeSeedPlay(
      (seedPlays as SeedPlay[]).find((p) => p.name === "Horns")!,
    );
    const beatIdx = horns.beats.findIndex((b) =>
      b.actions.some((a) => a.type === "screen"),
    );
    if (beatIdx < 0) return;
    const beat = horns.beats[beatIdx];
    const timed = sequenceBeat(beat);
    const screen = timed.find((a) => a.type === "screen");
    assert.ok(screen);
    const atEnd = positionsAt(horns, beatIdx, screen!.endAt, "move");
    const after = positionsAt(horns, beatIdx, Math.min(1, screen!.endAt + 0.2), "move");
    assert.ok(atEnd && after);
    assert.equal(atEnd!.players[screen!.by].x, after!.players[screen!.by].x);
    assert.equal(atEnd!.players[screen!.by].y, after!.players[screen!.by].y);
  });
});

describe("sequencing", () => {
  it("last action ends at 1.0 after normalize", () => {
    for (const beat of conn.beats) {
      const timed = sequenceBeat(beat);
      if (!timed.length) continue;
      const maxEnd = Math.max(...timed.map((a) => a.endAt));
      assert.ok(Math.abs(maxEnd - 1) < 0.001, `beat ${beat.id} maxEnd=${maxEnd}`);
    }
  });

  it("beat duration scales with action count", () => {
    const short = { ...conn.beats[0], actions: conn.beats[0].actions.slice(0, 1) };
    const long = conn.beats[0];
    assert.ok(beatDurationMs(long) >= beatDurationMs(short));
  });

  it("timeline includes hold after each beat", () => {
    const move = beatDurationMs(conn.beats[0]);
    const total = beatRangeDurationMs(conn, 0, 0);
    assert.equal(total, move + HOLD_MS);
  });
});
