/**
 * Half-court zone names — matches geometry in Court.jsx (NCAA 3pt, 160px key).
 * Basket at top (small y). y increases toward half court.
 */

export const COURT_W = 500;
export const COURT_H = 470;
export const HOOP = { x: 250, y: 52.5 };

const PX_PER_IN = 160 / 144;
const THREE_PT_SCALE = 0.75;
const R3 = (22 * 12 + 1.75) * PX_PER_IN * THREE_PT_SCALE;
const LEFT_BREAK_X = 42 * PX_PER_IN * THREE_PT_SCALE;
const RIGHT_BREAK_X = COURT_W - LEFT_BREAK_X;
const KEY_L = 170;
const KEY_R = 330;
const KEY_H = 190;

/** How far from a paint edge still counts as "inline with the lane" (top area). */
const PAINT_INLINE = 52;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function yOnThreePtArc(x) {
  const d = R3 * R3 - (x - HOOP.x) ** 2;
  if (d <= 0) return HOOP.y;
  return HOOP.y + Math.sqrt(d);
}

export function isOutsideThreePt(p) {
  const { x, y } = p;
  if (x < LEFT_BREAK_X) return y > yOnThreePtArc(LEFT_BREAK_X);
  if (x > RIGHT_BREAK_X) return y > yOnThreePtArc(RIGHT_BREAK_X);
  return y > yOnThreePtArc(x) + 1;
}

function isCorner(p) {
  const { x, y } = p;
  const onLeftBreak = x <= LEFT_BREAK_X + 25;
  const onRightBreak = x >= RIGHT_BREAK_X - 25;
  if (!onLeftBreak && !onRightBreak) return false;
  const meetY = onLeftBreak ? yOnThreePtArc(LEFT_BREAK_X) : yOnThreePtArc(RIGHT_BREAK_X);
  if (y <= meetY + 45) return true;
  if (isOutsideThreePt(p) && y <= meetY + 75) return true;
  return false;
}

function isShortCorner(p) {
  if (isCorner(p) || isHighPostTop(p)) return false;
  const { x, y } = p;
  const left = x <= 95;
  const right = x >= 405;
  if (!left && !right) return false;
  if (isOutsideThreePt(p)) return false;
  return y >= 70 && y <= KEY_H + 40;
}

function isElbow(p) {
  const left = { x: KEY_L, y: KEY_H };
  const right = { x: KEY_R, y: KEY_H };
  return dist(p, left) <= 38 || dist(p, right) <= 38;
}

function isInPaint(p) {
  return p.x >= KEY_L && p.x <= KEY_R && p.y <= KEY_H;
}

/** Horns / high post — inside the arc at the top of the lane. */
function isHighPostTop(p) {
  const { x, y } = p;
  if (isOutsideThreePt(p)) return false;
  if (y < 55 || y > 178) return false;
  if (x < KEY_L - 22 || x > KEY_R + 22) return false;
  if (isElbow(p)) return false;
  if (x >= KEY_L && x <= KEY_R && y > 115) return false;
  return true;
}

/**
 * Outside the arc but inline with the paint — top of the key, not the wing.
 * Wing spots sit clearly outside the paint sideline band.
 */
function isPaintLaneTop(p) {
  if (!isOutsideThreePt(p)) return false;
  const { x, y } = p;
  if (y < 58 || y > 360) return false;

  const inlineLeft = x >= KEY_L - PAINT_INLINE && x <= KEY_L + PAINT_INLINE;
  const inlineRight = x >= KEY_R - PAINT_INLINE && x <= KEY_R + PAINT_INLINE;
  const centerSlot = x >= 212 && x <= 288 && y >= KEY_H - 15;

  return inlineLeft || inlineRight || centerSlot;
}

function isTopOfKey(p) {
  return isHighPostTop(p) || isPaintLaneTop(p);
}

function isWing(p) {
  return isOutsideThreePt(p) && !isCorner(p) && !isTopOfKey(p);
}

export function courtZoneName(p) {
  if (!p) return "open spot";

  if (isElbow(p)) return p.x < HOOP.x ? "left elbow" : "right elbow";
  if (isCorner(p)) return p.x < HOOP.x ? "left corner" : "right corner";
  if (isTopOfKey(p)) return "top of the key";
  if (isShortCorner(p)) return p.x < HOOP.x ? "left short corner" : "right short corner";
  if (isInPaint(p)) return "the block";
  if (isWing(p)) {
    if (p.x < HOOP.x - 40) return "left wing";
    if (p.x > HOOP.x + 40) return "right wing";
    return "wing";
  }

  if (!isOutsideThreePt(p)) {
    if (p.y <= KEY_H && p.x >= KEY_L && p.x <= KEY_R) return "the block";
    if (isHighPostTop(p)) return "top of the key";
    if (p.x <= 95) return "left short corner";
    if (p.x >= 405) return "right short corner";
    return p.x < HOOP.x ? "left wing" : "right wing";
  }

  return p.x < HOOP.x ? "left wing" : "right wing";
}

export function zoneLabel(p) {
  const z = courtZoneName(p);
  if (z === "the block" || z === "the paint" || z === "top of the key") return z;
  if (z.startsWith("left") || z.startsWith("right")) return `the ${z}`;
  if (z === "wing") return "the wing";
  if (z === "open spot") return "the open spot";
  return `the ${z}`;
}
