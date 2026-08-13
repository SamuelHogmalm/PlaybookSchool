import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lerpVec,
  polylineLength,
  samplePolyline,
} from "../../src/lib/timing/pathSample.js";
import {
  easeInOutCut,
  easeInOutDribble,
  easeInRoll,
  easeOutScreen,
  linear,
} from "../../src/lib/timing/easing.js";
import type { Vec } from "../../src/lib/play/types.js";

const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} !== ${b} (tol ${tol})`);

describe("samplePolyline — arc-length, not per-segment", () => {
  /** Deliberately uneven: one long leg then a short one. */
  const uneven: Vec[] = [
    { x: 0, y: 0 },
    { x: 90, y: 0 },
    { x: 100, y: 0 },
  ];

  it("returns the endpoints at 0 and 1", () => {
    assert.deepEqual(samplePolyline(uneven, 0), { x: 0, y: 0 });
    assert.deepEqual(samplePolyline(uneven, 1), { x: 100, y: 0 });
  });

  it("halfway is halfway along the total length, not the middle vertex", () => {
    // The middle vertex sits at 90% of the length. Sampling per-segment would
    // put u=0.5 there and make the player crawl the last tenth of the route.
    const mid = samplePolyline(uneven, 0.5);
    near(mid.x, 50);
  });

  it("advances monotonically", () => {
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const { x } = samplePolyline(uneven, Math.min(1, u));
      assert.ok(x >= prev, `x went backwards at u=${u}`);
      prev = x;
    }
  });

  it("clamps u outside [0, 1]", () => {
    assert.deepEqual(samplePolyline(uneven, -5), { x: 0, y: 0 });
    assert.deepEqual(samplePolyline(uneven, 5), { x: 100, y: 0 });
  });

  it("follows a corner rather than cutting it", () => {
    const corner: Vec[] = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    const quarter = samplePolyline(corner, 0.25);
    assert.deepEqual(quarter, { x: 0, y: 50 }, "still on the first leg");
    const threeQuarters = samplePolyline(corner, 0.75);
    assert.deepEqual(threeQuarters, { x: 50, y: 100 }, "on the second leg");
  });

  it("survives degenerate paths", () => {
    assert.deepEqual(samplePolyline([], 0.5), { x: 0, y: 0 });
    assert.deepEqual(samplePolyline([{ x: 7, y: 9 }], 0.5), { x: 7, y: 9 });
    // Zero length: every sample is the start, and it must not divide by zero.
    const stacked: Vec[] = [
      { x: 4, y: 4 },
      { x: 4, y: 4 },
    ];
    assert.deepEqual(samplePolyline(stacked, 0.5), { x: 4, y: 4 });
  });

  it("does not alias the input points", () => {
    const pts: Vec[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const out = samplePolyline(pts, 1);
    out.x = 999;
    assert.equal(pts[1].x, 10);
  });
});

describe("polylineLength", () => {
  it("sums the segments", () => {
    near(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ]),
      15,
    );
  });

  it("is zero for fewer than two points", () => {
    assert.equal(polylineLength([]), 0);
    assert.equal(polylineLength([{ x: 1, y: 1 }]), 0);
  });
});

describe("lerpVec", () => {
  it("interpolates both axes", () => {
    assert.deepEqual(
      lerpVec({ x: 0, y: 10 }, { x: 100, y: 30 }, 0.25),
      { x: 25, y: 15 },
    );
  });
});

describe("easing curves", () => {
  const curves = {
    easeInOutCut,
    easeInOutDribble,
    easeOutScreen,
    easeInRoll,
    linear,
  };

  for (const [name, fn] of Object.entries(curves)) {
    it(`${name} maps 0 to 0 and 1 to 1`, () => {
      near(fn(0), 0, 1e-12);
      near(fn(1), 1, 1e-12);
    });

    it(`${name} is monotonic and stays within [0, 1]`, () => {
      let prev = -Infinity;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const v = fn(Math.min(1, t));
        assert.ok(v >= prev - 1e-12, `${name} went backwards at t=${t}`);
        assert.ok(v >= -1e-9 && v <= 1 + 1e-9, `${name} left [0,1] at t=${t}`);
        prev = v;
      }
    });
  }

  it("the screener decelerates — over half the travel in the first half", () => {
    assert.ok(easeOutScreen(0.5) > 0.5, "ease-out must front-load the distance");
  });

  it("the roll accelerates — under half the travel in the first half", () => {
    assert.ok(easeInRoll(0.5) < 0.5, "a roll should build speed toward the rim");
  });

  // KNOWN DISCREPANCY, pinned deliberately rather than asserted as correct.
  //
  // easeInOutDribble is documented as "~70% of cut speed (stretched time)", but it
  // runs *ahead* of the cut curve at every point — 2x its progress at t=0.1. The
  // cause is `Math.pow(t, 0.85)`: an exponent below 1 raises t, compressing early
  // time instead of stretching it. Both lanes are 0.60 wide (cut 0.10–0.70, dribble
  // 0.25–0.85), so the lane cannot be supplying the slowdown either.
  //
  // Left as-is because changing it changes how every existing play animates. This
  // test records the current behaviour so a fix is a visible diff, not a surprise.
  it("dribble currently leads the cut curve (see comment — intent says otherwise)", () => {
    for (const t of [0.1, 0.25, 0.5, 0.75]) {
      assert.ok(
        easeInOutDribble(t) > easeInOutCut(t),
        `dribble should currently lead at t=${t}`,
      );
    }
  });
});
