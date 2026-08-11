import { COURT_HEIGHT, COURT_WIDTH } from "@/lib/play/geometry";

export { COURT_WIDTH, COURT_HEIGHT };

export const HOOP = { x: 250, y: 52.5 };

const PX_PER_IN = 160 / 144;
const COLLEGE_3PT_IN = 22 * 12 + 1.75;
const CORNER_INSET_IN = 42;
const THREE_PT_DIAGRAM_SCALE = 0.75;

/** NCAA 3pt: vertical corner segments from baseline up to arc, then arc across. */
export function collegeThreePointD(
  cx: number,
  cy: number,
  r: number,
  leftCornerX: number,
  rightCornerX: number,
): string {
  const yOnArc = (x: number) => cy + Math.sqrt(Math.max(0, r * r - (x - cx) ** 2));
  const leftY = yOnArc(leftCornerX);
  const rightY = yOnArc(rightCornerX);

  const leftA = Math.atan2(leftY - cy, leftCornerX - cx);
  const rightA = Math.atan2(rightY - cy, rightCornerX - cx);
  const bottomA = Math.PI / 2;
  const leftA2 = leftA < bottomA ? leftA + 2 * Math.PI : leftA;

  const steps = 32;
  let d = `M ${leftCornerX} 0 L ${leftCornerX} ${leftY}`;
  for (let i = 0; i <= steps; i++) {
    const a = leftA2 + (i / steps) * (bottomA - leftA2);
    d += ` L ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }
  for (let i = 1; i <= steps; i++) {
    const a = bottomA + (i / steps) * (rightA - bottomA);
    d += ` L ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }
  d += ` L ${rightCornerX} ${rightY} L ${rightCornerX} 0`;
  return d;
}

export function courtGeometry() {
  const cx = HOOP.x;
  const cy = HOOP.y;
  const r3 = COLLEGE_3PT_IN * PX_PER_IN * THREE_PT_DIAGRAM_SCALE;
  const leftCornerX = CORNER_INSET_IN * PX_PER_IN * THREE_PT_DIAGRAM_SCALE;
  const rightCornerX = COURT_WIDTH - leftCornerX;
  const keyL = 170;
  const keyR = 330;
  const keyH = 190;
  const ftR = 60;
  const boardY = 8;

  return {
    cx,
    cy,
    r3,
    leftCornerX,
    rightCornerX,
    keyL,
    keyR,
    keyH,
    ftR,
    boardY,
  };
}
