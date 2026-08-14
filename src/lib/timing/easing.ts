/** Cut — ease-in-out, sharpest at the start. */
export function easeInOutCut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Dribble — paced exactly like a cut.
 *
 * This used to stretch time with `Math.pow(t, 0.85)`, meant to make a dribble ~70% of
 * cut speed. The exponent was below 1, so it did the opposite and put the ball-handler
 * *ahead* of a cutter who left at the same time. Rather than invert it, the curves are
 * now the same: a player moves at one speed whether or not they have the ball, and
 * overall pace is set by beat duration instead.
 *
 * Kept as its own export so the two can diverge again without touching every call site.
 */
export function easeInOutDribble(t: number): number {
  return easeInOutCut(t);
}

/** Screener — ease-out to the spot. */
export function easeOutScreen(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Roll / dive — ease-in, accelerating toward the rim. */
export function easeInRoll(t: number): number {
  return t * t;
}

export function linear(t: number): number {
  return t;
}
