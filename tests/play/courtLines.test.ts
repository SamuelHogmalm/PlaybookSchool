import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collegeThreePointD,
  courtGeometry,
} from "../../src/lib/court/courtLines.js";

const g = courtGeometry();
const arc = () =>
  collegeThreePointD(g.cx, g.cy, g.r3, g.leftCornerX, g.rightCornerX);

describe("collegeThreePointD", () => {
  it("emits no coordinate with more than three decimals", () => {
    // Raw floats here caused a hydration mismatch: Math.cos/Math.sin are not required
    // to be correctly rounded, so the server and the browser could differ in the last
    // bit of a 17-digit number and React would report the markup as mismatched.
    const numbers = arc().match(/-?\d+\.\d+/g) ?? [];
    assert.ok(numbers.length > 0, "expected fractional coordinates in the path");
    for (const n of numbers) {
      const decimals = n.split(".")[1] ?? "";
      assert.ok(
        decimals.length <= 3,
        `${n} carries ${decimals.length} decimals — it will not hydrate reliably`,
      );
    }
  });

  it("is deterministic", () => {
    assert.equal(arc(), arc());
  });

  it("starts and ends on the baseline at the corner insets", () => {
    const d = arc();
    assert.ok(d.startsWith(`M ${g.leftCornerX} 0 `), d.slice(0, 40));
    assert.ok(d.endsWith(` L ${g.rightCornerX} 0`), d.slice(-40));
  });

  it("stays inside the court", () => {
    const pairs = [...arc().matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    assert.ok(pairs.length > 60, "expected the arc to be sampled finely");
    for (const [, x, y] of pairs) {
      assert.ok(Number(x) >= 0 && Number(x) <= 500, `x ${x} off court`);
      assert.ok(Number(y) >= 0 && Number(y) <= 470, `y ${y} off court`);
    }
  });

  it("reaches its furthest point at the top of the arc", () => {
    const pairs = [...arc().matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(
      ([, x, y]) => ({ x: Number(x), y: Number(y) }),
    );
    const deepest = pairs.reduce((a, b) => (b.y > a.y ? b : a));
    // The apex sits directly above the hoop, a radius away from it.
    assert.ok(Math.abs(deepest.x - g.cx) < 1, `apex x ${deepest.x} vs hoop ${g.cx}`);
    assert.ok(Math.abs(deepest.y - (g.cy + g.r3)) < 0.01);
  });
});
