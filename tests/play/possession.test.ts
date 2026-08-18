import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentHolder, holderAfterActions } from "../../src/lib/play/possession.js";
import { canDrawAction } from "../../src/lib/play/drawing.js";
import { addDrawnAction, removeAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import type { Beat } from "../../src/lib/play/types.js";

describe("holderAfterActions", () => {
  it("follows a chain of passes in order", () => {
    assert.equal(
      holderAfterActions("1", [
        { id: "a1", type: "pass", by: "1", for: "4" },
        { id: "a2", type: "pass", by: "4", for: "2" },
      ]),
      "2",
    );
  });

  it("is unmoved by cuts, screens and dribbles", () => {
    assert.equal(
      holderAfterActions("3", [
        { id: "a1", type: "cut", by: "5" },
        { id: "a2", type: "screen", by: "4", for: "5" },
        { id: "a3", type: "dribble", by: "3" },
      ]),
      "3",
    );
  });

  it("counts a handoff as a transfer", () => {
    assert.equal(
      holderAfterActions("1", [{ id: "a1", type: "handoff", by: "1", for: "5" }]),
      "5",
    );
  });
});

describe("the draw gate follows the ball within a beat", () => {
  /** Openkickbacks in miniature: 1 passes to 4, then 4 should be able to dribble. */
  function afterPassTo4(): Beat {
    const play = createEmptyPlay();
    const beats = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "4",
      path: [play.beats[0].startPos["1"], play.beats[0].startPos["4"]],
    });
    return beats[0];
  }

  it("lets the receiver dribble once the pass is drawn", () => {
    const beat = afterPassTo4();
    assert.equal(currentHolder(beat), "4");
    assert.equal(canDrawAction(beat, "4", "dribble").allowed, true);
  });

  it("stops the passer dribbling after they have given it away", () => {
    const beat = afterPassTo4();
    const gate = canDrawAction(beat, "1", "dribble");
    assert.equal(gate.allowed, false);
    assert.match(gate.tooltip, /has the ball now/);
  });

  it("still gates on the start holder before anything is drawn", () => {
    const play = createEmptyPlay();
    assert.equal(canDrawAction(play.beats[0], "1", "dribble").allowed, true);
    assert.equal(canDrawAction(play.beats[0], "4", "dribble").allowed, false);
  });

  it("hands the ball back when the pass is deleted", () => {
    const play = createEmptyPlay();
    const withPass = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "4",
      path: [play.beats[0].startPos["1"], play.beats[0].startPos["4"]],
    });
    const cleaned = removeAction(withPass, 0, withPass[0].actions[0].id);

    assert.equal(currentHolder(cleaned[0]), "1");
    assert.equal(canDrawAction(cleaned[0], "1", "dribble").allowed, true);
    assert.equal(canDrawAction(cleaned[0], "4", "dribble").allowed, false);
  });

  it("follows a chain: 1 to 4, 4 to 2, then only 2 may act", () => {
    const play = createEmptyPlay();
    let beats = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "4",
      path: [play.beats[0].startPos["1"], play.beats[0].startPos["4"]],
    });
    beats = addDrawnAction(beats, 0, {
      type: "pass",
      by: "4",
      for: "2",
      path: [beats[0].startPos["4"], beats[0].startPos["2"]],
    });

    assert.equal(currentHolder(beats[0]), "2");
    assert.equal(canDrawAction(beats[0], "2", "dribble").allowed, true);
    assert.equal(canDrawAction(beats[0], "4", "dribble").allowed, false);
  });

  it("never gates a cut on possession", () => {
    const beat = afterPassTo4();
    for (const id of ["1", "2", "3", "4", "5"] as const) {
      assert.equal(canDrawAction(beat, id, "cut").allowed, true);
    }
  });
});
