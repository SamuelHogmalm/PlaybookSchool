import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  cropUrl,
  isClean,
  reviewPlay,
  reviewPlaybook,
} from "../../src/lib/review/index.js";
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import { validatePlay } from "../../src/lib/play/validation.js";
import type { Play, SeedPlay } from "../../src/lib/play/types.js";
import seedPlays from "../../src/data/plays-interpreted.json" with { type: "json" };

const PLAYS: Play[] = (seedPlays as SeedPlay[]).map((raw) => {
  const play = normalizeSeedPlay(raw);
  const result = validatePlay(play);
  return { ...play, valid: result.valid, validationErrors: result.errors };
});

describe("review scoring", () => {
  it("scores every seed play", () => {
    assert.equal(reviewPlaybook(PLAYS).length, 12);
  });

  it("orders worst first", () => {
    const scores = reviewPlaybook(PLAYS).map((r) => r.confidence);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] >= scores[i - 1], "queue is not sorted worst-first");
    }
  });

  it("is stable — the queue does not reshuffle between runs", () => {
    const a = reviewPlaybook(PLAYS).map((r) => r.playId);
    const b = reviewPlaybook([...PLAYS].reverse()).map((r) => r.playId);
    assert.deepEqual(a, b);
  });

  it("confidence stays within 0 and 1", () => {
    for (const r of reviewPlaybook(PLAYS)) {
      assert.ok(r.confidence >= 0 && r.confidence <= 1, `${r.name}: ${r.confidence}`);
    }
  });

  it("an invalid play sorts to the very front", () => {
    const broken: Play = {
      ...PLAYS[0],
      beats: [PLAYS[0].beats[0]],
    };
    assert.equal(reviewPlay(broken).confidence, 0);
    assert.equal(reviewPlay(broken).valid, false);
  });

  it("flags every derived and unsure action", () => {
    for (const play of PLAYS) {
      const review = reviewPlay(play);
      const expected = play.beats.flatMap((b) =>
        b.actions.filter((a) => a.derived || a.needsReview).map((a) => a.id),
      );
      for (const id of expected) {
        assert.ok(
          review.flagged.some((f) => f.actionId === id),
          `${play.name}: action ${id} was not flagged`,
        );
      }
    }
  });

  it("never flags the same action twice", () => {
    // Action ids repeat across beats — "a1" is on most of them — so a flag is
    // identified by beat and id together.
    for (const play of PLAYS) {
      const keys = reviewPlay(play).flagged.map(
        (f) => `${f.beatIndex}:${f.actionId}`,
      );
      assert.equal(new Set(keys).size, keys.length, `${play.name} has duplicate flags`);
    }
  });

  it("every flag carries a reason a coach can read", () => {
    for (const play of PLAYS) {
      for (const flag of reviewPlay(play).flagged) {
        assert.ok(flag.why.length > 10, `${play.name} ${flag.actionId}: "${flag.why}"`);
      }
    }
  });

  it("every flag points at a beat and action that exist", () => {
    for (const play of PLAYS) {
      for (const flag of reviewPlay(play).flagged) {
        const beat = play.beats[flag.beatIndex];
        assert.ok(beat, `${play.name}: beat ${flag.beatIndex} missing`);
        assert.ok(
          beat.actions.some((a) => a.id === flag.actionId),
          `${play.name}: action ${flag.actionId} not on beat ${flag.beatIndex + 1}`,
        );
      }
    }
  });

  it("recognises a play with nothing left to look at", () => {
    // No seed play is clean today: every one carries at least one derived or unsure
    // action. That is the state of the import, not a bug in the scoring — so this
    // checks the predicate against a play built to be clean.
    const base = PLAYS.find((p) => p.valid)!;
    const scrubbed: Play = {
      ...base,
      beats: base.beats.map((b) => ({
        ...b,
        actions: b.actions
          .filter((a) => a.type !== "pass" && a.type !== "handoff")
          .map((a) => {
            // Destructured only to drop the review flags from `rest`.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { derived, needsReview, reason, ...rest } = a;
            return rest;
          }),
      })),
    };

    const review = reviewPlay(scrubbed);
    assert.equal(review.flagged.length, 0, review.flagged.map((f) => f.why).join("; "));
    assert.equal(isClean(review), review.valid);
  });

  it("no seed play is clean yet — the whole book needs a human", () => {
    const clean = PLAYS.map(reviewPlay).filter(isClean);
    assert.equal(
      clean.length,
      0,
      `unexpectedly clean: ${clean.map((c) => c.name).join(", ")}`,
    );
  });
});

describe("source crops", () => {
  it("builds a URL per beat, 1-based to match the filenames", () => {
    assert.equal(cropUrl("Alabama", 0), "/dev-repairs/crops/Alabama_beat1.png");
    assert.equal(cropUrl("Alabama", 2), "/dev-repairs/crops/Alabama_beat3.png");
  });

  it("strips characters the filenames do not carry", () => {
    // The play is displayed as "Relax*" but filed as "Relax".
    assert.equal(cropUrl("Relax*", 0), "/dev-repairs/crops/Relax_beat1.png");
  });

  it("resolves to a file that exists for the first beat of every play", () => {
    const root = join(process.cwd(), "public");
    const missing: string[] = [];
    for (const play of PLAYS) {
      const url = cropUrl(play.name, 0);
      if (!existsSync(join(root, url))) missing.push(`${play.name} -> ${url}`);
    }
    assert.deepEqual(missing, [], `crops missing:\n${missing.join("\n")}`);
  });
});
