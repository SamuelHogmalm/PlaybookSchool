/** Cut — ease-in-out, sharpest at the start. */
export function easeInOutCut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Dribble — ease-in-out at ~70% of cut speed (stretched time). */
export function easeInOutDribble(t: number): number {
  const slowed = Math.pow(t, 0.85);
  return easedStretch(slowed);
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

function easedStretch(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
