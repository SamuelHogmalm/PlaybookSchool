import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampToCourt,
  clientToCourt,
  GRID_SIZE,
  snapClampPoint,
  snapPoint,
  snapToGrid,
} from "../../src/lib/play/editor.js";
import {
  actionHitPaths,
  hitTestPath,
  nearestPlayerAt,
  pathLength,
} from "../../src/lib/play/drawing.js";
import {
  COURT_HEIGHT,
  COURT_MARGIN,
  COURT_WIDTH,
  playerBeatMove,
  playerMove,
} from "../../src/lib/play/geometry.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";
import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import type { PlayerId, Vec } from "../../src/lib/play/types.js";

/** Minimal stand-in for the SVG's bounding box. */
function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return { left, top, width, height } as DOMRect;
}

describe("snapping and clamping", () => {
  it("snaps to the grid, rounding to nearest", () => {
    assert.equal(snapToGrid(0), 0);
    assert.equal(snapToGrid(GRID_SIZE / 2 - 0.1), 0);
    assert.equal(snapToGrid(GRID_SIZE / 2 + 0.1), GRID_SIZE);
    assert.equal(snapToGrid(-GRID_SIZE * 1.4), -GRID_SIZE);
  });

  it("snapPoint snaps both axes", () => {
    assert.deepEqual(snapPoint({ x: 103, y: 247 }), { x: 100, y: 250 });
  });

  it("clamps inside the court margin", () => {
    assert.deepEqual(clampToCourt({ x: -500, y: -500 }), {
      x: COURT_MARGIN,
      y: COURT_MARGIN,
    });
    assert.deepEqual(clampToCourt({ x: 9999, y: 9999 }), {
      x: COURT_WIDTH - COURT_MARGIN,
      y: COURT_HEIGHT - COURT_MARGIN,
    });
  });

  it("snapClampPoint keeps a far-off-court drag on the floor", () => {
    const p = snapClampPoint({ x: -9999, y: 9999 });
    assert.ok(p.x >= COURT_MARGIN && p.x <= COURT_WIDTH - COURT_MARGIN);
    assert.ok(p.y >= COURT_MARGIN && p.y <= COURT_HEIGHT - COURT_MARGIN);
  });

  it("is idempotent — snapping a snapped point changes nothing", () => {
    const once = snapClampPoint({ x: 313.7, y: 91.2 });
    assert.deepEqual(snapClampPoint(once), once);
  });
});

describe("clientToCourt", () => {
  it("maps the rect corners onto the court corners", () => {
    const r = rect(50, 20, 400, 376);
    assert.deepEqual(clientToCourt(50, 20, r), { x: 0, y: 0 });
    assert.deepEqual(clientToCourt(450, 396, r), {
      x: COURT_WIDTH,
      y: COURT_HEIGHT,
    });
  });

  it("maps the centre to the centre regardless of scale", () => {
    for (const width of [200, 400, 1000]) {
      const r = rect(0, 0, width, width * (COURT_HEIGHT / COURT_WIDTH));
      const mid = clientToCourt(width / 2, (width / 2) * (COURT_HEIGHT / COURT_WIDTH), r);
      assert.ok(Math.abs(mid.x - COURT_WIDTH / 2) < 1e-9);
      assert.ok(Math.abs(mid.y - COURT_HEIGHT / 2) < 1e-9);
    }
  });

  it("accounts for a scrolled or offset element", () => {
    const r = rect(120, 300, 500, 470);
    assert.deepEqual(clientToCourt(120 + 250, 300 + 235, r), { x: 250, y: 235 });
  });
});

describe("nearestPlayerAt", () => {
  const positions = {
    "1": { x: 100, y: 100 },
    "2": { x: 200, y: 100 },
    "3": { x: 300, y: 100 },
    "4": { x: 400, y: 100 },
    "5": { x: 250, y: 300 },
  } as Record<PlayerId, Vec>;

  it("finds the closest player within range", () => {
    assert.equal(nearestPlayerAt(positions, { x: 205, y: 104 }), "2");
  });

  it("returns null when nothing is close enough", () => {
    assert.equal(nearestPlayerAt(positions, { x: 250, y: 200 }), null);
  });

  it("honours a widened radius", () => {
    assert.equal(nearestPlayerAt(positions, { x: 250, y: 200 }, 120), "5");
  });

  it("excludes the drawing player, so a pass cannot land on itself", () => {
    assert.equal(nearestPlayerAt(positions, { x: 201, y: 101 }, 40, "2"), null);
    // With 2 excluded the next nearest wins: 3 is 85 away, 1 is 115.
    assert.equal(nearestPlayerAt(positions, { x: 215, y: 100 }, 100, "2"), "3");
  });
});

describe("hit testing", () => {
  const path: Vec[] = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ];

  it("hits along the segment, not just at the vertices", () => {
    assert.equal(hitTestPath({ x: 150, y: 104 }, path), true);
  });

  it("misses beyond the threshold", () => {
    assert.equal(hitTestPath({ x: 150, y: 160 }, path), false);
  });

  it("does not hit past the end of the segment", () => {
    assert.equal(hitTestPath({ x: 400, y: 100 }, path), false);
  });

  it("actionHitPaths uses the stored path when there is one", () => {
    const play = createEmptyPlay();
    const drawn = [
      play.beats[0].startPos["3"],
      { x: 260, y: 300 },
      { x: 300, y: 360 },
    ];
    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: drawn,
    });
    const hits = actionHitPaths(beats[0]);
    assert.equal(hits.length, 1);
    assert.deepEqual(hits[0].points, beats[0].actions[0].path);
  });

  it("actionHitPaths falls back to a straight line when an action has no path", () => {
    const play = createEmptyPlay();
    const beat = {
      ...play.beats[0],
      pos: { ...play.beats[0].pos, "3": { x: 320, y: 380 } },
      actions: [{ id: "a1", type: "cut" as const, by: "3" as PlayerId }],
    };
    const hits = actionHitPaths(beat);
    assert.deepEqual(hits[0].points, [beat.startPos["3"], { x: 320, y: 380 }]);
  });
});

describe("pathLength", () => {
  it("sums segments and is zero for a single point", () => {
    assert.equal(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
      5,
    );
    assert.equal(pathLength([{ x: 1, y: 1 }]), 0);
  });
});

describe("movement measurement for the teleport rule", () => {
  const prev = { "1": { x: 100, y: 100 } } as Record<PlayerId, Vec>;
  const cur = { "1": { x: 100, y: 400 } } as Record<PlayerId, Vec>;

  it("playerMove is straight-line distance between beats", () => {
    assert.equal(playerMove(prev, cur, "1"), 300);
    assert.equal(playerMove(null, cur, "1"), 0, "no previous beat is not a move");
  });

  it("playerBeatMove measures the longest leg, not the whole journey", () => {
    // A long curved drive is legal; a single 300-unit jump is a teleport. Measuring
    // the largest segment is what lets rule 8 tell them apart.
    const curved = playerBeatMove(prev, cur, "1", [
      {
        id: "a1",
        type: "dribble",
        by: "1",
        path: [
          { x: 100, y: 100 },
          { x: 100, y: 200 },
          { x: 100, y: 300 },
          { x: 100, y: 400 },
        ],
      },
    ]);
    assert.equal(curved, 100, "each leg is 100, so the move is 100");
  });

  it("falls back to straight-line distance when the action has no path", () => {
    assert.equal(
      playerBeatMove(prev, cur, "1", [{ id: "a1", type: "cut", by: "1" }]),
      300,
    );
  });
});
