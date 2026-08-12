import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actionArcProgress,
  routeRemaining,
  samplePolyline,
} from "../../src/lib/timing/index.js";

describe("routeRemaining", () => {
  const route = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it("returns full route at progress 0", () => {
    const rem = routeRemaining(route, 0);
    assert.equal(rem.length, 3);
    assert.deepEqual(rem[0], route[0]);
    assert.deepEqual(rem[2], route[2]);
  });

  it("returns empty at progress 1", () => {
    assert.deepEqual(routeRemaining(route, 1), []);
  });

  it("head matches samplePolyline at same progress", () => {
    const progress = 0.45;
    const rem = routeRemaining(route, progress);
    assert.ok(rem.length >= 2);
    const head = samplePolyline(route, progress);
    assert.equal(rem[0].x, head.x);
    assert.equal(rem[0].y, head.y);
  });

  it("shrinks as progress increases", () => {
    const early = routeRemaining(route, 0.2);
    const late = routeRemaining(route, 0.8);
    assert.ok(early.length >= late.length);
  });
});

describe("actionArcProgress", () => {
  it("is 0 before startAt and 1 after endAt", () => {
    const action = {
      id: "a1",
      type: "cut" as const,
      by: "1" as const,
      startAt: 0.3,
      endAt: 0.7,
    };
    assert.equal(actionArcProgress(0.1, action, []), 0);
    assert.equal(actionArcProgress(0.9, action, []), 1);
  });

  it("uses eased progress mid-window", () => {
    const action = {
      id: "a1",
      type: "cut" as const,
      by: "1" as const,
      startAt: 0,
      endAt: 1,
    };
    const early = actionArcProgress(0.25, action, []);
    assert.ok(early > 0 && early < 0.5);
  });
});
