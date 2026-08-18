import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDrawnAction,
  removeAction,
  separateAction,
  setActionStep,
} from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import {
  beatDurationMs,
  beatSteps,
  sequenceBeat,
  stepDurationsMs,
} from "../../src/lib/timing/index.js";
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import type { Beat, PlayerId, SeedPlay } from "../../src/lib/play/types.js";
import seedPlays from "../../src/data/plays-interpreted.json" with { type: "json" };

/** Three cuts by three different players, drawn one after another. */
function threeCuts(): Beat[] {
  const play = createEmptyPlay();
  let beats = play.beats;
  const targets: Array<[PlayerId, { x: number; y: number }]> = [
    ["3", { x: 120, y: 300 }],
    ["4", { x: 250, y: 320 }],
    ["5", { x: 380, y: 300 }],
  ];
  for (const [by, to] of targets) {
    beats = addDrawnAction(beats, 0, {
      type: "cut",
      by,
      path: [beats[0].startPos[by], to],
    });
  }
  return beats;
}

describe("steps — drawn actions are serial by default", () => {
  it("each new action gets its own step, in draw order", () => {
    const beats = threeCuts();
    assert.deepEqual(
      beats[0].actions.map((a) => a.step),
      [1, 2, 3],
    );
  });

  it("no two actions overlap", () => {
    const timed = sequenceBeat(threeCuts()[0]);
    for (let i = 1; i < timed.length; i++) {
      assert.ok(
        timed[i].startAt >= timed[i - 1].endAt - 1e-9,
        `step ${i + 1} starts before step ${i} ends`,
      );
    }
  });

  it("the steps fill the beat exactly", () => {
    const timed = sequenceBeat(threeCuts()[0]);
    assert.equal(timed[0].startAt, 0);
    assert.equal(timed[timed.length - 1].endAt, 1);
  });

  it("a step's slice is proportional to how long the move really takes", () => {
    // Equal slices made a long cut and a short one take the same time, so the long one
    // had to be played several times faster. Distance decides now.
    const beats = threeCuts();
    const timed = sequenceBeat(beats[0]);
    const durations = stepDurationsMs(beats[0]);
    const total = durations.reduce((a, b) => a + b, 0);

    timed.forEach((action, i) => {
      const share = action.endAt - action.startAt;
      assert.ok(
        Math.abs(share - durations[i] / total) < 1e-6,
        `step ${i + 1} took ${share.toFixed(3)} of the beat, expected ${(durations[i] / total).toFixed(3)}`,
      );
    });
  });

  it("everyone moves at about the same speed", () => {
    const beats = threeCuts();
    const timed = sequenceBeat(beats[0]);
    const beatMs = beatDurationMs(beats[0]);

    const speeds = timed.map((action) => {
      const path = action.path!;
      let length = 0;
      for (let i = 1; i < path.length; i++) {
        length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      }
      const seconds = ((action.endAt - action.startAt) * beatMs) / 1000;
      return length / seconds;
    });

    const fastest = Math.max(...speeds);
    const slowest = Math.min(...speeds);
    assert.ok(
      fastest / slowest < 1.6,
      `speeds ranged ${slowest.toFixed(0)}–${fastest.toFixed(0)} units/sec`,
    );
  });
});

describe("steps — the coach groups actions", () => {
  it("two cuts can be made to happen at the same time", () => {
    let beats = threeCuts();
    const second = beats[0].actions[1].id;
    // "Same time as step 1"
    beats = setActionStep(beats, 0, second, 1);

    assert.deepEqual(beatSteps(beats[0]), [1, 2]);

    const timed = sequenceBeat(beats[0]);
    const grouped = timed.filter((a) => a.step === 1);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].startAt, grouped[1].startAt);
    assert.equal(grouped[0].endAt, grouped[1].endAt);
  });

  it("a grouped action can be given its own step again", () => {
    let beats = threeCuts();
    const second = beats[0].actions[1].id;
    beats = setActionStep(beats, 0, second, 1);
    assert.equal(beatSteps(beats[0]).length, 2);

    beats = setActionStep(beats, 0, second, null);
    assert.equal(beatSteps(beats[0]).length, 3);
    const timed = sequenceBeat(beats[0]);
    for (let i = 1; i < timed.length; i++) {
      assert.ok(timed[i].startAt >= timed[i - 1].endAt - 1e-9);
    }
  });

  it("grouping shortens the beat — one thing to watch, not two", () => {
    const serial = threeCuts();
    const grouped = setActionStep(serial, 0, serial[0].actions[1].id, 1);
    assert.ok(
      beatDurationMs(grouped[0]) < beatDurationMs(serial[0]),
      "two actions in one step should not cost the same as two steps",
    );
  });

  it("steps stay contiguous when an action is deleted", () => {
    let beats = threeCuts();
    beats = removeAction(beats, 0, beats[0].actions[1].id);
    assert.deepEqual(beatSteps(beats[0]), [1, 2], "a hole would be a dead pause");
  });

  it("deleting leaves the survivors in their original order", () => {
    let beats = threeCuts();
    const firstBy = beats[0].actions[0].by;
    const lastBy = beats[0].actions[2].by;
    beats = removeAction(beats, 0, beats[0].actions[1].id);
    assert.deepEqual(
      beats[0].actions.map((a) => [a.by, a.step]),
      [
        [firstBy, 1],
        [lastBy, 2],
      ],
    );
  });
});

describe("steps — imported plays are untouched until reviewed", () => {
  it("a beat with no steps still uses the derived lanes", () => {
    const beat: Beat = {
      id: "b1",
      startPos: createEmptyPlay().beats[0].startPos,
      pos: createEmptyPlay().beats[0].pos,
      startBall: "1",
      ball: "1",
      actions: [
        { id: "a1", type: "screen", by: "5", for: "1" },
        { id: "a2", type: "cut", by: "1" },
      ],
    };
    assert.deepEqual(beatSteps(beat), []);

    const timed = sequenceBeat(beat);
    const screen = timed.find((a) => a.type === "screen")!;
    const cut = timed.find((a) => a.type === "cut")!;
    // The dependency rule, not an equal slice: the cutter waits for the screen.
    assert.ok(cut.startAt >= screen.endAt);
  });

  it("the seed carries no steps, so nothing in it re-times", () => {
    for (const raw of seedPlays as SeedPlay[]) {
      for (const beat of normalizeSeedPlay(raw).beats) {
        assert.deepEqual(
          beatSteps(beat),
          [],
          `${raw.name} ${beat.id} unexpectedly has steps`,
        );
      }
    }
  });

  it("steps survive normalization when a seed play does carry them", () => {
    const raw: SeedPlay = {
      name: "Stepped",
      beats: [
        {
          id: "b1",
          startPos: createEmptyPlay().beats[0].startPos,
          pos: createEmptyPlay().beats[0].pos,
          ball: "1",
          actions: [
            { id: "a1", type: "cut", by: "3", step: 1 },
            { id: "a2", type: "cut", by: "4", step: 1 },
          ],
        },
        {
          id: "b2",
          startPos: createEmptyPlay().beats[0].startPos,
          pos: createEmptyPlay().beats[0].pos,
          ball: "1",
        },
      ],
    };
    const play = normalizeSeedPlay(raw);
    assert.deepEqual(
      play.beats[0].actions.map((a) => a.step),
      [1, 1],
    );
  });
});

describe("taking one move out of a group", () => {
  /** Three cuts all happening at once — the coach meant only two. */
  function threeTogether() {
    let beats = threeCuts();
    beats = setActionStep(beats, 0, beats[0].actions[1].id, 1);
    beats = setActionStep(beats, 0, beats[0].actions[2].id, 1);
    return beats;
  }

  it("starts with all three sharing a step", () => {
    const beats = threeTogether();
    assert.deepEqual(beatSteps(beats[0]), [1]);
  });

  it("separates one and leaves the other two together", () => {
    const beats = threeTogether();
    const odd = beats[0].actions[2].id;
    const after = separateAction(beats, 0, odd, "after");

    assert.deepEqual(beatSteps(after[0]), [1, 2]);
    const stillTogether = after[0].actions.filter((a) => a.step === 1);
    assert.equal(stillTogether.length, 2);
    assert.equal(after[0].actions.find((a) => a.id === odd)!.step, 2);
  });

  it("can put it before the group instead", () => {
    const beats = threeTogether();
    const odd = beats[0].actions[2].id;
    const after = separateAction(beats, 0, odd, "before");

    assert.equal(after[0].actions.find((a) => a.id === odd)!.step, 1);
    assert.equal(after[0].actions.filter((a) => a.step === 2).length, 2);
  });

  it("does not disturb moves later in the sequence", () => {
    let beats = threeCuts();
    beats = setActionStep(beats, 0, beats[0].actions[1].id, 1);
    // Now: [cut3 + cut4] at step 1, cut5 at its own step.
    const last = beats[0].actions[2].id;
    const after = separateAction(beats, 0, beats[0].actions[1].id, "after");

    assert.equal(beatSteps(after[0]).length, 3);
    const lastStep = after[0].actions.find((a) => a.id === last)!.step;
    assert.equal(lastStep, 3, "the move that was already last should still be last");
  });

  it("leaves an already-solitary move alone", () => {
    const beats = threeCuts();
    const before = beats[0].actions.map((a) => a.step);
    const after = separateAction(beats, 0, beats[0].actions[1].id, "after");
    assert.deepEqual(after[0].actions.map((a) => a.step), before);
  });

  it("the separated move now plays after the ones it left", () => {
    const beats = threeTogether();
    const odd = beats[0].actions[2].id;
    const timed = sequenceBeat(separateAction(beats, 0, odd, "after")[0]);

    const separated = timed.find((a) => a.id === odd)!;
    for (const other of timed) {
      if (other.id === odd) continue;
      assert.ok(
        separated.startAt >= other.endAt - 1e-9,
        "the separated move should start once the group has finished",
      );
    }
  });
});
