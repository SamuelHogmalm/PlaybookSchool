/**
 * Undo/redo for the builder.
 *
 * Deliberately generic and pure: the builder holds one History<Play> and every
 * mutation goes through commit(), so there is no second way to change the play
 * that history could miss.
 */

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

/** Steps retained. The plan asks for at least 50; a play edit is small. */
export const HISTORY_LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

function trim<T>(past: T[]): T[] {
  return past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
}

/**
 * Record a new state. Drops the redo branch, because redoing onto a diverged
 * history would reapply edits the coach has already replaced.
 */
export function commit<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  return {
    past: trim([...history.past, history.present]),
    present: next,
    future: [],
  };
}

/** Replace the current state without adding a history step (e.g. a save echo). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next };
}

/**
 * Close a run of live edits into one undoable step.
 *
 * A drag updates the play on every pointer move so the court stays live, but each of
 * those frames is not a thing a coach would want to undo one at a time. Those frames
 * go through `replacePresent`, and this records the state from *before* the run as the
 * point undo returns to.
 *
 * `base` is the pre-run state, not the current one — that is what makes it different
 * from `commit`, which pushes the present it is replacing.
 */
export function checkpoint<T>(history: History<T>, base: T): History<T> {
  if (base === history.present) return history;
  return {
    past: trim([...history.past, base]),
    present: history.present,
    future: [],
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}
