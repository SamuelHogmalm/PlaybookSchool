import assert from "node:assert/strict";
import { describe, it } from "node:test";

import seedPlays from "../../src/data/plays-interpreted.json" with { type: "json" };
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import type { Beat, PlayerId, SeedPlay, Vec } from "../../src/lib/play/types.js";
import { PLAYER_IDS } from "../../src/lib/play/types.js";
import {
  movementActionsForPlayer,
  positionsAt,
  sequenceBeat,
} from "../../src/lib/timing/index.js";

const PLAYS = (seedPlays as SeedPlay[]).map((p) => normalizeSeedPlay(p));

function near(a: Vec, b: Vec, tol = 0.001): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

/** Final point of the last movement a player makes in this beat. */
function finalRoutePoint(beat: Beat, id: PlayerId): Vec | null {
  const timed = sequenceBeat(beat);
  const movements = movementActionsForPlayer(timed, id);
  if (!movements.length) return null;

  let held = beat.startPos[id];
  for (const m of movements) {
    const route =
      m.path && m.path.length >= 2 ? m.path : [held, beat.pos[id] ?? held];
    held = route[route.length - 1];
  }
  return held;
}

describe("multi-movement players", () => {
  it("a screener who screens then rolls ends at the roll, not the screen", () => {
    const screenEnd = { x: 300, y: 120 };
    const rollEnd = { x: 250, y: 70 };

    const beat: Beat = {
      id: "b1",
      startPos: {
        "1": { x: 250, y: 350 },
        "2": { x: 400, y: 200 },
        "3": { x: 100, y: 200 },
        "4": { x: 330, y: 100 },
        "5": { x: 170, y: 300 },
      },
      pos: {
        "1": { x: 250, y: 350 },
        "2": { x: 400, y: 200 },
        "3": { x: 100, y: 200 },
        "4": { x: 330, y: 100 },
        "5": rollEnd,
      },
      startBall: "1",
      ball: "1",
      actions: [
        {
          id: "a1",
          type: "screen",
          by: "5",
          for: "1",
          path: [{ x: 170, y: 300 }, screenEnd],
        },
        { id: "a2", type: "cut", by: "5", path: [screenEnd, rollEnd] },
      ],
    };

    const play = {
      ...PLAYS[0],
      id: "screen-roll",
      beats: [beat, { ...beat, id: "b2", actions: [], startPos: beat.pos }],
    };

    const timed = sequenceBeat(beat);
    const movements = movementActionsForPlayer(timed, "5");
    assert.equal(movements.length, 2, "screener should have screen + roll");

    const atScreenEnd = positionsAt(play, 0, movements[0].endAt, "move");
    assert.ok(
      near(atScreenEnd!.players["5"], screenEnd),
      `screener should be set at the screen, got ${JSON.stringify(atScreenEnd!.players["5"])}`,
    );

    const atEnd = positionsAt(play, 0, 1, "move");
    assert.ok(
      near(atEnd!.players["5"], rollEnd),
      `screener should finish the roll at the rim, got ${JSON.stringify(atEnd!.players["5"])}`,
    );
  });

  it("every seed movement finishes on its route's final point", () => {
    const failures: string[] = [];

    for (const play of PLAYS) {
      play.beats.forEach((beat, beatIndex) => {
        const snap = positionsAt(play, beatIndex, 1, "move");
        if (!snap) {
          failures.push(`${play.name} beat ${beatIndex + 1}: no snapshot`);
          return;
        }
        for (const id of PLAYER_IDS) {
          const expected = finalRoutePoint(beat, id);
          if (!expected) continue;
          const actual = snap.players[id];
          if (!near(actual, expected, 0.01)) {
            failures.push(
              `${play.name} beat ${beatIndex + 1} P${id}: t=1 at (${actual.x.toFixed(1)}, ${actual.y.toFixed(1)}), route ends (${expected.x}, ${expected.y})`,
            );
          }
        }
      });
    }

    assert.equal(failures.length, 0, failures.slice(0, 20).join("\n"));
  });

  // The seed currently contains no player with two movements in one beat — the
  // import pipeline does not emit them — so this path is exercised by the fixture
  // above rather than by seed data. It still matters: the builder can draw it.
  it("returns a player's movements in execution order", () => {
    const beat: Beat = {
      id: "b1",
      startPos: {
        "1": { x: 250, y: 350 },
        "2": { x: 400, y: 200 },
        "3": { x: 100, y: 200 },
        "4": { x: 330, y: 100 },
        "5": { x: 170, y: 300 },
      },
      pos: {
        "1": { x: 250, y: 350 },
        "2": { x: 400, y: 200 },
        "3": { x: 100, y: 200 },
        "4": { x: 330, y: 100 },
        "5": { x: 250, y: 70 },
      },
      startBall: "1",
      ball: "1",
      actions: [
        // Authored roll-first to prove ordering comes from timing, not array order.
        {
          id: "a2",
          type: "cut",
          by: "5",
          path: [
            { x: 300, y: 120 },
            { x: 250, y: 70 },
          ],
        },
        {
          id: "a1",
          type: "screen",
          by: "5",
          for: "1",
          path: [
            { x: 170, y: 300 },
            { x: 300, y: 120 },
          ],
        },
      ],
    };

    const movements = movementActionsForPlayer(sequenceBeat(beat), "5");
    assert.deepEqual(
      movements.map((m) => m.id),
      ["a1", "a2"],
      "screen must be sequenced before the roll",
    );
    assert.ok(movements[0].endAt <= movements[1].startAt + 1e-9);
  });
});
