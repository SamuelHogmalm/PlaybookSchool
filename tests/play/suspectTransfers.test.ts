import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import type { Play, Vec } from "../../src/lib/play/types.js";
import { suspectTransfers } from "../../src/lib/play/validation.js";

/** One beat: 1 passes to 2, who starts at `from` and finishes at `to`. */
function passPlay(from: Vec, to: Vec): Play {
  const play = createEmptyPlay();
  const beat = play.beats[0];
  const startPos = { ...beat.startPos, "1": { x: 250, y: 400 }, "2": from };
  const pos = { ...startPos, "2": to };
  return {
    ...play,
    beats: [
      {
        ...beat,
        startPos,
        pos,
        startBall: "1",
        ball: "2",
        actions: [
          { id: "a1", type: "cut", by: "2", path: [from, to], step: 1 },
          { id: "a2", type: "pass", by: "1", for: "2", step: 2 },
        ],
      },
      { ...play.beats[1], startPos: pos, pos, startBall: "2", ball: "2" },
    ],
  };
}

describe("suspect transfers — a pass is measured to where it lands", () => {
  it("does not flag a receiver who cuts to meet the ball", () => {
    // The corner to the near elbow is over 320 units from the passer; the receiver
    // arrives at 60. Flagging this would flag most plays that work.
    const play = passPlay({ x: 480, y: 40 }, { x: 250, y: 340 });
    assert.deepEqual(suspectTransfers(play), []);
  });

  it("still flags a pass nobody is near at either end", () => {
    const play = passPlay({ x: 480, y: 30 }, { x: 470, y: 40 });
    const flagged = suspectTransfers(play);
    assert.equal(flagged.length, 1);
    assert.equal(flagged[0].actionId, "a2");
  });

  it("flags on the shorter of the two ends, not the average", () => {
    // Receiver starts across the floor and ends only a little closer: still suspect.
    const play = passPlay({ x: 480, y: 30 }, { x: 460, y: 60 });
    assert.equal(suspectTransfers(play).length, 1);
  });
});
