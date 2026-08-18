import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeBeatWithPrevious,
  positionsAfter,
  recentActionIds,
  splitBeatAtStep,
  suggestedSplits,
} from "../../src/lib/play/splitBeats.js";
import {
  addDrawnAction,
  moveActionInSequence,
  setActionStep,
} from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import { validatePlay } from "../../src/lib/play/validation.js";
import { PLAYER_IDS, type Beat } from "../../src/lib/play/types.js";

/**
 * One beat drawn as a continuous sequence, the way a coach would:
 * 1 dribbles out, passes to 5, then 3 cuts and 4 cuts.
 */
function longSequence() {
  const play = createEmptyPlay();
  let beats = addDrawnAction(play.beats, 0, {
    type: "dribble",
    by: "1",
    path: [play.beats[0].startPos["1"], { x: 150, y: 300 }],
  });
  beats = addDrawnAction(beats, 0, {
    type: "pass",
    by: "1",
    for: "5",
    path: [beats[0].pos["1"], beats[0].startPos["5"]],
  });
  beats = addDrawnAction(beats, 0, {
    type: "cut",
    by: "3",
    path: [beats[0].startPos["3"], { x: 300, y: 320 }],
  });
  beats = addDrawnAction(beats, 0, {
    type: "cut",
    by: "4",
    path: [beats[0].startPos["4"], { x: 100, y: 120 }],
  });
  return { play, beats };
}

function chainHolds(beats: Beat[]) {
  for (let i = 0; i < beats.length - 1; i++) {
    for (const id of PLAYER_IDS) {
      assert.deepEqual(
        beats[i].pos[id],
        beats[i + 1].startPos[id],
        `beat ${i + 1} does not join beat ${i + 2} for player ${id}`,
      );
    }
    assert.equal(beats[i].ball, beats[i + 1].startBall);
  }
}

describe("positionsAfter", () => {
  it("puts a mover at the end of their last movement", () => {
    const { beats } = longSequence();
    const after = positionsAfter(beats[0], beats[0].actions);
    assert.deepEqual(after["1"], beats[0].pos["1"]);
    assert.deepEqual(after["3"], beats[0].pos["3"]);
  });

  it("leaves everyone else where they started", () => {
    const { beats } = longSequence();
    const after = positionsAfter(beats[0], []);
    for (const id of PLAYER_IDS) {
      assert.deepEqual(after[id], beats[0].startPos[id]);
    }
  });
});

describe("splitting a drawn sequence into beats", () => {
  it("makes two beats that join exactly at the seam", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    assert.equal(split.length, beats.length + 1);
    chainHolds(split);
  });

  it("keeps the moves on the side they belong to", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    assert.deepEqual(
      split[0].actions.map((a) => a.type),
      ["dribble", "pass"],
    );
    assert.deepEqual(
      split[1].actions.map((a) => a.type),
      ["cut", "cut"],
    );
  });

  it("carries possession across the seam", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    assert.equal(split[0].ball, "5", "the pass should have landed by the seam");
    assert.equal(split[1].startBall, "5");
  });

  it("renumbers each half from one", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    assert.deepEqual(split[0].actions.map((a) => a.step), [1, 2]);
    assert.deepEqual(split[1].actions.map((a) => a.step), [1, 2]);
  });

  it("re-anchors a movement that now starts a beat", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    for (const action of split[1].actions) {
      if (!action.path) continue;
      assert.deepEqual(
        action.path[0],
        split[1].startPos[action.by],
        `${action.type} by ${action.by} does not start where they stand`,
      );
    }
  });

  it("produces a play that still validates", () => {
    const { play, beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    const result = validatePlay({ ...play, beats: split });
    assert.equal(result.valid, true, result.errors.join("; "));
  });

  it("refuses a cut before the first step or after the last", () => {
    const { beats } = longSequence();
    assert.equal(splitBeatAtStep(beats, 0, 0).length, beats.length);
    assert.equal(splitBeatAtStep(beats, 0, 4).length, beats.length);
  });
});

describe("merging beats back together", () => {
  it("undoes a split", () => {
    const { beats } = longSequence();
    const split = splitBeatAtStep(beats, 0, 2);
    const merged = mergeBeatWithPrevious(split, 1);

    assert.equal(merged.length, beats.length);
    assert.deepEqual(
      merged[0].actions.map((a) => a.type),
      beats[0].actions.map((a) => a.type),
    );
    chainHolds(merged);
  });

  it("keeps the moves in order across the join", () => {
    const { beats } = longSequence();
    const merged = mergeBeatWithPrevious(splitBeatAtStep(beats, 0, 2), 1);
    assert.deepEqual(merged[0].actions.map((a) => a.step), [1, 2, 3, 4]);
  });

  it("does nothing at the first beat", () => {
    const { beats } = longSequence();
    assert.equal(mergeBeatWithPrevious(beats, 0).length, beats.length);
  });
});

describe("suggested split points", () => {
  it("offers the step where the ball changes hands", () => {
    const { beats } = longSequence();
    assert.deepEqual(suggestedSplits(beats[0]), [2]);
  });

  it("offers nothing for a short beat", () => {
    const play = createEmptyPlay();
    assert.deepEqual(suggestedSplits(play.beats[0]), []);
  });
});

describe("reordering the sequence", () => {
  it("swaps a move with the one before it", () => {
    const { beats } = longSequence();
    const order = () => beats[0].actions.map((a) => `${a.type}:${a.step}`);
    const before = order();
    assert.deepEqual(before, ["dribble:1", "pass:2", "cut:3", "cut:4"]);

    const moved = moveActionInSequence(beats, 0, beats[0].actions[2].id, -1);
    const steps = new Map(moved[0].actions.map((a) => [a.type + a.by, a.step]));
    assert.equal(steps.get("cut3"), 2, "the cut should have moved earlier");
    assert.equal(steps.get("pass1"), 3, "the pass should have moved later");
  });

  it("does not group moves when reordering", () => {
    const { beats } = longSequence();
    const moved = moveActionInSequence(beats, 0, beats[0].actions[2].id, -1);
    const used = moved[0].actions.map((a) => a.step);
    assert.equal(new Set(used).size, used.length, "two moves ended up sharing a step");
  });

  it("refuses to move past either end", () => {
    const { beats } = longSequence();
    const first = beats[0].actions[0].id;
    const last = beats[0].actions[beats[0].actions.length - 1].id;
    assert.deepEqual(
      moveActionInSequence(beats, 0, first, -1)[0].actions.map((a) => a.step),
      beats[0].actions.map((a) => a.step),
    );
    assert.deepEqual(
      moveActionInSequence(beats, 0, last, 1)[0].actions.map((a) => a.step),
      beats[0].actions.map((a) => a.step),
    );
  });

  it("a reordered sequence still splits and validates", () => {
    const { play, beats } = longSequence();
    const moved = moveActionInSequence(beats, 0, beats[0].actions[2].id, -1);
    const split = splitBeatAtStep(moved, 0, 2);
    chainHolds(split);
    const result = validatePlay({ ...play, beats: split });
    assert.equal(result.valid, true, result.errors.join("; "));
  });
});

describe("thinning the court while drawing", () => {
  it("keeps only the last two steps", () => {
    const { beats } = longSequence();
    const shown = recentActionIds(beats[0]);
    const types = beats[0].actions
      .filter((a) => shown.has(a.id))
      .map((a) => a.type);
    assert.deepEqual(types, ["cut", "cut"]);
  });

  it("brings back a selected move however far up the sequence", () => {
    const { beats } = longSequence();
    const dribble = beats[0].actions[0];
    const shown = recentActionIds(beats[0], { keep: dribble.id });
    assert.ok(shown.has(dribble.id), "the selected move should still be drawn");
    assert.equal(shown.size, 3);
  });

  it("shows everything when the sequence is short", () => {
    const play = createEmptyPlay();
    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: [play.beats[0].startPos["3"], { x: 300, y: 320 }],
    });
    assert.equal(recentActionIds(beats[0]).size, 1);
  });

  it("keeps moves that happen together in the same step", () => {
    const { beats } = longSequence();
    // Group the two cuts, then only one step of drawing remains behind them.
    const grouped = setActionStep(beats, 0, beats[0].actions[3].id, 3);
    const shown = recentActionIds(grouped[0], { steps: 1 });
    const types = grouped[0].actions
      .filter((a) => shown.has(a.id))
      .map((a) => a.type);
    assert.deepEqual(types, ["cut", "cut"], "grouped moves show or hide together");
  });

  it("changes nothing about the play itself", () => {
    const { beats } = longSequence();
    const before = JSON.stringify(beats);
    recentActionIds(beats[0], { keep: beats[0].actions[0].id });
    assert.equal(JSON.stringify(beats), before);
  });
});
