import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canRedo,
  canUndo,
  commit,
  HISTORY_LIMIT,
  initHistory,
  redo,
  replacePresent,
  undo,
} from "../../src/lib/play/history.js";

describe("builder history", () => {
  it("starts empty and cannot undo or redo", () => {
    const h = initHistory("a");
    assert.equal(h.present, "a");
    assert.equal(canUndo(h), false);
    assert.equal(canRedo(h), false);
  });

  it("undo and redo walk the stack", () => {
    let h = initHistory("a");
    h = commit(h, "b");
    h = commit(h, "c");

    h = undo(h);
    assert.equal(h.present, "b");
    h = undo(h);
    assert.equal(h.present, "a");
    assert.equal(canUndo(h), false);

    h = redo(h);
    assert.equal(h.present, "b");
    h = redo(h);
    assert.equal(h.present, "c");
    assert.equal(canRedo(h), false);
  });

  it("undoing past the start is a no-op, not a crash", () => {
    let h = initHistory("a");
    h = undo(undo(h));
    assert.equal(h.present, "a");
    h = redo(h);
    assert.equal(h.present, "a");
  });

  it("a new edit after undo drops the redo branch", () => {
    let h = initHistory("a");
    h = commit(h, "b");
    h = undo(h);
    assert.equal(canRedo(h), true);

    h = commit(h, "c");
    assert.equal(canRedo(h), false);
    assert.equal(h.present, "c");
    h = undo(h);
    assert.equal(h.present, "a");
  });

  it("retains at least 50 steps and caps growth", () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 25; i++) h = commit(h, i);

    assert.equal(h.past.length, HISTORY_LIMIT);
    assert.ok(HISTORY_LIMIT >= 50, "history must hold at least 50 steps");

    for (let i = 0; i < 50; i++) h = undo(h);
    assert.equal(h.present, HISTORY_LIMIT + 25 - 50);
  });

  it("committing the identical state does not add a step", () => {
    let h = initHistory("a");
    h = commit(h, "a");
    assert.equal(canUndo(h), false);
  });

  it("replacePresent does not add a history step", () => {
    let h = initHistory("a");
    h = commit(h, "b");
    const before = h.past.length;
    h = replacePresent(h, "b-saved");
    assert.equal(h.present, "b-saved");
    assert.equal(h.past.length, before);
  });
});
