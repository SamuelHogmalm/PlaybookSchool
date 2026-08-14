import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addDrawnAction, removeAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import {
  movementActionsForPlayer,
  positionsAt,
  sequenceBeat,
} from "../../src/lib/timing/index.js";
import type { Beat, Play, Vec } from "../../src/lib/play/types.js";

/** Two cuts by player 3: out to the left corner, then across to the right. */
function twoCuts(): { play: Play; start: Vec; first: Vec; second: Vec } {
  const play = createEmptyPlay();
  const start = { ...play.beats[0].startPos["3"] };
  const first = { x: 120, y: 300 };
  const second = { x: 380, y: 300 };

  let beats = addDrawnAction(play.beats, 0, {
    type: "cut",
    by: "3",
    path: [start, first],
  });
  // Drawn from the token again, as the builder did before it anchored strokes.
  beats = addDrawnAction(beats, 0, {
    type: "cut",
    by: "3",
    path: [start, second],
  });

  return { play: { ...play, beats }, start, first, second };
}

describe("two movements by one player", () => {
  it("never overlap in time", () => {
    const { play } = twoCuts();
    const [a, b] = movementActionsForPlayer(sequenceBeat(play.beats[0]), "3");

    assert.ok(a && b, "expected two movements");
    assert.ok(
      b.startAt >= a.endAt,
      `second movement starts at ${b.startAt} before the first ends at ${a.endAt}`,
    );
  });

  it("the second starts where the first finished", () => {
    const { play, first } = twoCuts();
    const [, b] = movementActionsForPlayer(sequenceBeat(play.beats[0]), "3");
    assert.deepEqual(b.path![0], first);
  });

  it("the beat's destination is the end of the last movement", () => {
    const { play, second } = twoCuts();
    assert.deepEqual(play.beats[0].pos["3"], second);
    assert.deepEqual(play.beats[1].startPos["3"], second);
  });

  it("the player travels continuously — no snap between legs", () => {
    const { play, second } = twoCuts();

    let prev = positionsAt(play, 0, 0, "move")!.players["3"];
    let biggestStep = 0;
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const cur = positionsAt(play, 0, Math.min(1, t), "move")!.players["3"];
      biggestStep = Math.max(biggestStep, Math.hypot(cur.x - prev.x, cur.y - prev.y));
      prev = cur;
    }

    // Before the fix the player ran one route and jumped to the other's endpoint,
    // a step of well over 200 units in a single frame.
    assert.ok(
      biggestStep < 40,
      `largest single step was ${biggestStep.toFixed(1)} units — that is a teleport`,
    );
    assert.deepEqual(prev, second, "must finish on the last movement's end");
  });

  it("visits the first destination on the way", () => {
    const { play, first } = twoCuts();
    let closest = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const p = positionsAt(play, 0, Math.min(1, t), "move")!.players["3"];
      closest = Math.min(closest, Math.hypot(p.x - first.x, p.y - first.y));
    }
    assert.ok(closest < 5, `never got within 5 units of the first cut's end (${closest})`);
  });

  it("deleting the first re-anchors the second to the start position", () => {
    const { play, start, second } = twoCuts();
    const firstId = play.beats[0].actions[0].id;
    const beats = removeAction(play.beats, 0, firstId);

    const remaining = beats[0].actions.filter((a) => a.by === "3");
    assert.equal(remaining.length, 1);
    assert.deepEqual(
      remaining[0].path![0],
      start,
      "the surviving cut must start from the player, not from a deleted endpoint",
    );
    assert.deepEqual(beats[0].pos["3"], second);
  });

  it("deleting both returns the player to where they started", () => {
    const { play, start } = twoCuts();
    let beats = removeAction(play.beats, 0, play.beats[0].actions[0].id);
    beats = removeAction(beats, 0, beats[0].actions[0].id);
    assert.deepEqual(beats[0].pos["3"], start);
  });
});

describe("screen then roll still sequences correctly", () => {
  /** The case the multi-movement work was built for — must not regress. */
  function screenThenRoll(): Play {
    const play = createEmptyPlay();
    const start = { ...play.beats[0].startPos["5"] };
    const screenSpot = { x: 300, y: 180 };

    let beats = addDrawnAction(play.beats, 0, {
      type: "screen",
      by: "5",
      for: "1",
      path: [start, screenSpot],
    });
    beats = addDrawnAction(beats, 0, {
      type: "cut",
      by: "5",
      path: [screenSpot, { x: 250, y: 90 }],
    });
    return { ...play, beats };
  }

  it("the roll follows the screen, and both are one player's movements in order", () => {
    const play = screenThenRoll();
    const movements = movementActionsForPlayer(sequenceBeat(play.beats[0]), "5");

    assert.equal(movements.length, 2);
    assert.equal(movements[0].type, "screen");
    assert.equal(movements[1].type, "cut");
    assert.ok(movements[1].startAt >= movements[0].endAt);
  });

  it("the screener ends on the roll, not at the screen", () => {
    const play = screenThenRoll();
    const beat: Beat = play.beats[0];
    assert.deepEqual(beat.pos["5"], { x: 250, y: 90 });

    const end = positionsAt(play, 0, 1, "move")!.players["5"];
    assert.deepEqual(end, { x: 250, y: 90 });
  });
});
