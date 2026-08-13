import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { unexplainedTravel } from "../../src/lib/court/actionGeometry.js";
import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay, updateBeatPlayerPos } from "../../src/lib/play/beatOps.js";

describe("unexplainedTravel — what the builder draws instead of ghosts", () => {
  it("is empty for a beat where nobody moves", () => {
    const play = createEmptyPlay();
    assert.deepEqual(unexplainedTravel(play.beats[0]), []);
  });

  it("reports a player dragged to a new spot with no action", () => {
    const play = createEmptyPlay();
    const beats = updateBeatPlayerPos(play.beats, 1, "4", { x: 200, y: 330 });
    const routes = unexplainedTravel(beats[1]);

    assert.equal(routes.length, 1);
    assert.equal(routes[0].id, "4");
    assert.deepEqual(routes[0].from, beats[1].startPos["4"]);
    assert.deepEqual(routes[0].to, beats[1].pos["4"]);
  });

  it("skips players whose travel a drawn action already explains", () => {
    const play = createEmptyPlay();
    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: [play.beats[0].startPos["3"], { x: 260, y: 340 }],
    });
    assert.deepEqual(
      unexplainedTravel(beats[0]),
      [],
      "ActionLayer draws this route; a second line would double it",
    );
  });

  // Beat 1 is the opening alignment: dragging an actionless player there moves their
  // startPos too, so there is deliberately no travel to report. These use a later beat.

  it("still reports a mover when someone else has the action", () => {
    const play = createEmptyPlay();
    let beats = addDrawnAction(play.beats, 1, {
      type: "cut",
      by: "3",
      path: [play.beats[1].startPos["3"], { x: 260, y: 340 }],
    });
    beats = updateBeatPlayerPos(beats, 1, "5", { x: 190, y: 300 });

    const ids = unexplainedTravel(beats[1]).map((r) => r.id);
    assert.deepEqual(ids, ["5"]);
  });

  it("a pass does not count as explaining the passer's travel", () => {
    // Passing is not moving. If the passer also ends up somewhere else, that is
    // unexplained travel and should still be drawn.
    const play = createEmptyPlay();
    let beats = addDrawnAction(play.beats, 1, {
      type: "pass",
      by: "1",
      for: "5",
      path: [play.beats[1].startPos["1"], play.beats[1].startPos["5"]],
    });
    beats = updateBeatPlayerPos(beats, 1, "1", { x: 150, y: 300 });

    const ids = unexplainedTravel(beats[1]).map((r) => r.id);
    assert.deepEqual(ids, ["1"]);
  });

  it("ignores sub-epsilon jitter", () => {
    const play = createEmptyPlay();
    const start = play.beats[0].startPos["2"];
    const beats = play.beats.map((b, i) =>
      i === 0
        ? { ...b, pos: { ...b.pos, "2": { x: start.x + 0.4, y: start.y - 0.3 } } }
        : b,
    );
    assert.deepEqual(unexplainedTravel(beats[0]), []);
  });
});
