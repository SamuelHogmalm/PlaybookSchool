import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handoffCandidates, HANDOFF_RANGE } from "../../src/lib/play/handoff.js";
import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import type { Beat } from "../../src/lib/play/types.js";

/** 1 dribbles out to the wing and stops; 3 cuts past them on the way through. */
function dribbleHandoffBeat(): Beat {
  const play = createEmptyPlay();
  const spot = { x: 250, y: 250 };

  let beats = addDrawnAction(play.beats, 0, {
    type: "dribble",
    by: "1",
    path: [play.beats[0].startPos["1"], spot],
  });

  const handoffSpot = beats[0].pos["1"];
  beats = addDrawnAction(beats, 0, {
    type: "cut",
    by: "3",
    // Runs right past the handler and on to the far side.
    path: [beats[0].startPos["3"], handoffSpot, { x: 120, y: 300 }],
  });

  return beats[0];
}

describe("handoff suggestions", () => {
  it("spots a cutter running past the ball handler", () => {
    const candidates = handoffCandidates(dribbleHandoffBeat());
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].from, "1");
    assert.equal(candidates[0].to, "3");
  });

  it("puts the exchange where the handler finishes", () => {
    const beat = dribbleHandoffBeat();
    const [candidate] = handoffCandidates(beat);
    assert.deepEqual(candidate.at, beat.pos["1"]);
  });

  it("ignores a cutter who stays well away", () => {
    const play = createEmptyPlay();
    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      // Along the far baseline, nowhere near player 1 at the top.
      path: [play.beats[0].startPos["3"], { x: 460, y: 200 }],
    });
    assert.deepEqual(handoffCandidates(beats[0]), []);
  });

  it("never offers a handoff from someone who has already given the ball up", () => {
    const beat = dribbleHandoffBeat();
    const withPass: Beat = {
      ...beat,
      actions: [
        ...beat.actions,
        { id: "zz", type: "pass", by: "1", for: "5" },
      ],
      ball: "5",
    };
    // Any offer now belongs to 5, who holds it — never to 1, who does not.
    for (const candidate of handoffCandidates(withPass)) {
      assert.notEqual(candidate.from, "1");
      assert.equal(candidate.from, "5");
    }
  });

  it("offers nothing to a player who already receives the ball", () => {
    const beat = dribbleHandoffBeat();
    const withPass: Beat = {
      ...beat,
      actions: [
        ...beat.actions,
        { id: "zz", type: "pass", by: "5", for: "3" },
      ],
    };
    assert.deepEqual(handoffCandidates(withPass), []);
  });

  it("ignores a player who does not move at all", () => {
    const play = createEmptyPlay();
    // Nobody has an action, so nobody is running past anyone.
    assert.deepEqual(handoffCandidates(play.beats[0]), []);
  });

  it("accepting one produces a handoff that changes possession", () => {
    const play = createEmptyPlay();
    const beat = dribbleHandoffBeat();
    const beats = [beat, play.beats[1]];
    const [candidate] = handoffCandidates(beat);

    const next = addDrawnAction(beats, 0, {
      type: "handoff",
      by: candidate.from,
      for: candidate.to,
      path: [candidate.at, beats[0].pos[candidate.to]],
    });

    assert.equal(next[0].ball, "3");
    assert.equal(next[1].startBall, "3");
    assert.deepEqual(handoffCandidates(next[0]), [], "still offering after accepting");
  });

  it("the range is shoulder to shoulder, not across the floor", () => {
    assert.ok(HANDOFF_RANGE > 30 && HANDOFF_RANGE < 80);
  });
});
