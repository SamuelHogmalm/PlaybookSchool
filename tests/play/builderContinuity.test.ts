import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addDrawnAction, removeAction } from "../../src/lib/play/actionOps.js";
import {
  addBeat,
  createEmptyPlay,
  deleteBeat,
  duplicateBeat,
  reorderBeat,
  setPlayBeats,
} from "../../src/lib/play/beatOps.js";
import type { Beat, Play, PlayerId } from "../../src/lib/play/types.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";
import { positionsAt } from "../../src/lib/timing/index.js";

/** beat[N].pos must equal beat[N+1].startPos for every N. */
function assertContinuity(beats: Beat[], label: string): void {
  for (let i = 0; i + 1 < beats.length; i++) {
    for (const id of PLAYER_IDS) {
      const end = beats[i].pos[id];
      const nextStart = beats[i + 1].startPos[id];
      assert.deepEqual(
        { x: end.x, y: end.y },
        { x: nextStart.x, y: nextStart.y },
        `${label}: beat ${i + 1}.pos[P${id}] (${end.x},${end.y}) != beat ${i + 2}.startPos[P${id}] (${nextStart.x},${nextStart.y})`,
      );
    }
  }
}

/** A player with no action in a beat must not change position within it. */
function assertIdlePlayersHold(beats: Beat[], label: string): void {
  beats.forEach((beat, i) => {
    const movers = new Set(beat.actions.map((a) => a.by));
    for (const id of PLAYER_IDS) {
      if (movers.has(id)) continue;
      const start = beat.startPos[id];
      const end = beat.pos[id];
      assert.deepEqual(
        { x: end.x, y: end.y },
        { x: start.x, y: start.y },
        `${label}: beat ${i + 1} P${id} has no action but drifts (${start.x},${start.y}) -> (${end.x},${end.y})`,
      );
    }
  });
}

function threeBeatPlay(): Play {
  const play = createEmptyPlay("Continuity");
  return setPlayBeats(play, addBeat(play.beats));
}

const CUT_PATH = [
  { x: 400, y: 200 },
  { x: 360, y: 150 },
  { x: 320, y: 110 },
];

describe("builder write paths preserve beat continuity", () => {
  it("draw a cut on the last beat, then add a beat", () => {
    const play = threeBeatPlay();
    assert.equal(play.beats.length, 3);
    const before = structuredClone(play.beats.slice(0, 2));

    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 2, { type: "cut", by: "2", path: CUT_PATH }),
    );
    assertContinuity(drawn.beats, "after draw on beat 3");
    assertIdlePlayersHold(drawn.beats, "after draw on beat 3");

    const added = setPlayBeats(drawn, addBeat(drawn.beats));
    assert.equal(added.beats.length, 4);
    assertContinuity(added.beats, "after adding beat 4");
    assertIdlePlayersHold(added.beats, "after adding beat 4");

    // Earlier beats must be untouched by either operation.
    assert.deepEqual(
      added.beats.slice(0, 2).map((b) => ({ startPos: b.startPos, pos: b.pos })),
      before.map((b) => ({ startPos: b.startPos, pos: b.pos })),
      "adding a beat changed an earlier beat",
    );

    // The drawn player ends where the path ends, and carries into the new beat.
    const end = CUT_PATH[CUT_PATH.length - 1];
    assert.deepEqual(added.beats[2].pos["2"], end);
    assert.deepEqual(added.beats[3].startPos["2"], end);
    assert.deepEqual(added.beats[3].pos["2"], end);
  });

  it("draw a cut on a middle beat — later idle beats follow, they do not snap back", () => {
    const play = threeBeatPlay();
    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );

    assertContinuity(drawn.beats, "after draw on beat 2");
    assertIdlePlayersHold(drawn.beats, "after draw on beat 2");
  });

  it("duplicate a beat after drawing", () => {
    const play = threeBeatPlay();
    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );
    const dup = setPlayBeats(drawn, duplicateBeat(drawn.beats, 1));

    assert.equal(dup.beats.length, 4);
    assertContinuity(dup.beats, "after duplicate");
    assertIdlePlayersHold(dup.beats, "after duplicate");
  });

  it("reorder beats after drawing", () => {
    const play = threeBeatPlay();
    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );
    const moved = setPlayBeats(drawn, reorderBeat(drawn.beats, 1, 2));

    assert.equal(moved.beats.length, 3);
    assertContinuity(moved.beats, "after reorder");
    assertIdlePlayersHold(moved.beats, "after reorder");
  });

  it("delete a beat after drawing", () => {
    const play = threeBeatPlay();
    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );
    const cut = setPlayBeats(drawn, deleteBeat(drawn.beats, 1));

    assert.equal(cut.beats.length, 2);
    assertContinuity(cut.beats, "after delete");
    assertIdlePlayersHold(cut.beats, "after delete");
  });

  it("deleting a drawn action returns the player to where they started", () => {
    const play = threeBeatPlay();
    const drawn = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );
    const actionId = drawn.beats[1].actions[0].id;
    const undone = setPlayBeats(drawn, removeAction(drawn.beats, 1, actionId));

    assert.deepEqual(undone.beats[1].pos["2"], undone.beats[1].startPos["2"]);
    assertContinuity(undone.beats, "after removing the action");
    assertIdlePlayersHold(undone.beats, "after removing the action");
  });
});

describe("preview is read-only", () => {
  it("positionsAt never mutates the play it is given", () => {
    const play = threeBeatPlay();
    const withAction = setPlayBeats(
      play,
      addDrawnAction(play.beats, 1, { type: "cut", by: "2", path: CUT_PATH }),
    );
    const snapshot = structuredClone(withAction);

    for (let b = 0; b < withAction.beats.length; b++) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        positionsAt(withAction, b, t, "move");
        positionsAt(withAction, b, t, "hold");
      }
    }

    assert.deepEqual(
      withAction,
      snapshot,
      "playback mutated the play — preview must be read-only",
    );
  });
});
