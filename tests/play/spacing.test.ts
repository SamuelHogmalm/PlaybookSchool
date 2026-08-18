import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dist,
  MIN_TOKEN_GAP,
  stopAtPerimeter,
} from "../../src/lib/play/geometry.js";
import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay, updateBeatPlayerPos } from "../../src/lib/play/beatOps.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";

describe("stopAtPerimeter", () => {
  const at = (x: number, y: number) => ({ x, y });

  it("leaves an unobstructed route alone", () => {
    const end = at(100, 0);
    assert.deepEqual(stopAtPerimeter(at(0, 0), end, [at(300, 300)]), end);
  });

  it("stops exactly one gap short of whoever is in the way", () => {
    const other = at(100, 0);
    const stopped = stopAtPerimeter(at(0, 0), other, [other]);
    assert.ok(Math.abs(dist(stopped, other) - MIN_TOKEN_GAP) < 0.01);
  });

  it("keeps the direction of travel", () => {
    const other = at(100, 100);
    const stopped = stopAtPerimeter(at(0, 0), other, [other]);
    // Straight line from origin means x and y stay equal.
    assert.ok(Math.abs(stopped.x - stopped.y) < 0.01);
  });

  it("clears every player, not just the first one checked", () => {
    // Running *past* someone is fine — players do. Only the endpoint has to be clear.
    const near = at(60, 0);
    const far = at(120, 0);
    const stopped = stopAtPerimeter(at(0, 0), far, [far, near]);
    assert.ok(dist(stopped, near) >= MIN_TOKEN_GAP - 0.01, "ends on top of the near player");
    assert.ok(dist(stopped, far) >= MIN_TOKEN_GAP - 0.01, "ends on top of the far player");
  });

  it("pushes out when the route starts inside someone", () => {
    const other = at(50, 50);
    const stopped = stopAtPerimeter(at(52, 52), at(51, 51), [other]);
    assert.ok(dist(stopped, other) >= MIN_TOKEN_GAP - 0.01);
  });

  it("handles a zero-length route", () => {
    const other = at(50, 50);
    const stopped = stopAtPerimeter(at(55, 50), at(55, 50), [other]);
    assert.ok(dist(stopped, other) >= MIN_TOKEN_GAP - 0.01);
  });
});

describe("no two tokens ever overlap", () => {
  function noOverlaps(positions: Record<string, { x: number; y: number }>) {
    for (const a of PLAYER_IDS) {
      for (const b of PLAYER_IDS) {
        if (a >= b) continue;
        const gap = dist(positions[a], positions[b]);
        assert.ok(
          gap >= MIN_TOKEN_GAP - 0.01,
          `players ${a} and ${b} are ${gap.toFixed(1)} apart`,
        );
      }
    }
  }

  it("a screen drawn onto a team-mate stops at their edge", () => {
    const play = createEmptyPlay();
    const target = { ...play.beats[0].startPos["2"] };
    const beats = addDrawnAction(play.beats, 0, {
      type: "screen",
      by: "5",
      for: "2",
      // Aimed right at player 2, which is what a coach naturally draws.
      path: [play.beats[0].startPos["5"], target],
    });

    assert.ok(
      dist(beats[0].pos["5"], target) >= MIN_TOKEN_GAP - 0.01,
      "the screener landed on top of the player being screened for",
    );
    noOverlaps(beats[0].pos);
  });

  it("a cut drawn onto a team-mate stops at their edge", () => {
    const play = createEmptyPlay();
    const target = { ...play.beats[0].startPos["4"] };
    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: [play.beats[0].startPos["3"], target],
    });
    noOverlaps(beats[0].pos);
  });

  it("dragging a destination onto a team-mate stops at their edge", () => {
    const play = createEmptyPlay();
    const onTopOf5 = { ...play.beats[1].pos["5"] };
    const beats = updateBeatPlayerPos(play.beats, 1, "3", onTopOf5);
    noOverlaps(beats[1].pos);
  });

  it("the default alignment is already clear", () => {
    noOverlaps(createEmptyPlay().beats[0].startPos);
  });
});
