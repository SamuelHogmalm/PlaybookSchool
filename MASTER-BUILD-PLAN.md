# Playbook School — Master Build Plan

This replaces all previous specs. Where an older document conflicts with this one,
this one wins.

Give Cursor **one phase at a time**. Do not paste the whole file. Each phase ends
with a checkpoint that must pass before the next begins.

---

## Scope

This tool helps players **memorize a playbook**. Where do I line up, where do I go,
who gets the ball, what's this play called.

It does **not** teach reads, decisions, or basketball IQ. No "what's your first
look," no defensive counters, no game situations. That is coaching, and it is out of
scope permanently. Every question in this product has one objectively correct answer
that can be checked against the play data.

This constraint is what makes the product buildable. Protect it.

## Architecture

**One play format. Three producers. One animator. Three consumers.**

```
PRODUCERS                    FORMAT              CONSUMERS
  play builder    ─┐                        ┌─  builder preview
  PDF importer    ─┼──▶   Play object   ──▶─┼─  review flow
  seed data       ─┘                        └─  quiz engine
```

The importer's job is to produce exactly what the builder produces. The quiz engine
never knows where a play came from. If these ever diverge, the project is broken.

**The animator is the foundation.** Quizzes are animations plus a question. Build it
right before building anything on top of it.

## Data model

```ts
type Vec = { x: number; y: number };
type PlayerId = "1" | "2" | "3" | "4" | "5";

type Action = {
  id: string;
  type: "cut" | "dribble" | "pass" | "screen" | "handoff";
  by: PlayerId;
  for?: PlayerId;          // screen: who it's for. pass/handoff: receiver.
  path?: Vec[];            // optional drawn route; straight line if absent
  startAt?: number;        // 0-1 within the beat, computed not authored
  endAt?: number;
};

type Beat = {
  id: string;
  pos: Record<PlayerId, Vec>;   // positions at END of beat
  ball: PlayerId;               // possession at END of beat
  actions: Action[];
  durationMs?: number;          // computed from action count
};

type Play = {
  id: string;
  teamId: string;
  name: string;
  category: string;
  folderId?: string;
  beats: Beat[];
  version: number;              // bumped on edit; see Phase 8
  valid: boolean;               // see validation rules
  validationErrors: string[];
  createdAt: string;
  updatedAt: string;
};
```

Court coordinates: 500 x 470, baseline at top (y=0), half court at bottom (y=470),
hoop center (250, 52), lane x=170 to x=330, three-point arc radius 197.5 from hoop.

## Validation — the non-negotiable rules

A play is `valid: false` unless every one of these passes. **Never save, animate,
assign, or quiz on an invalid play.** Show the coach exactly what's wrong.

1. Every beat has all five players with coordinates on or near the court.
2. Every beat has exactly one ball holder.
3. **Ball continuity.** If beat N's holder differs from beat N+1's holder, beat N+1
   must contain a `pass` or `handoff` from the old holder to the new one. No
   exceptions. This is the rule that stops the ball teleporting.
4. If a beat contains a pass from A to B, beat's `ball` must be B.
5. Only the current ball holder may `pass`, `dribble`, or `handoff`.
6. Nobody passes to themselves or screens for themselves.
7. A screener does not travel more than 60 units in the beat their screen is used.
8. No player moves more than 350 units in a single beat. That's a teleport.
9. Players with no action do not change position.
10. A play has at least two beats.
11. **Derived-action ratio.** Actions marked `derived: true` are pipeline guesses,
    not read from the page. They should stay well under a third of total actions
    across a playbook. Above that ratio, the import is guessing more than reading —
    tighten the interpret prompt or review derivation rules.
12. **Pass and cut on same beat (warning).** A player may not have both a
    pass/handoff and a cut on the same beat. Flag for review — the cut may be a
    misread dribble or belong to the next beat. Does not block save while seed
    data is being re-imported.

Write these as a pure function `validatePlay(play) -> {valid, errors[], warnings[]}` with unit
tests. It runs in the builder on every edit, in the importer before save, and in the
quiz generator before a play is used.

---

# Phase 1 — Foundation

Keep the existing home page. Do not redesign it.

**Tasks**
- Establish the repo structure below and move existing code into it.
- Create the `Play` types and `validatePlay()` with unit tests.
- Confirm Supabase and Vercel still deploy.

```
src/
  lib/
    play/        types, validation, geometry helpers
    timing/      sequencing engine (Phase 3)
    quiz/        generation (Phase 8)
  components/
    court/       CourtRenderer, PlayerToken, ActionLayer  ← ONE renderer, used everywhere
    animator/    PlayAnimator                            ← ONE animator
    builder/
  app/
    (marketing)/           home
    coach/                 playbook, builder, import, roster, assignments, progress
    player/                today, plays, practice, me
services/
  importer/                PDF parsing + AI analysis
docs/
  skills/                  AI context files loaded at runtime
```

**Checkpoint:** `validatePlay()` passes tests on hand-written valid and invalid
plays. Home page deploys.

---

# Phase 2 — Play builder

The core tool. A coach who has never seen it should build a correct play without
instruction.

**Court canvas**
- SVG, not canvas. Half court, correct proportions.
- Five draggable tokens, snap to a 10-unit grid.
- Preset alignments as one click: Horns, 4-out 1-in, 5-out, Box, Stack, 1-4 High.

**Drawing actions**
- Tool palette: Cut, Dribble, Pass, Screen, Handoff.
- Draw by dragging from a player. Free-draw the path; it's stored in `path`.
- Live rendering as they draw — the line follows the cursor.
- Standard notation: cut solid+arrow, pass dashed+arrow, dribble squiggle+arrow,
  screen line+perpendicular bar.
- **Tools disable themselves when illegal.** Dribble, Pass, and Handoff are greyed
  out unless the selected player has the ball. This teaches the rules by making
  mistakes impossible rather than by showing errors.
- Drawing a pass automatically sets `ball` for the beat. The coach never sets
  possession by hand — that's rule 3 and 4 enforced by construction.

**Beats**
- Horizontal strip of beat thumbnails. Add, duplicate, reorder, delete.
- Adding a beat clones the previous positions; the coach moves who moves.
- Selecting a beat shows the previous beat as faded ghosts.

**Always visible**
- Live validation banner. Green "Ready" or a specific error: "Beat 3: ball goes from
  1 to 3 with no pass. Draw the pass or change possession."
- Preview button that animates from beat 1.

**Checkpoint:** Build Horns from scratch in under three minutes, with a ball screen,
a roll, a pin down, and a pass. It validates and animates correctly.

---

# Phase 3 — Timing engine and animator

This is the make-or-break phase. Everything downstream is built on it.

## Sequencing

The coach never sets timing. It's derived from dependencies.

**Default lanes** (fractions of beat duration):

| Action | Start | End |
|---|---|---|
| screen — screener travels, then holds still | 0.00 | 0.30 |
| cut, not off a screen | 0.10 | 0.70 |
| cut, off a screen | screen end | +0.45 |
| dribble | 0.25 | 0.85 |
| screener's roll or pop | 0.45 | 1.00 |
| handoff | 0.40 | 0.60 |
| pass — ball in flight | 0.75 | 0.90 |

**Dependency rules**, applied by pushing start times later, then normalizing so the
last action ends at 1.0:

1. A screener arrives and is set before the player they screen for starts moving.
2. A screener's roll or pop begins after the cutter has cleared.
3. A pass releases only after the **passer's own** movement (cut, dribble, or screen travel) is complete — you throw from where you stand.
4. A pass releases only after the receiver's movement is at least 60% complete.
5. A receiver must catch before they can pass, dribble, or hand off.

**Known limitation:** Rules 3–4 assume curl-and-pass timing (receiver gets open, then
catches). Give-and-go (catch, then cut) cannot be distinguished from coordinates
alone — 21 seed beats have a receiver cut timed before the pass under the default
lanes. Do not guess; fixing this requires frame-splitting or coach review.

Independent actions on opposite sides of the floor run **concurrently**. Weakside
action happening at the same time as ball-side action is normal basketball — do not
serialize everything.

**Beat duration:** 2250ms base, +500ms per action beyond the first, capped at 4400ms.
(Raised 25% from 1800 / 400 / 3500 on 2026-08-14 — plays read as hurried, and the eye
has to be able to follow each player. The 1200ms hold is unchanged.)

A dribble is paced exactly like a cut. A player moves at one speed whether or not they
have the ball; overall pace is set by beat duration.

## Playback

Every beat is two phases:

- **MOVE** — players travel to their beat-N positions
- **HOLD** — 1200ms, everything frozen, beat caption shown

The hold is mandatory. Without it no beat is readable.

**Step mode** — MOVE, then wait for the user to advance. This is the default in
quizzes. Auto-advance is for coach preview only.

## The ball

Track the ball as its own `{x, y}` entity computed explicitly every frame. Never as
"attached to player X" resolved at render time — that's what causes it to jump.

- Dribble: ball attached to the handler, offset to their outside hand, with a bounce.
- Pass: ball stays with the passer through 75% of the beat, then travels **linear and
  fast — roughly 3x player speed** — to the receiver. Never eased. This one detail
  does more for realism than anything else.
- Possession changes at one discrete moment, not gradually.

## Easing

| | |
|---|---|
| cut | ease-in-out, sharpest at the start |
| dribble | ease-in-out, ~70% of cut speed |
| screener | ease-out to the spot, then **dead stop** |
| roll / dive | ease-in, accelerating to the rim |
| ball on a pass | linear, fast |

Players with no action do not move. No drift.

## Purity — this is where the old build broke

One function:

```ts
positionsAt(play, beatIndex, t, phase) -> { players, ball, possession }
```

Pure. No refs, no mutation, no component state. Every consumer calls it — animator,
thumbnails, quiz. **If positions are computed in two places, one is wrong.**

`PlayAnimator` props only:

```tsx
<PlayAnimator play from to playing stepMode hidePlayer speed onBeatEnd onComplete />
```

It owns no quiz state. One rAF loop, started and cancelled in the same effect.
`key={play.id}` forces a clean reset.

**Guards:** missing position carries forward the last known value, never NaN. Out of
range beat indexes render nothing rather than crashing.

**Checkpoint:** `/dev/animator` with a play picker, speed and step controls, live
beat/phase/t readout, and a table showing each player's derived action per beat. The
ball must visibly travel between players on a pass, and a screener must visibly stop
and hold. Confirm by eye before proceeding.

---

# Phase 4 — PDF import

**Stage 1, deterministic and free.** `services/importer/parser.py`, already written
and tested: extracts court boundaries, all five player positions per frame, ball
possession from the circled number, play names, and frame ordering. Verified at 36/36
on a real FastDraw export. Do not rewrite it.

**Stage 2, AI.** One call per frame with the crop image plus the known coordinates.
Load `docs/skills/play-interpretation.md` at runtime as context. The AI reads only
arrows: type, actor, target. It never estimates positions.

Then run `validatePlay()`. Any play failing validation goes to review flagged, never
silently accepted.

**Cost guardrails:** log tokens per import, refuse anything projected over $2, and
offer a "positions only" path that skips stage 2 entirely and is free.

Run stage 2 as a background job with status polling. It will exceed a serverless
timeout.

**Checkpoint:** Import the real playbook. Report per play: actions found, validation
result, count flagged uncertain.

---

# Phase 5 — Review

The coach confirms the import. This is the step that makes the whole feature
trustworthy, so it has to be fast.

- Split view: original PDF crop left, our rendered version right, beat by beat.
- Plays sort by confidence — worst first.
- Actions flagged `uncertain` are highlighted on the court, not buried in a list.
- Edit inline using the Phase 2 builder tools. Same components, no second editor.
- Validation errors block confirmation and say exactly what's wrong.
- "Looks right" accepts a whole play at once. Most will be close and field-by-field
  confirmation will make coaches quit.
- Progress: "Play 4 of 12."

**Checkpoint:** Review and confirm the full 12-play book in under fifteen minutes.

---

# Phase 6 — Teams and roster

- Coach creates a team, gets a 6-character join code.
- Players join by code, pick jersey number and position.
- Roster table: number, name, position, last active, plays mastered, streak.
- Coach can deactivate a player. Never delete — the history stays.

Supabase RLS: a user reads only their own team's data.

**Checkpoint:** Two accounts on two devices, one coach one player, joined and
visible.

---

# Phase 7 — Assignments

Composer, under thirty seconds to send:

- **What:** specific plays, a folder, or "everything due for review."
- **Who:** whole team, a position group, or named players.
- **When:** optional due date.
- Live summary sentence: "14 players will drill 4 plays, due Friday."

Coach sees completion per assignment. Player sees it on `/player/today`.

---

# Phase 8 — Quiz engine

## The one question shape

Every question is the same four phases:

1. **LEAD-IN** — animate beats 0 → `askAtBeat`. How you got here.
2. **ASK** — frozen at `askAtBeat`. The question appears.
3. **REVEAL** — animate `askAtBeat` → `revealToBeat` with the correct answer drawn.
   **Always runs, right or wrong.**
4. **RESULT** — frozen, feedback, Next.

The reveal is non-negotiable. Players should see the play run as many times as
possible — repetition is the product, and a correct answer earns the rep too.

"Watch again" replays the lead-in without penalty, unlimited, without clearing an
in-progress answer.

## Question types

All memorization. No reads.

| Type | What happens |
|---|---|
| **spot** | Still alignment with the subject's token removed. Tap where you belong. Use `askAtBeat: 0` for the starting-lineup version. |
| **draw** | Play runs to `askAtBeat`, subject's token hidden. Draw your cut, screen, or pass. |
| **identify** | Full play animates with the name hidden. Which play is this? |
| **next-action** | Play runs to `askAtBeat`. What happens next? Multiple choice. |
| **pass-target** | Play runs to a pass moment. Who gets the ball? |
| **sequence** | Put three beats of a play in order. |

Grading: spot within 70 units. Draw — endpoint within 70 units and heading within 75
degrees. Loose on purpose; we're checking they know where to go, not tracing.

## Distractors

Never random. Draw from: another player's actual move in that beat, the subject's
own move from a different beat, or the same action with one attribute flipped
(left/right side, over/under a screen). All options within 40% of median length,
same grammatical form.

## Question generation

Pure data, generated before the session. No animation logic in the generator, no API
calls during a session. Emits `Question` objects; the runner renders them. Skip any
play where `valid` is false.

## Weakness weighting

Track per player, per play, in Postgres — not localStorage, because the coach's
analytics read from it:

```
mastery (user_id, play_id, ease, interval_days, due_at, streak, lapses)
attempts (user_id, play_id, question_type, correct, answered_at)
```

SM-2 style. A miss shortens the interval and requeues that question later in the same
session. Plays with the earliest `due_at` appear most often.

## Session shape

8-12 questions, 3-5 minutes, visible progress. Never more than two of the same type
consecutively. Open easy, hardest in the middle, end on a win. Score only at the end.
If nothing is assigned, open the review queue — never a dead end.

**Play versioning:** when a coach edits a play, bump `version`. Players who mastered
the old version get the changed beats requeued and a note: "Coach updated Alabama."
Nobody else does this and it matters for a memorization product.

---

# Phase 9 — Progress

**Coach:** team readiness as one number with an honest definition, most-forgotten
plays ranked, readiness by position group, study time per player, quiz accuracy over
time.

**Player:** mastery per play, weakest plays, streak. Framed as progress — a play
you're bad at is "still learning," never "failed."

---

# Extras worth building

Ordered by value.

1. **Print play cards.** PDF export of a play as a practice card. Coaches hand these
   out, and without it you are not a FastDraw replacement.
2. **Play variations.** Duplicate a play and edit it — "Alabama" and "Alabama Rip."
   Real playbooks are full of these. Link them so a player who knows one gets a
   heads-up on the difference.
3. **Position filter.** On any play, a player sees only their own job highlighted.
4. **Folders and tags.** Offense, BLOB, SLOB, Press Break, Zone.
5. **Pre-game readiness.** One screen before a game: who knows the game plan, who
   doesn't.
6. **Whole-playbook view.** Every play as a thumbnail grid, printable as one sheet.

---

## Rules for the whole build

- One court renderer. One animator. One `positionsAt()`. One validation function.
- No AI calls during a quiz session, ever.
- Never save or quiz on an invalid play.
- All progress data in Postgres. localStorage only for logged-out demo.
- AI context files live in `docs/skills/` and are loaded at runtime, never pasted
  into code, so they can be tuned without a deploy.
- Stop at every checkpoint and show me before moving on.
