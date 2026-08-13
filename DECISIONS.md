# Decisions

Significant choices, why they were made, and when. The point of this file is that
`git log` records *what* changed and this records *why* — including decisions taken
in conversations that leave no trace in the repo.

Add an entry when a choice closes off an alternative someone might reasonably
re-open later. Not every commit needs one. Newest last.

Format: date, decision, why, and what it rules out. Cite the commit where there is
one; say "no commit" where the decision was to *not* do something.

---

## 2026-08-08 — MASTER-BUILD-PLAN.md is the single spec authority

`ee9525a`

Earlier design notes (`docs/ARCHITECTURE.md`, `docs/how-to-break-down-a-play.md`,
`docs/basketball-diagram-knowledge.md`) had drifted apart and disagreed with each
other about the data model. Rather than reconcile four documents, one became
authoritative and the rest were deleted.

Rules out: treating any other doc, comment, or prior instruction as binding where it
conflicts. `CLAUDE.md` and `AGENTS.md` point at the plan; they do not extend it.

## 2026-08-11 — The previous build is quarantined in `_legacy/`, not deleted

`9318d80`

The v1 app had working answers to problems the rebuild has not reached yet (review
flow, quiz screens, import UI). Deleting it would lose that reference; keeping it in
`src/` would let it be imported by accident and quietly become load-bearing.

It sits outside `tsconfig`'s `include` and outside eslint. Read it, do not import it.

Rules out: incremental migration of the old code. The rebuild reimplements against
the spec rather than porting.

## 2026-08-11 — `positionsAt()` is the only place positions are computed

`d7e4f0c`

Pure function of `(play, beatIndex, t, phase)`. No refs, no component state, no
mutation. Builder preview, the animator, and eventually the quiz engine all call it.

The v1 build computed positions in the animator component and again in the review
screen, and they disagreed — a play looked correct in one and wrong in the other,
with no way to say which was authoritative.

Rules out: any consumer deriving positions itself, including "just for a preview".
Same rule for `validatePlay()` and `CourtRenderer`.

## 2026-08-12 — Keep the v1 interpretation seed; archive v2/v3, then delete them

`d12626a` (produced v2/v3), `3aee652` (deleted them)

The AI interpretation pass was re-run twice with a corrected skill file and the three
outputs compared play by play. v1 was kept: v2 and v3 changed a lot of actions
without a measured improvement in correctness, and a seed that is different but not
demonstrably better is worse than the one already validated 12/12.

v2/v3 were committed as reference JSON, then deleted the same night once the
comparison was done — they were experiment output, not app data, and leaving 7,600
lines of unused JSON in `src/data/` invites someone to import the wrong file.

`src/data/plays-interpreted.json` is the canonical seed. If the pipeline is re-run,
compare against it before replacing it.

Rules out: swapping the seed on the strength of a prompt change alone. Show the
comparison first.

## 2026-08-12 — Only one prompt change shipped: the pass-receiver constraint

`d12626a`

Of the changes tried against `docs/skills/play-interpretation.md`, only the
pass-receiver constraint had no measured side effects. The rest improved one class of
read and regressed another, which is the failure mode that makes prompt tuning
expensive to evaluate.

The skill file is loaded at runtime, so it can be tuned without a deploy — that makes
it cheap to change and therefore worth being strict about what counts as an
improvement.

Rules out: shipping prompt changes on the basis that the output "looks better".

## 2026-08-12 — Screens are fixed in review, not by tuning the prompt

`d12626a`

Screens are the hardest thing on the page for the model to read: the bar marking a
screen is small, often overlaps a token, and looks like the end of a cut. Attempts to
prompt around it traded screen accuracy against cut accuracy.

The decision is to accept the model's screen reads as imperfect and catch them in the
human review step (`/dev/repairs` compares the source crop against our render) rather
than keep spending prompt changes on it.

Rules out: further screen-specific prompt work without new evidence that it does not
regress cuts.

## 2026-08-12 — Derived actions are capped at roughly a third (spec rule 11)

`d12626a` added the rule to `MASTER-BUILD-PLAN.md`.

`derive.py` writes movement actions the AI missed and marks them `derived: true`.
That is a guess, not a read of the page. Some derivation is necessary; a lot of it
means the import is inventing a play rather than importing one.

The ceiling is a judgement call, not a measurement: well under a third of total
actions across a playbook. Above it, tighten the interpret prompt or the derivation
rules rather than raising the ceiling.

**Enforcement is weaker than the rule.** `validatePlay()` implements rules 1–10 and
12; it does **not** implement 11, because the ratio is a property of a whole playbook
and validation runs on a single play. It is enforced instead by a test canary in
`tests/play/validatePlay.test.ts`, as an absolute count (≤30) over the seed —
currently 21 of 123 actions, 17%.

Rules out: reading "rule 11" as something `validatePlay()` will catch. It will not.

## 2026-08-12 — Builder mutations go through `linkBeatPositions`, never hand-patching

`3aee652`

Drawing on a middle beat used to set `beat[N].pos` and `beat[N+1].startPos` directly
and leave `beat[N+1].pos` stale, so a player idle in the next beat snapped back.

The deeper reason not to hand-patch: patching `startPos` destroys the evidence of
whether a later player was *holding* (pos equals startPos, no action) or had been
*placed deliberately*. `linkBeatPositions` can tell those apart; a patch cannot.
`setPlayBeats` restores both chain invariants exactly once per mutation.

Rules out: any op writing a neighbouring beat's positions itself.

## 2026-08-12 — Undo/redo is a pure module behind a single `mutate()` path

`3aee652`

`src/lib/play/history.ts` is generic and pure. `PlayBuilder` holds one
`History<Play>`, and every edit goes through `mutate()`, so no code path can change
the play without producing a history step. 100 steps retained.

The save echo uses `replacePresent()` — writing the server's version number back is
not an edit and must not become an undo step.

Rules out: components calling `setPlayBeats` directly.

## 2026-08-12 — A player's movements all play, in order

`9f3fbd9`

`positionsAt` walked only a player's *first* movement, so a screener who screens then
rolls stayed planted at the screen. It now walks every movement in sequence, holding
at the end of the previous one in between.

No seed play exercises this today — the import pipeline does not emit multi-movement
players — but the builder can draw it, so it is covered by a synthetic fixture rather
than left to be discovered later.

## 2026-08-13 — This file exists

No commit before this one.

The v2/v3 experiment (above) was correct and deliberate, but the reasoning lived in a
chat log outside the repo. An audit of the commits could establish *what* happened
and not *why*, and the absence of a record read as something having gone wrong.

Rules out: leaving that kind of decision undocumented on the grounds that the people
involved remember it.

## 2026-08-13 — Paths are simplified when stored, smoothed when rendered

`simplifyPath` in `src/lib/play/drawing.ts`; `pathToSvgD` in `src/lib/court/paths.ts`.

Freehand input lands a point every 8 court units — jittery to look at, and more detail
than the motion engine needs. Paths are now reduced with Ramer–Douglas–Peucker to at
most 12 points in `addDrawnAction`, and rendered as a Catmull-Rom spline emitted as
cubic Béziers.

The split matters because the two halves have different consumers. The **stored**
polyline is what `positionsAt` samples for motion; the **rendered** curve is what the
coach sees. Simplifying on commit means the builder and the animator sample the same
reduced points. Smoothing inside `pathToSvgD` means they render identically, because
`ActionLayer`, `RouteLayer` and `DrawPreview` all call that one function — a drawn
route and a played route are the same curve, not two that resemble each other.

RDP was chosen over a resample because it can only *drop* points, never invent them,
so endpoints survive untouched. Catmull-Rom was chosen over an approximating spline
for the same reason: it interpolates its control points, so the arrow still starts on
the player it belongs to.

Paths already within budget are left alone. Imported and AI-read paths are two or three
points, and a builder concern should not reshape them.

**Known limit:** motion follows the chords between retained points, so a token cuts
fractionally inside its own drawn curve. Deviation is bounded by the RDP epsilon — a
few court units on a hand-drawn arc. Changing `positionsAt` to sample the spline would
close the gap, but it is the timing singleton and the gap is not visible at playback
size. Revisit if it ever is.

Rules out: smoothing into stored data. What is saved stays a polyline the motion engine
can sample, and hit testing stays on that polyline too.
