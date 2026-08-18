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

/*
 * Real tempo, for beats a coach has broken into steps.
 *
 * The court is 500 x 470 units for a half court, so 10 units is about a foot. A player
 * making a purposeful basketball move — a hard cut, not a sprint and not a jog — covers
 * roughly 8 to 9 feet a second, so 85 units.
 *
 * Timing every step alike was what made playback look frantic: a 300-unit cut and a
 * 30-unit shuffle were given the same slice, so the long one had to be run at three
 * times the speed of the short one to fit.
 */
export const MOVE_UNITS_PER_SECOND = 85;

/** Even a short move needs long enough to be seen and understood. */
export const MIN_STEP_MS = 800;

/** Nothing on a half court should take longer than this to run. */
export const MAX_STEP_MS = 3200;

/** A step that only moves the ball — nobody is running, so it is quick. */
export const BALL_ONLY_STEP_MS = 650;
