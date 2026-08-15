import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateForPlay,
  generateForPlays,
  generatePassTargets,
  generateSpots,
  SPOT_TOLERANCE,
} from "../../src/lib/quiz/generate.js";
import { gradeAnswer } from "../../src/lib/quiz/grade.js";
import { buildSession, SESSION_MAX } from "../../src/lib/quiz/session.js";
import { makeRng } from "../../src/lib/quiz/random.js";
import { isChoice, isSpot, type Question } from "../../src/lib/quiz/types.js";
import { normalizeSeedPlay } from "../../src/lib/play/normalize.js";
import { suspectTransfers, validatePlay } from "../../src/lib/play/validation.js";
import type { Play, SeedPlay } from "../../src/lib/play/types.js";
import seedPlays from "../../src/data/plays-interpreted.json" with { type: "json" };

const PLAYS: Play[] = (seedPlays as SeedPlay[]).map((raw) => {
  const play = normalizeSeedPlay(raw);
  const result = validatePlay(play);
  return { ...play, valid: result.valid, validationErrors: result.errors };
});

const rng = () => makeRng(42);

describe("question generation — pass targets", () => {
  it("produces questions, but fewer than there are passes", () => {
    let passes = 0;
    for (const play of PLAYS) {
      for (const beat of play.beats) {
        for (const a of beat.actions) {
          if ((a.type === "pass" || a.type === "handoff") && a.for) passes++;
        }
      }
    }
    const generated = PLAYS.flatMap((p) => generatePassTargets(p, rng()));
    assert.ok(generated.length > 0, "no pass questions at all");
    assert.ok(
      generated.length < passes,
      "every pass became a question — the trust filters are not running",
    );
  });

  it("never asks about a guessed or unreviewed pass", () => {
    for (const play of PLAYS) {
      for (const q of generatePassTargets(play, rng())) {
        const beat = play.beats[q.askAtBeat];
        const action = beat.actions.find(
          (a) => a.by === q.subject && a.for === q.answerId,
        )!;
        assert.ok(
          !action.derived && !action.needsReview,
          `${q.id} asks about an action the pipeline was unsure of`,
        );
      }
    }
  });

  it("never asks about a transfer validation calls implausible", () => {
    for (const play of PLAYS) {
      const suspect = new Set(suspectTransfers(play).map((s) => s.actionId));
      for (const q of generatePassTargets(play, rng())) {
        const beat = play.beats[q.askAtBeat];
        const action = beat.actions.find(
          (a) => a.by === q.subject && a.for === q.answerId,
        )!;
        assert.ok(!suspect.has(action.id), `${q.id} asks about a flagged transfer`);
      }
    }
  });

  it("only asks about a pass the receiver still holds at the end of the beat", () => {
    // Relax beat 2 sends the ball 3 → 1 → 3. Asking about the first leg gives an
    // answer nobody watching can see, because the ball is back before the beat ends.
    for (const play of PLAYS) {
      for (const q of generatePassTargets(play, rng())) {
        assert.equal(
          play.beats[q.askAtBeat].ball,
          q.answerId,
          `${q.id}: the ball does not rest with the answer`,
        );
      }
    }
  });

  it("the answer is always among the choices, and named once", () => {
    for (const q of PLAYS.flatMap((p) => generatePassTargets(p, rng()))) {
      const matches = q.choices.filter((c) => c.id === q.answerId);
      assert.equal(matches.length, 1, `${q.id} has ${matches.length} correct choices`);
    }
  });

  it("never offers the passer as a choice — that would be a self pass", () => {
    for (const play of PLAYS) {
      for (const q of generatePassTargets(play, rng())) {
        assert.ok(
          !q.choices.some((c) => c.id === q.subject),
          `${q.id} offered the passer`,
        );
      }
    }
  });

  it("offers between three and four options", () => {
    for (const q of PLAYS.flatMap((p) => generatePassTargets(p, rng()))) {
      assert.ok(
        q.choices.length >= 3 && q.choices.length <= 4,
        `${q.id} had ${q.choices.length} choices`,
      );
    }
  });

  it("is deterministic for a given seed", () => {
    const a = generatePassTargets(PLAYS[0], makeRng(7));
    const b = generatePassTargets(PLAYS[0], makeRng(7));
    assert.deepEqual(a, b);
  });
});

describe("question generation — spots", () => {
  it("asks about a player who is really there, at their real position", () => {
    for (const play of PLAYS) {
      for (const q of generateSpots(play, rng())) {
        const beat = play.beats[q.askAtBeat];
        assert.deepEqual(q.answer, beat.startPos[q.subject]);
      }
    }
  });

  it("never asks about a player standing on top of someone else", () => {
    // A tap that lands on the wrong player but still grades correct teaches nothing.
    for (const play of PLAYS) {
      for (const q of generateSpots(play, rng())) {
        const beat = play.beats[q.askAtBeat];
        for (const other of Object.keys(beat.startPos)) {
          if (other === q.subject) continue;
          const p = beat.startPos[other as keyof typeof beat.startPos];
          if (!p) continue;
          const d = Math.hypot(p.x - q.answer.x, p.y - q.answer.y);
          assert.ok(d >= 40, `${q.id}: player ${other} is only ${d.toFixed(1)} away`);
        }
      }
    }
  });

  it("reveals into the next beat where there is one", () => {
    for (const play of PLAYS) {
      for (const q of generateSpots(play, rng())) {
        assert.ok(q.revealToBeat >= q.askAtBeat);
        assert.ok(q.revealToBeat < play.beats.length);
      }
    }
  });
});

describe("question generation — safety rules", () => {
  it("never generates from an invalid play", () => {
    const broken: Play = { ...PLAYS[0], valid: false };
    assert.deepEqual(generateForPlay(broken), []);
  });

  it("every seed play produces questions", () => {
    for (const play of PLAYS) {
      assert.ok(play.valid, `${play.name} should validate`);
      assert.ok(
        generateForPlay(play).length > 0,
        `${play.name} produced no questions`,
      );
    }
  });

  it("question ids are unique across the whole playbook", () => {
    const ids = generateForPlays(PLAYS).map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("every question points at a beat that exists", () => {
    for (const q of generateForPlays(PLAYS)) {
      const play = PLAYS.find((p) => p.id === q.playId)!;
      assert.ok(q.askAtBeat >= 0 && q.askAtBeat < play.beats.length);
      assert.ok(q.revealToBeat >= 0 && q.revealToBeat < play.beats.length);
    }
  });
});

describe("grading", () => {
  const spot = generateSpots(PLAYS[0], rng())[0];

  it("accepts a tap within tolerance", () => {
    const near = { x: spot.answer.x + SPOT_TOLERANCE - 5, y: spot.answer.y };
    assert.equal(gradeAnswer(spot, { kind: "point", at: near }).correct, true);
  });

  it("rejects a tap outside tolerance", () => {
    const far = { x: spot.answer.x + SPOT_TOLERANCE + 5, y: spot.answer.y };
    const grade = gradeAnswer(spot, { kind: "point", at: far });
    assert.equal(grade.correct, false);
    assert.ok(grade.distance! > SPOT_TOLERANCE);
  });

  it("reports the expected answer whether right or wrong", () => {
    const right = gradeAnswer(spot, { kind: "point", at: spot.answer });
    const wrong = gradeAnswer(spot, { kind: "point", at: { x: 0, y: 0 } });
    assert.ok(right.expected.length > 0);
    assert.equal(right.expected, wrong.expected);
  });

  it("grades a choice question", () => {
    const q = generatePassTargets(PLAYS.find((p) => p.beats.some((b) => b.actions.some((a) => a.type === "pass")))!, rng())[0];
    assert.equal(gradeAnswer(q, { kind: "choice", choiceId: q.answerId }).correct, true);
    const wrong = q.choices.find((c) => c.id !== q.answerId)!;
    assert.equal(gradeAnswer(q, { kind: "choice", choiceId: wrong.id }).correct, false);
  });

  it("a mismatched answer kind is wrong, not a crash", () => {
    assert.equal(gradeAnswer(spot, { kind: "choice", choiceId: "3" }).correct, false);
  });
});

describe("session shape", () => {
  const pool = generateForPlays(PLAYS);
  const session = buildSession(pool, { seed: 3 });

  it("is between one and twelve questions", () => {
    assert.ok(session.length > 0 && session.length <= SESSION_MAX);
  });

  it("never runs three of the same type together", () => {
    let run = 1;
    for (let i = 1; i < session.length; i++) {
      run = session[i].type === session[i - 1].type ? run + 1 : 1;
      assert.ok(run <= 2, `three ${session[i].type} questions in a row at ${i}`);
    }
  });

  it("ends on something winnable, not the hardest question", () => {
    const rank = (q: Question) => (isSpot(q) ? 4 : 2);
    const ranks = session.map(rank);
    const hardest = Math.max(...ranks);
    // Only meaningful when the session actually mixes difficulties.
    if (new Set(ranks).size > 1) {
      assert.ok(
        rank(session[session.length - 1]) < hardest,
        "a session should not end on its hardest question",
      );
    }
  });

  it("mixes question types rather than serving one kind", () => {
    assert.ok(
      new Set(session.map((q) => q.type)).size > 1,
      "a spot-only session cannot satisfy the no-run rule and is dull besides",
    );
  });

  it("spreads across plays rather than drilling one", () => {
    const plays = new Set(session.map((q) => q.playId));
    assert.ok(plays.size > 1, "session covered only one play");
  });

  it("contains no duplicates", () => {
    const ids = session.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("is deterministic for a seed", () => {
    assert.deepEqual(buildSession(pool, { seed: 9 }), buildSession(pool, { seed: 9 }));
  });

  it("handles an empty pool", () => {
    assert.deepEqual(buildSession([], { seed: 1 }), []);
  });

  it("every question in a session is answerable", () => {
    for (const q of session) {
      if (isChoice(q)) assert.ok(q.choices.length >= 2);
      if (isSpot(q)) assert.ok(q.tolerance > 0);
    }
  });
});
