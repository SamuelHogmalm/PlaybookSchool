import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDrawnAction,
  confirmAction,
  confirmPlayActions,
  isValidDraw,
  nextActionId,
  removeAction,
  upsertDrawnAction,
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

describe("upsertDrawnAction — a drag rewrites one action", () => {
  /** Successive frames of one stroke, each a bit longer than the last. */
  function strokeFrames(from: { x: number; y: number }, frames: number) {
    return Array.from({ length: frames }, (_, f) =>
      Array.from({ length: f + 2 }, (_, i) => ({
        x: from.x + i * 14,
        y: from.y - i * 9,
      })),
    );
  }

  it("replaces in place instead of appending a new action per frame", () => {
    const play = createEmptyPlay();
    const id = nextActionId(play.beats[0].actions);
    let beats = play.beats;

    for (const path of strokeFrames(play.beats[0].startPos["3"], 6)) {
      beats = upsertDrawnAction(beats, 0, { type: "cut", by: "3", path }, id);
    }

    assert.equal(beats[0].actions.length, 1, "a drag must leave exactly one action");
    assert.equal(beats[0].actions[0].id, id);
  });

  it("tracks the destination live as the stroke grows", () => {
    const play = createEmptyPlay();
    const id = nextActionId(play.beats[0].actions);
    const frames = strokeFrames(play.beats[0].startPos["3"], 5);
    let beats = play.beats;

    for (const path of frames) {
      beats = upsertDrawnAction(beats, 0, { type: "cut", by: "3", path }, id);
      const end = path[path.length - 1];
      assert.deepEqual(
        beats[0].pos["3"],
        end,
        "pos must follow the stroke, not wait for pointer-up",
      );
      assert.deepEqual(beats[1].startPos["3"], end, "the next beat follows too");
    }
  });

  it("a drag then a completed draw is indistinguishable from one draw", () => {
    const play = createEmptyPlay();
    const frames = strokeFrames(play.beats[0].startPos["2"], 5);
    const finalPath = frames[frames.length - 1];
    const id = nextActionId(play.beats[0].actions);

    let dragged = play.beats;
    for (const path of frames) {
      dragged = upsertDrawnAction(dragged, 0, { type: "cut", by: "2", path }, id);
    }
    const direct = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "2",
      path: finalPath,
    });

    assert.deepEqual(dragged[0].actions, direct[0].actions);
    assert.deepEqual(dragged[0].pos, direct[0].pos);
  });

  it("without an id it appends, as addDrawnAction always did", () => {
    const play = createEmptyPlay();
    let beats = upsertDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: [play.beats[0].startPos["3"], { x: 300, y: 300 }],
    });
    beats = upsertDrawnAction(beats, 0, {
      type: "cut",
      by: "4",
      path: [play.beats[0].startPos["4"], { x: 200, y: 300 }],
    });
    assert.equal(beats[0].actions.length, 2);
    assert.deepEqual(beats[0].actions.map((a) => a.id), ["a1", "a2"]);
  });
});

describe("removeAction — possession is given back", () => {
  it("deleting a pass returns the ball to the passer", () => {
    const play = createEmptyPlay();
    const withPass = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "5",
      path: [play.beats[0].startPos["1"], play.beats[0].startPos["5"]],
    });
    assert.equal(withPass[0].ball, "5");

    const cleaned = removeAction(withPass, 0, withPass[0].actions[0].id);
    assert.equal(cleaned[0].ball, "1", "the ball must go back to the start holder");
    assert.equal(cleaned[1].startBall, "1");
    assert.ok(
      validatePlay({ ...play, beats: cleaned }).errors.every(
        (e) => !/ball/i.test(e),
      ),
      "removing a pass must not leave a ball-continuity error behind",
    );
  });

  it("deleting one pass of a chain leaves the rest intact", () => {
    const play = createEmptyPlay();
    let beats = addDrawnAction(play.beats, 0, {
      type: "pass",
      by: "1",
      for: "5",
      path: [play.beats[0].startPos["1"], play.beats[0].startPos["5"]],
    });
    beats = addDrawnAction(beats, 1, {
      type: "pass",
      by: "5",
      for: "3",
      path: [beats[1].startPos["5"], beats[1].startPos["3"]],
    });
    assert.equal(beats[1].ball, "3");

    const cleaned = removeAction(beats, 1, beats[1].actions[0].id);
    assert.equal(cleaned[0].ball, "5", "the first beat's pass is untouched");
    assert.equal(cleaned[1].ball, "5", "the second beat falls back to its start holder");
  });

  it("deleting a cut still returns the player to where they started", () => {
    const play = createEmptyPlay();
    const start = { ...play.beats[0].startPos["4"] };
    const withCut = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "4",
      path: [start, { x: 200, y: 320 }],
    });
    const cleaned = removeAction(withCut, 0, withCut[0].actions[0].id);
    assert.deepEqual(cleaned[0].pos["4"], start);
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
