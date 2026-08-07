/** Single source of timing for all playback (editor, quiz, dev). */

export const BEAT_DURATION_MS = 2400;
export const BEAT_HOLD_MS = 900;
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5];

export const SEQ_BEAT_HOLD_MS = BEAT_HOLD_MS;
export const SEQ_PAUSE_MS = 0;
export const SEQ_ACTION_MS = Math.round(BEAT_DURATION_MS * 0.9);
export const SEQ_PASS_MS = Math.round(BEAT_DURATION_MS * 0.7);

/** Quiz runs slightly slower on top of base timing */
export const QUIZ_SPEED = 0.9;
