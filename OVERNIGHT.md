# Session log — 13–17 August 2026

30 commits, `9f3fbd9..HEAD`, 87 files, +8754 / −1932. All pushed to `origin/main`.

**Verified at the end:**

| Check | Start | Now |
|---|---|---|
| `npm test` | 70 pass | **244 pass**, 0 fail |
| `npm run build` | clean | clean |
| `npm run lint` | **3 errors**, 17 warnings | **0 errors**, 7 warnings |
| `npm run test:seed` | not run | 12/12 valid, 8 warnings |

The 7 remaining lint warnings are all outside the play engine. `DECISIONS.md` has 31
entries.

---

## What exists now

**Coach:** `/plays/new` builds a play from scratch; `/coach/review` walks the imported
book worst-first with the source diagram beside our render, edits inline with the
builder's own tools, and saves to Postgres on confirm.

**Player:** `/player/quiz` runs a session of up to 12 questions across four types, with
the four-phase lead-in → ask → reveal → result loop.

**Dev:** `/dev/animator`, `/dev/court`, `/dev/repairs`.

Phases 1–5 are in. Phase 8 is four question types of six, without persistence.

---

## The three things that mattered

### The importer could not draw a bend

Every one of the 82 movement actions in the book was a straight line. The interpret
skill's output schema had no field for where an arrow *turns*, so `derive.py` drew
start-to-end and the shape was lost — and the first leg of a bent cut got read as a pass
to whoever the player was moving toward, which is where the phantom pass-backs came from.
The flattened cuts and the impossible ping-pong passes were one defect.

Fixed by adding `via` (the corners of a bent arrow) and re-interpreting on Gemini.
Derived actions 21 → 6, warnings 27 → 20, bent routes 0 → 14, still 12/12 valid.

### A passer was cutting before they let go of the ball

Dependency rule 3 made a pass wait for *any* movement by the passer, so pass-then-cut
animated backwards. The notation settles it: a player travelling with the ball is drawn
as a dribble, so a cut by the passer can only be the move after the release.

That also withdrew rule 12, which had been asking coaches to resolve a question the
notation already answers — 25 of 36 review flags, none of them real.

### Undo could destroy the builder

Add a beat, press Ctrl+Z, and `beatIndex` pointed past the end of the play: the whole
builder unmounted, including the beat strip needed to recover. Unrecoverable without a
reload.

---

## Everything else, briefly

**Builder.** Arrow smoothing (RDP + Catmull-Rom through one renderer, so drawn and played
routes are the same curve). Live drawing — the play updates as you draw, with undo steps
coalesced on a 400 ms debounce. Token drags were pushing dozens of undo steps each.
Destination ghosts replaced by routes. Steps: a beat plays one thing at a time and the
coach groups actions that happen together.

**Timing.** Movement 25% slower; a dribble paced exactly like a cut. A player's own
movements never overlap and chain end-to-start.

**Quiz.** Engine, runner, and four question types. Questions are refused on anything
derived, unreviewed, or flagged implausible — an answer has to be both true and
observable.

**Review.** Confidence ordering worst-first, crop against render, flags highlighted on
the court, confirm-saves-to-Postgres, inline editing via the builder's own hook.

**Import.** Provider seam; Gemini support; per-frame retry so one dropped connection
stops losing a 36-frame run.

**Bugs found and fixed.** Deleting a pass left possession with the receiver. Strokes
ended at the sideline. Refs written during render in the playback hook. A three-point arc
hydration mismatch from emitting raw floats. Login redirected everyone to `/`, making a
successful login look like a failure.

---

## What's next

`PROPOSALS.md` has the full list. The three that matter:

1. **Stop the importer emitting a screen with no target.** It is why the 17 Aug re-import
   was rejected — one malformed action took the book from 12/12 to 11/12. Until it is
   fixed, every re-import is a coin flip on twelve plays.
2. **Quiz persistence.** `attempts` and `mastery` are empty. Without them there is no
   weakness weighting, and the quiz is a shuffle rather than a teacher.
3. **Component tests.** 244 tests and not one drives a component. Every UI bug this week
   was found by a human looking at the screen.

## Open questions for Samuel

- **Screens that end in a horizontal bar** — raised on 16 Aug and not acted on, because
  I could not tell whether it meant the bar marks travel-then-set as one action, or
  something about ordering against a pass.
- **Are the review flags useful?** 24 across twelve plays now. If they are crying wolf
  the thresholds should loosen.
- **Confirmed plays belong to `coach@test.playbookschool.dev`** — the seeded test account.
  Fine for now, worth knowing before real players see anything.
