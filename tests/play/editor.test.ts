import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import {
  addBeat,
  applyPresetToBeat,
  createEmptyPlay,
  linkBeatPositions,
  updateBeatPlayerPos,
} from "../../src/lib/play/beatOps.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";

function assertContinuity(beats: ReturnType<typeof createEmptyPlay>["beats"]) {
  for (let i = 1; i < beats.length; i++) {
    for (const id of PLAYER_IDS) {
      const prev = beats[i - 1].pos[id];
      const start = beats[i].startPos[id];
      assert.equal(
        prev.x,
        start.x,
        `beat ${i} startPos P${id}.x`,
      );
      assert.equal(
        prev.y,
        start.y,
        `beat ${i} startPos P${id}.y`,
      );
    }
  }
}

describe("play editor — position continuity", () => {
  // Beat 1 is the opening alignment — there is no earlier beat to inherit from, so
  // dragging an idle player there relocates them outright. Moving pos alone would
  // leave startPos != pos with no action, which violates validation rule 9 on the
  // first drag, and would disagree with applyPresetToBeat, which already moves both.
  it("updateBeatPlayerPos on beat 1 moves an idle player's whole alignment", () => {
    const play = createEmptyPlay();
    const beats = updateBeatPlayerPos(play.beats, 0, "2", { x: 103, y: 207 });

    assert.equal(beats[0].pos["2"].x, 100);
    assert.equal(beats[0].pos["2"].y, 210);
    assert.equal(beats[0].startPos["2"].x, 100);
    assert.equal(beats[0].startPos["2"].y, 210);
    assert.equal(beats[1].startPos["2"].x, 100);
    assert.equal(beats[1].startPos["2"].y, 210);
    assertContinuity(beats);
  });

  // With an action, the drag is setting a destination, so startPos stays put.
  it("updateBeatPlayerPos on beat 1 moves only pos when the player has an action", () => {
    const play = createEmptyPlay();
    const originalStart = play.beats[0].startPos["2"].x;
    const withCut = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "2",
      path: [
        { x: 400, y: 200 },
        { x: 300, y: 150 },
      ],
    });
    const beats = updateBeatPlayerPos(withCut, 0, "2", { x: 103, y: 207 });

    assert.equal(beats[0].pos["2"].x, 100);
    assert.equal(beats[0].startPos["2"].x, originalStart);
    assertContinuity(beats);
  });

  it("addBeat clones previous pos into startPos and pos", () => {
    let beats = createEmptyPlay().beats;
    beats = updateBeatPlayerPos(beats, 0, "3", { x: 200, y: 150 });
    beats = addBeat(beats);
    const last = beats[beats.length - 1];
    const prev = beats[beats.length - 2];
    for (const id of PLAYER_IDS) {
      assert.equal(last.startPos[id].x, prev.pos[id].x);
      assert.equal(last.pos[id].x, prev.pos[id].x);
    }
    assertContinuity(beats);
  });

  it("applyPreset on beat 0 sets startPos and pos; beat 1 startPos follows", () => {
    let beats = createEmptyPlay().beats;
    beats = applyPresetToBeat(beats, 0, "Box");
    assert.equal(beats[0].startPos["4"].x, 180);
    assert.equal(beats[0].pos["4"].x, 180);
    assert.equal(beats[1].startPos["4"].x, 180);
    assertContinuity(beats);
  });

  it("applyPreset on beat 1+ only moves pos, preserves startPos link", () => {
    let beats = createEmptyPlay().beats;
    beats = applyPresetToBeat(beats, 1, "5-out");
    assert.equal(beats[1].pos["2"].x, 60);
    assertContinuity(beats);
  });

  it("linkBeatPositions repairs gaps after external edits", () => {
    let beats = createEmptyPlay().beats;
    beats[1].startPos["1"] = { x: 999, y: 999 };
    beats = linkBeatPositions(beats);
    assertContinuity(beats);
  });

  it("dragging on beat 2 updates beat[2].pos only, not beat[1].pos", () => {
    let beats = createEmptyPlay().beats;
    beats = updateBeatPlayerPos(beats, 0, "2", { x: 120, y: 80 });
    beats = addBeat(beats);

    const beat1PosBefore = { ...beats[0].pos["2"] };
    const beat2StartBefore = { ...beats[1].startPos["2"] };

    beats = updateBeatPlayerPos(beats, 1, "2", { x: 200, y: 140 });

    assert.deepEqual(beats[0].pos["2"], beat1PosBefore);
    assert.equal(beats[1].pos["2"].x, 200);
    assert.equal(beats[1].pos["2"].y, 140);
    assert.deepEqual(beats[1].startPos["2"], beat2StartBefore);
    assert.equal(beats[2].startPos["2"].x, 200);
    assert.equal(beats[2].startPos["2"].y, 140);
    assertContinuity(beats);
  });
});
