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

## 2026-08-13 — Drags write to the play live; undo steps are debounced

`checkpoint()` in `src/lib/play/history.ts`, `mutateLive()` in `PlayBuilder`.

Drawing used to write nothing until pointer-up, so a stroke in progress was a preview
overlay and the play underneath was stale — the destination, the next beat's `startPos`,
and the validation banner all lagged behind what the coach was doing.

Every pointer move now writes the action through `upsertDrawnAction`, which rewrites one
action by id rather than appending per frame. Those frames go through `replacePresent`
(no undo step) and a `checkpoint` lands on a 400 ms debounce, so a normal stroke is one
Ctrl+Z while a slow deliberate one still leaves intermediate states.

The same treatment fixed token dragging, which was worse: it called `mutate` on every
pointer move, so dragging a player across the court pushed dozens of undo steps.

**Two types are held back, for data reasons rather than effort.** A screen needs the
player it is set for, and the coach picks that after the stroke; a pass needs a receiver,
which is unknown until the cursor finds one. Writing either early would put an action
into the play that `validatePlay` rejects, and flash errors at the coach mid-stroke.
Passes start writing as soon as a receiver is under the cursor.

Abandoned strokes are rolled back with a live edit, so they leave no undo step. If the
debounce fired mid-stroke one coarse step survives holding a partly-drawn action — a
state the coach did pass through, and a stroke short enough to be abandoned is normally
over inside 400 ms.

Rules out: pointer-up as the moment the play changes. The court is the document.

## 2026-08-13 — Deleting a pass gives possession back

`recomputeBeatBall()` in `src/lib/play/actionOps.ts`.

`removeAction` reset a player's position when their movement was deleted but never
touched `beat.ball`, so deleting a pass left the beat with a ball that arrived by no
visible means — rules 3 and 4 then failed on a play the coach thought they had just
cleaned up. Possession is now recomputed from `startBall` and the transfers that remain,
which also handles deleting one pass out of a chain.

Found while building live-draw rollback, which depends on removal being complete.

## 2026-08-13 — The builder draws destination routes, not ghost tokens

`unexplainedTravel()` in `src/lib/court/actionGeometry.ts`, rendered by
`DestinationRoutes`. `BeatGhostMarkers` is gone.

Faded dashed tokens at `beat.pos` said where a player finishes but not how they get
there, and for an idle player `pos` equals `startPos`, so the ghost sat under the live
token and read as a rendering artefact. For a player with a drawn action it duplicated
the arrow's endpoint.

The builder now draws what the animator draws: a route toward `beat.pos`, through the
same `pathToSvgD`. Players who already have a movement action are skipped, because
`ActionLayer` draws their route and a second line along it is just heavier.

What remains is travel with no action to explain it — which is precisely what validation
rule 9 objects to. Drawing it makes the problem visible instead of hiding it behind a
ghost that looked the same whether the play was valid or not.

Move mode keeps a grab ring at each destination, including players standing still, so
the drag affordance stays discoverable. The builder instruction text names the ring.

Note: `MASTER-BUILD-PLAN.md` line 173 ("selecting a beat shows the previous beat as
faded ghosts") is a different, still-unbuilt feature — beat-to-beat context, not
destination markers. This does not implement or contradict it.

Rules out: the builder and the animator depicting the same movement differently.

## 2026-08-13 — `npm run lint` passes; the playback hook stopped writing refs in render

`src/components/animator/usePlayPlayback.ts`.

Lint had been failing on `main` with three errors, all in the playback hook: two refs
written during render, and a `setState` inside an effect.

The ref writes were the real defect. React can discard a render and replay it, and a ref
written during the discarded pass keeps the wrong callback — the latest-callback refs now
update in an effect instead.

Elapsed time is now stored alongside the identity of the run it belongs to
(`play.id|from|to|speed`) and reset during render when that identity changes, rather than
by a `setState` in an effect that rendered one stale frame first.

`.eslintignore` was deleted: flat config ignores `_legacy/**` already, and the old file
only produced a deprecation warning.

Eight warnings remain, all outside the play engine (scripts, auth `.js`, the landing
page). `window.location.assign` in the login page is left alone deliberately — it dates
from the Vercel-preview auth redirect work and a router push is not obviously equivalent
there.

## 2026-08-13 — The dribble easing contradicts its own comment; left unchanged for now

`easeInOutDribble` in `src/lib/timing/easing.ts`.

Documented as "~70% of cut speed (stretched time)". It is measurably the opposite: it
leads `easeInOutCut` at every point, reaching twice the cut's progress at t=0.1.

Cause is `Math.pow(t, 0.85)`. An exponent below 1 *raises* t, compressing early time
rather than stretching it; a slowdown needs an exponent above 1. The lanes do not supply
the difference either — cut is 0.10–0.70 and dribble 0.25–0.85, both 0.60 wide.

Left unchanged. Changing a motion curve changes how all twelve seed plays animate, and
this session's brief was builder work, not retiming the engine. The current behaviour is
pinned by a test in `tests/play/sampling.test.ts` that says plainly it records a
discrepancy, so a future fix shows up as a deliberate diff rather than a surprise.

Carried to `PROPOSALS.md` for a decision: fix the curve, or fix the comment if a
front-loaded dribble is what the animation actually wants.

## 2026-08-13 — The builder's beat selection is clamped, not trusted

`PlayBuilder` derives `beatIndex` from `rawBeatIndex` every render.

Add a beat, then undo. The play returns to its previous length while the selection still
points at the beat that no longer exists, `play.beats[2]` is `undefined`, and
`if (!beat) return null` blanked the entire builder — beat strip included, so there was
no control left to select a different beat with. Unrecoverable without a reload.

The index is now clamped on read, and written back during render rather than in an
effect (the same pattern `usePlayPlayback` uses, and it keeps a later add-beat from
jumping to the stale selection).

The general lesson: undo restores play *content* but nothing reconciles UI state that
points into it. Any future selection — a chosen action, a chosen player, a scroll
position — needs the same treatment.

## 2026-08-13 — Strokes end on pointerup, never on leaving the court

`EditableCourt` no longer binds `onPointerLeave`.

Both gestures call `setPointerCapture` on pointerdown, which guarantees `pointerup` is
delivered even when the pointer is released outside the SVG. Treating "left the court"
as "finished" therefore added nothing and cost something real: drawing through the
sideline and back ended the stroke at the sideline.

`onPointerCancel` now abandons the stroke instead — that is the event that actually
means the gesture was taken away (touch scroll, system gesture, lost device).

Not verified in a browser this session. The reasoning is from the pointer-capture spec,
so it wants a manual check on touch.

## 2026-08-13 — Accessibility: label and announce, but drawing stays pointer-only

Scope call. A keyboard-drawable court is a feature nobody asked for; labelling and
announcements are a defect. This session did the second and wrote the first into
`PROPOSALS.md`.

Done:

- `ValidationBanner` is now **one** always-mounted live region. It was three separate
  elements, so the region appeared at the same moment as its content — which is the
  case screen readers commonly do not announce. Errors are `role="alert"` /
  `assertive`; ready and warnings are `role="status"` / `polite`.
- Palette tools are toggle buttons (`aria-pressed`) in a labelled group.
- Disabled tools use `aria-disabled` rather than `disabled`. A `disabled` button is
  skipped entirely, which hid the tooltip explaining *why* the tool is off — and that
  explanation is the whole teaching mechanism behind the ball gate.
- Player tokens are focusable with `role="button"`, an `aria-label` naming the player,
  whether they hold the ball and whether they are selected, and Enter/Space selects.
- Undo/redo get real `aria-label`s and `aria-keyshortcuts`; the arrow glyphs are
  `aria-hidden` so they stop being the accessible name.
- Visible focus rings on the palette, undo/redo and the tokens.

Not done, deliberately: drawing an action with the keyboard. Selection is reachable;
the stroke is not.

## 2026-08-13 — Court line coordinates are rounded before they reach the DOM

`collegeThreePointD` in `src/lib/court/courtLines.ts`.

Running the dev server surfaced a hydration mismatch on the three-point arc, present
since the Phase 2 court landed. The path emitted 65 points of raw float, ~17 significant
digits each, straight from `Math.cos`/`Math.sin` — which the spec does not require to be
correctly rounded, so the server render and the browser could disagree in the last bit.
React reports that and explicitly does not patch it up.

Coordinates are now rounded to three decimals, far below one screen pixel on a 500-unit
court, which also removes about a kilobyte of noise from the markup.

Unrelated to the arrow smoothing landed the same day: this path builds its own string
and never goes through `pathToSvgD`.

Rules out: emitting computed geometry at full float precision anywhere it is server
rendered. If a future court feature computes coordinates, round them the same way.

## 2026-08-14 — A player's movements are serialised and chained

`serialisePerPlayer()` in `src/lib/timing/sequence.ts`, `chainPlayerMovements()` in
`src/lib/play/actionOps.ts`.

Found by Samuel drawing two cuts for one player. Two things were wrong at once:

- Both cuts took the identical default lane (0.10–0.70) and **animated on top of each
  other**. Screen-then-roll only came out ordered because those two lanes differ and the
  dependency rules stagger them; nothing generalised that to a player's own movements.
- Every stroke was stored starting from `startPos`, so the player ran the first route
  and then snapped back to their original spot to begin the second. The end of the beat
  was whichever action was drawn last, orphaning the other endpoint.

Now: a player's movements never overlap in time — each is pushed to start no earlier
than the previous one ends, keeping its duration, with `normalizeEndAtOne` rescaling
afterwards. And each movement's first point is anchored to where the previous one left
the player, with `beat.pos` taken from the last.

Chaining lives in the ops layer, not the builder, so it holds for the importer and for
deletions too — removing the first of two movements re-anchors the second to `startPos`
rather than leaving it starting in mid-air. The builder anchors new strokes as well, but
only so the live preview matches what will be stored.

Only the first point of a route is ever moved. The shape the coach drew and the
destination they chose are theirs.

Safe for existing data: the seed has zero beats where one player has two movements —
verified before the change, and `npm run test:seed` still passes 12/12.

Rules out: treating draw order as playback order without saying so. Two strokes mean
"this, then that".

## 2026-08-14 — A beat is a sequence of steps, and the coach groups them

`beatSteps` / `sequenceBySteps` in `src/lib/timing/sequence.ts`, `setActionStep` in
`src/lib/play/actionOps.ts`. Supersedes the concurrency rule in `MASTER-BUILD-PLAN.md`.

Samuel's call, and it overturns a spec rule that said the opposite: *"Independent
actions on opposite sides of the floor run concurrently … do not serialize everything."*

That rule optimised for realistic basketball. The product is for **memorising** a play,
and a player watching four things move at once cannot tell which one is theirs. Actions
now play one at a time by default, and the coach says when two happen together.

- `Action.step` — 1-based. Same step runs together; steps run in order, equal slices.
- Every drawn action gets its own step, so drawing is serial by default.
- The selected-action panel offers "same time as step N" and "give it its own step".
- Beat duration counts *steps*, not actions: two players cutting together is one thing
  to watch and should not cost the same as two things in turn.
- Deleting an action compacts the numbering, because a gap is a pause with nothing in it.

Actions with no step keep the old lane-and-dependency behaviour. That is what makes this
safe: the twelve seed plays carry no steps, so none of them re-time, and there is a test
asserting exactly that. Imported plays get steps when a human reviews them, not before.

The rule "the coach never sets timing" survives — grouping is order, not milliseconds.

Rules out: inferring simultaneity from geometry in coach-authored plays. If two things
happen together it is because someone said so.

## 2026-08-15 — Implausible ball movement is warned about, not rejected

`validateBallPlausibility()` in `src/lib/play/validation.ts`.

Samuel watched the seed plays animate in the quiz and said they looked glitchy —
cross-court passes, and the ball going back and forth between two players. Both were
real and both were in the imported data:

- `gswhat` has a pass spanning 482 units on a 500-wide court; `Openkickbacks` 477.
- `Kansas`, `Kickup` and `Relax` each bounce possession between the same two players
  three times.

Validation passed all twelve because rule 3 only asks that a possession change be
*explained* by a pass, and a wrong pass explains it exactly as well as a right one.
The likely cause is `derive.py` inventing a pass whenever the circled possession number
appears to change, so one misread frame produces a phantom pass and a flicker produces
a phantom pass back.

Two warnings added: a pass longer than 320 units, and a transfer that returns the ball
straight to whoever just gave it up. Warnings, not errors, because only someone looking
at the source page can tell a genuine give-and-go from a misread circle — and blocking
a play the coach cannot yet fix would be worse than flagging it.

27 warnings across 8 plays; Alabama, Arkansas-Rip, Horns and Idaho are clean.
`npm run test:seed` now prints them, which turns "the plays look glitchy" into the
review worklist Phase 5 needs.

Rules out: treating 12/12 valid as 12/12 correct. Validation proves a play is coherent,
not that it is the play on the page.

## 2026-08-14 — Phase 8 starts with two question types, not six

`src/lib/quiz/`, `src/components/quiz/`, `/player/quiz`.

The spec lists six question types. Built two — `pass-target` and `spot` — because both
read straight off data that already exists (`beat.ball`, `beat.startPos`) and neither
needs drawing input or heading comparison. That is the whole loop end to end at roughly
a fifth of Phase 8's surface, and the loop is what was worth proving first.

`draw`, `sequence`, `identify` and `next-action` are still to come.

Decisions inside it worth keeping:

- **Generation is seeded and deterministic.** A session can be regenerated exactly, so a
  test can assert which distractors were picked and a coach reporting "question 4 was
  wrong" can be shown that question.
- **Distractors are never random.** Pass options prefer players who receive a pass
  somewhere else in the play; an option that never catches anything can be ruled out
  without knowing the play, which teaches nothing.
- **A spot is skipped when another player stands inside the grading tolerance.** A tap
  landing on the wrong player but still grading correct teaches nothing either.
- **Session types are balanced before ordering, not after.** The seed is spot-heavy —
  five players per beat against a handful of passes — and once one type dominates, no
  ordering can satisfy "never three of a type in a row". The session is trimmed until
  the constraint is achievable rather than quietly broken.
- **The lead-in stops one beat short of the asked beat.** Running through it would play
  the answer before the question.

Not built yet: persistence. Attempts and mastery tables exist and are unused; the runner
scores in memory and says so on screen. Wiring that up needs a real player profile, so
it waits for teams rather than inventing one.

## 2026-08-14 — Saving says so loudly

A successful save rendered a small green span beside the button, with no live region.
Samuel saved a play and reported seeing nothing; the server had returned 201.

It is now a full panel with `role="status"`, matching the weight of the error panel, and
it distinguishes a first save from a new version — a version bump means players who
already learned the play will be asked to re-learn it, which is a consequence worth
stating rather than implying with a number.
