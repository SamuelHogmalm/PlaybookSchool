import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Vec } from "../../src/lib/play/types.js";
import {
  MAX_PATH_POINTS,
  simplifyPath,
} from "../../src/lib/play/drawing.js";
import { pathToSvgD, polylineToSvgD } from "../../src/lib/court/paths.js";
import { addDrawnAction } from "../../src/lib/play/actionOps.js";
import { createEmptyPlay } from "../../src/lib/play/beatOps.js";

/** A freehand stroke: an arc from a to b with per-point jitter, as pointer input gives us. */
function jitteryArc(count: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    out.push({
      x: 100 + u * 240,
      y: 300 - Math.sin(u * Math.PI) * 120 + (i % 2 ? 1.4 : -1.4),
    });
  }
  return out;
}

function firstMoveTo(d: string): Vec {
  const m = d.match(/^M (-?[\d.]+) (-?[\d.]+)/);
  assert.ok(m, `no moveto in ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** Last coordinate pair in the `d` string — the curve's final on-path point. */
function lastPoint(d: string): Vec {
  const pairs = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
  const last = pairs[pairs.length - 1];
  return { x: Number(last[1]), y: Number(last[2]) };
}

describe("simplifyPath — Ramer–Douglas–Peucker", () => {
  it("reduces a freehand stroke into the target band", () => {
    const stroke = jitteryArc(90);
    const simplified = simplifyPath(stroke);

    assert.ok(
      simplified.length <= MAX_PATH_POINTS,
      `got ${simplified.length} points, budget is ${MAX_PATH_POINTS}`,
    );
    assert.ok(
      simplified.length >= 3,
      "an arc must keep enough points to still read as an arc",
    );
  });

  it("keeps the exact endpoints", () => {
    const stroke = jitteryArc(90);
    const simplified = simplifyPath(stroke);

    assert.deepEqual(simplified[0], stroke[0]);
    assert.deepEqual(
      simplified[simplified.length - 1],
      stroke[stroke.length - 1],
    );
  });

  it("keeps every retained point on the original stroke", () => {
    const stroke = jitteryArc(90);
    for (const p of simplifyPath(stroke)) {
      assert.ok(
        stroke.some((q) => q.x === p.x && q.y === p.y),
        `RDP invented a point at ${p.x},${p.y} — it may only drop points`,
      );
    }
  });

  it("preserves order", () => {
    const stroke = jitteryArc(90);
    const simplified = simplifyPath(stroke);
    const indexes = simplified.map((p) =>
      stroke.findIndex((q) => q.x === p.x && q.y === p.y),
    );
    for (let i = 1; i < indexes.length; i++) {
      assert.ok(indexes[i] > indexes[i - 1], "points came back out of order");
    }
  });

  it("leaves short paths untouched — imported paths are not builder strokes", () => {
    const imported: Vec[] = [
      { x: 100, y: 100 },
      { x: 180, y: 140 },
      { x: 220, y: 260 },
    ];
    assert.deepEqual(simplifyPath(imported), imported);
  });

  it("handles two-point and degenerate paths", () => {
    const two: Vec[] = [
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ];
    assert.deepEqual(simplifyPath(two), two);
    assert.deepEqual(simplifyPath([{ x: 5, y: 5 }]), [{ x: 5, y: 5 }]);
    assert.deepEqual(simplifyPath([]), []);
  });

  it("collapses a straight line to its endpoints", () => {
    const straight: Vec[] = Array.from({ length: 40 }, (_, i) => ({
      x: 50 + i * 5,
      y: 200,
    }));
    assert.deepEqual(simplifyPath(straight), [
      { x: 50, y: 200 },
      { x: 245, y: 200 },
    ]);
  });
});

describe("pathToSvgD — Catmull-Rom smoothing", () => {
  const arc: Vec[] = [
    { x: 100, y: 300 },
    { x: 160, y: 240 },
    { x: 230, y: 215 },
    { x: 300, y: 250 },
    { x: 340, y: 320 },
  ];

  it("emits cubic Béziers, not straight segments", () => {
    const d = pathToSvgD(arc);
    assert.match(d, /C /, "expected cubic curve commands");
    assert.doesNotMatch(d, / L /, "smoothed routes should not emit line segments");
  });

  it("starts exactly on the first point", () => {
    assert.deepEqual(firstMoveTo(pathToSvgD(arc)), arc[0]);
  });

  it("ends exactly on the last point", () => {
    assert.deepEqual(lastPoint(pathToSvgD(arc)), arc[arc.length - 1]);
  });

  it("passes exactly through every interior point", () => {
    // Catmull-Rom interpolates: each segment's Bézier terminates on the next point.
    const d = pathToSvgD(arc);
    const segmentEnds = [...d.matchAll(/C [\d.\-]+ [\d.\-]+ [\d.\-]+ [\d.\-]+ (-?[\d.]+) (-?[\d.]+)/g)]
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    assert.deepEqual(segmentEnds, arc.slice(1));
  });

  it("draws a two-point path as a straight line", () => {
    const d = pathToSvgD([
      { x: 10, y: 20 },
      { x: 80, y: 90 },
    ]);
    assert.equal(d, "M 10 20 L 80 90");
  });

  it("is stable for empty and single-point input", () => {
    assert.equal(pathToSvgD([]), "");
    assert.equal(pathToSvgD([{ x: 7, y: 8 }]), "M 7 8");
  });

  it("polylineToSvgD still gives the raw shape for hit testing", () => {
    const d = polylineToSvgD(arc);
    assert.match(d, / L /);
    assert.doesNotMatch(d, /C /);
  });
});

describe("builder and animator render the same route", () => {
  it("a drawn action is stored simplified and within budget", () => {
    const play = createEmptyPlay();
    const start = play.beats[0].startPos["3"];
    const stroke: Vec[] = Array.from({ length: 60 }, (_, i) => {
      const u = i / 59;
      return {
        x: start.x + u * 120,
        y: start.y - Math.sin(u * Math.PI) * 90 + (i % 2 ? 1.2 : -1.2),
      };
    });

    const beats = addDrawnAction(play.beats, 0, {
      type: "cut",
      by: "3",
      path: stroke,
    });
    const stored = beats[0].actions[0].path!;

    assert.ok(stored.length <= MAX_PATH_POINTS);
    assert.deepEqual(stored[0], stroke[0]);
    assert.deepEqual(stored[stored.length - 1], stroke[stroke.length - 1]);
    // The player's destination is the stroke's real end, not a simplified approximation.
    assert.deepEqual(beats[0].pos["3"], stroke[stroke.length - 1]);
  });

  it("the same points produce the same `d` wherever they are rendered", () => {
    // ActionLayer (builder), RouteLayer (animator) and DrawPreview all call pathToSvgD,
    // so identity here is what keeps a drawn route and a played route the same curve.
    const route: Vec[] = [
      { x: 120, y: 280 },
      { x: 175, y: 230 },
      { x: 250, y: 210 },
      { x: 310, y: 245 },
    ];
    assert.equal(pathToSvgD(route), pathToSvgD(route.map((p) => ({ ...p }))));
  });
});
