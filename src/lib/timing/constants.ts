/** Mandatory hold after every beat's move phase. */
export const HOLD_MS = 1200;

/*
 * Movement pace. Raised 25% from the original 1800 / 400 / 3500 — plays read as
 * hurried at the old speed, and the product is for memorising where people go, which
 * means the eye has to be able to follow each one.
 *
 * The hold is unchanged: it is a pause for reading the end state, not movement, and
 * stretching it too would just make playback feel slack.
 *
 * These three scale together — change them as a set or the pace stops being uniform.
 */
export const BEAT_BASE_MS = 2250;
export const BEAT_PER_ACTION_MS = 500;
export const BEAT_MAX_MS = 4400;

/** Pass flight uses linear interpolation at ~3× typical player speed. */
export const PASS_SPEED_MULTIPLIER = 3;
