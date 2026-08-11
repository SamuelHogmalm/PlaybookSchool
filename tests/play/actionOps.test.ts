import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDrawnAction,
  confirmAction,
  confirmPlayActions,
  isValidDraw,
  removeAction,
} from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import { canDrawAction } from "../../src/lib/play/drawing.js";
import { ALIGNMENT_PRESETS, copyPositions } from "../../src/lib/play/editor.js";
import type { Beat, PlayerId } from "../../src/lib/play/types.js";
import { validatePlay } from "../../src/lib/play/validation.js";

function hornsBeat(ball: PlayerId = "1"): Beat {
  const pos = copyPositions(ALIGNMENT_PRESETS.Horns);
  return {
    id: "b1",
    startPos: copyPositions(pos),
    pos: copyPositions(pos),
    startBall: ball,
    ball,
    actions: [],
  };
}

describe("actionOps", () => {
  it("pass on beat 1 updates beat 2 startBall", () => {
    const play = createEmptyPlay();
    const path = [
      play.beats[0].startPos["1"],
      play.beats[0].startPos["5"],
    ];
    const next = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "5",
      path,
    });
    assert.equal(next[0].ball, "5");
    assert.equal(next[1].startBall, "5");
    assert.equal(next[1].ball, "5");
  });

  it("screen with path updates screener pos once", () => {
    const beats = [hornsBeat()];
    const end = { x: 280, y: 250 };
    const path = [beats[0].startPos["5"], { x: 260, y: 220 }, end];
    const next = addDrawnAction(beats, 0, {
      type: "screen",
      by: "5",
      for: "1",
      path,
    });
    assert.equal(next[0].actions.length, 1);
    assert.equal(next[0].actions[0].type, "screen");
    assert.ok((next[0].actions[0].path?.length ?? 0) > 1);
    assert.deepEqual(next[0].pos["5"], end);
  });

  it("rejects invalid draws", () => {
    const beats = [hornsBeat("1")];
    assert.equal(
      isValidDraw({
        type: "pass",
        by: "1",
        path: [beats[0].startPos["1"], { x: 100, y: 100 }],
      }),
      false,
    );
  });

  it("confirmAction clears review flags", () => {
    const beats = [hornsBeat()];
    beats[0].actions = [
      {
        id: "a1",
        type: "screen",
        by: "5",
        for: "1",
        needsReview: true,
        derived: true,
        reason: "zero travel",
      },
    ];
    const next = confirmAction(beats, 0, "a1");
    assert.equal(next[0].actions[0].needsReview, undefined);
    assert.equal(next[0].actions[0].derived, undefined);
  });

  it("confirmPlayActions clears all flags", () => {
    const play = createEmptyPlay();
    play.beats[0].actions = [
      { id: "a1", type: "cut", by: "2", needsReview: true },
    ];
    const next = confirmPlayActions(play);
    assert.equal(next.beats[0].actions[0].needsReview, undefined);
  });

  it("removeAction drops by id", () => {
    const beats = [hornsBeat()];
    beats[0].actions = [{ id: "a1", type: "cut", by: "2" }];
    const next = removeAction(beats, 0, "a1");
    assert.equal(next[0].actions.length, 0);
  });
});

describe("canDrawAction — ball gate", () => {
  it("palette rejects pass when selected player lacks ball", () => {
    const beat = hornsBeat("1");
    const gate = canDrawAction(beat, "2", "pass");
    assert.equal(gate.allowed, false);
    assert.match(gate.tooltip, /player 1 has the ball/);
  });

  it("palette allows pass when selected player holds ball", () => {
    const beat = hornsBeat("1");
    assert.equal(canDrawAction(beat, "1", "pass").allowed, true);
  });

  it("draw rejects pass from non-holder token even if pass tool is active", () => {
    const beat = hornsBeat("1");
    const gate = canDrawAction(beat, "2", "pass");
    assert.equal(gate.allowed, false);
  });

  it("draw allows pass from holder token after token selects that player", () => {
    const beat = hornsBeat("1");
    assert.equal(canDrawAction(beat, "1", "pass").allowed, true);
  });

  it("cut is allowed from any player token", () => {
    const beat = hornsBeat("1");
    assert.equal(canDrawAction(beat, "2", "cut").allowed, true);
  });
});

describe("horns checkpoint sketch", () => {
  it("ball screen, roll, pin down, and pass validate on one beat", () => {
    let beats = [hornsBeat("1")];
    const b = beats[0];

    beats = addDrawnAction(beats, 0, {
      type: "dribble",
      by: "1",
      path: [b.startPos["1"], { x: 250, y: 320 }, { x: 260, y: 280 }],
    });

    beats = addDrawnAction(beats, 0, {
      type: "screen",
      by: "5",
      for: "1",
      path: [b.startPos["5"], { x: 280, y: 240 }, { x: 270, y: 260 }],
    });

    beats = addDrawnAction(beats, 0, {
      type: "cut",
      by: "5",
      path: [
        beats[0].pos["5"],
        { x: 250, y: 220 },
        { x: 250, y: 160 },
      ],
    });

    beats = addDrawnAction(beats, 0, {
      type: "screen",
      by: "4",
      for: "3",
      path: [b.startPos["4"], { x: 200, y: 240 }, { x: 180, y: 260 }],
    });

    beats = addDrawnAction(beats, 0, {
      type: "pass",
      by: "1",
      for: "3",
      path: [beats[0].startPos["1"], beats[0].startPos["3"]],
    });

    const play = { ...createEmptyPlay(), beats: [beats[0], createEmptyPlay().beats[1]] };
    play.beats[1].startBall = beats[0].ball;
    play.beats[1].ball = beats[0].ball;

    const result = validatePlay(play);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });
});
