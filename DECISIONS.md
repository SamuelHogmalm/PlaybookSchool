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

## 2026-08-18 — A step lasts as long as the move really takes

`stepDurationsMs()` in `src/lib/timing/sequence.ts`.

Samuel: "on that court pieces fly everywhere, it should have the same tempo as people
running the play in real life."

The cause was equal slices. Every step got the same share of the beat regardless of
distance, so a 300-unit cut and a 30-unit shuffle took the same time — which means the
long one had to be played several times faster to fit. No single speed setting could fix
that, because the problem was the *spread*, not the average.

A step now lasts its longest journey divided by a real speed: **85 units per second**,
about 8–9 feet per second on a court where 10 units is a foot. That is a purposeful
basketball move — not a jog, not a sprint. Players sharing a step move at once, so the
step ends when the last of them arrives. A step that only moves the ball is quick,
because nobody is running.

Beat duration is the sum of its steps, and the slices are proportional rather than equal.
Floors and ceilings keep it sane: 800ms minimum so a short move can still be read, 3.2s
maximum so nothing drags.

Measured on a four-move sequence: 8.4, 9.8, 8.1 and 8.5 feet per second, and 8.3 seconds
of movement for the set. Tested by asserting the fastest and slowest moves in a beat stay
within 1.6× of each other — the spread is what the eye notices.

Imported plays are untouched. Lane-timed actions overlap, so their durations do not add
up, and the count-based estimate stays until a coach breaks the play into steps.

An import cycle came out of this and was broken rather than tolerated: `beatDuration`
needed step durations and `sequence` needed them too, so they live in `sequence` and
`beatDuration` reads from it.

Rules out: one duration for every step. How long a move takes is a property of the move.

## 2026-08-18 — Coaches draw a play; the app decides where the beats go

`splitBeatAtStep` / `mergeBeatWithPrevious` in `src/lib/play/splitBeats.ts`, `MoveList`,
and a draw/beats mode in `PlayBuilder`.

Samuel's proposal, and it corrects a mistake in the builder's shape. Coaches draw a play
in one pass, and how many moves fit on a page is their own habit — some put a whole
possession on one diagram, some use six. Making them add a beat, switch to it, draw, add
another was imposing our storage on their work.

**Beats are a quizzing concern.** Where a play can pause and be asked about is a question
for the app, not the coach, and it should not be asked while someone is drawing.

So: *draw* mode is continuous — every stroke appends to the sequence, with a move list
showing the order, reordering, grouping into simultaneous moves, and a break point
between any two. *Edit beat by beat* keeps the existing per-beat tools untouched.

Both modes, not one, on Samuel's call. Review needs per-beat editing when fixing a single
frame against a PDF page, and his own reason for wanting continuous drawing — being able
to redraw part of a play quickly during review — depends on that still existing.

What made it feasible: steps already meant "ordered moves". A beat boundary is just a
moment, and a moment is a set of positions computable from the moves either side of it.
`splitBeatAtStep` derives the seam rather than repairing it, so the halves join by
construction and a movement that now starts a beat is re-anchored to where its player
actually stands.

Split points are suggested where the ball changes hands: that is how coaches describe a
play's phases, and it is where a quizzable question lives.

Rules out: asking a coach to think in beats while they are thinking about basketball.

## 2026-08-18 — A handoff happens as the runner passes, not after they have gone

`timeHandoffs()` in `src/lib/timing/sequence.ts`.

Samuel watched a handoff play back and saw two players run past each other, separate, and
*then* the ball move — which reads as a late pass, not an exchange.

The steps feature caused it. Every drawn action gets its own step, so the handoff sat
after both movements had finished. Correct by the rule, wrong as basketball: a handoff is
the moment two players are together, and it cannot happen once they are apart.

Two changes:

- The suggestion now files the handoff in the **runner's step**, so the exchange is part
  of their run rather than a sequel to it.
- Within that step the handoff is pinned to the moment they are actually together. The
  runner's route is sampled for its closest approach to the handler, and the handoff gets
  a brief window there — 8% of the beat, an instant rather than a journey.

The general shape is worth keeping in mind: steps say *what order*, but some actions are
events inside another action rather than things that follow it. A handoff is the first;
there will be others.

Rules out: giving every action an equal slice regardless of what it is. A player running
takes time; a ball changing hands does not.

## 2026-08-18 — The builder offers a handoff instead of waiting to be asked

`handoffCandidates()` in `src/lib/play/handoff.ts`.

Samuel's observation: a player dribbles somewhere and stops, a team-mate cuts past them,
and that *is* a dribble handoff — but the coach has to remember to switch to the handoff
tool and draw a third thing on top of two they have already drawn.

So the builder watches for the shape. When the ball handler's finishing spot sits within
42 units of another player's route, it offers "Player 3 runs past 1 — hand it off?" and
one click writes the action.

Why a suggestion rather than doing it automatically: a cutter brushing past the handler
is not always an exchange, and inventing possession changes is exactly the failure that
made the imported playbook untrustworthy. The coach confirms; the tool only notices.

Nothing is offered once the ball has moved on — a handler who has already passed has
nothing to hand over — nor to a player who is already receiving it this beat.

The handoff action type, its notation and its timing lane all existed already. The only
thing missing was noticing.

Rules out: making the coach spot a pattern the data already describes.

## 2026-08-18 — No two tokens ever occupy the same spot

`stopAtPerimeter()` in `src/lib/play/geometry.ts`.

A screener drawn onto the player they are screening for landed exactly on top of them,
and two tokens in one place cannot be told apart or selected — the coach loses access to
both. It comes up constantly, because aiming at the player you are screening for is the
natural thing to draw.

A route now stops where it *entered* the other player's space, keeping the direction of
travel. Backing straight away from them instead would bend the route somewhere nobody
drew it. Applied wherever a destination is written: drawn movements, and dragging a
destination in move mode.

Running *past* someone is untouched — players do that. Only the endpoint has to be clear.

Two things this turned up:

- **Order matters between snapping and clamping.** `updateBeatPlayerPos` snapped to the
  grid *after* the perimeter clamp, which could shove the token back inside the gap it
  had just been moved out of. Snap first, clear second.
- The gap is two token radii — touching, not overlapping — so a screener still finishes
  visibly *at* the player they screen for, which is what the diagram means.

Rules out: writing a player's destination without checking who is already standing there.

## 2026-08-18 — The builder shows the end of the beat, not the start

`tokensAt` on `CourtRenderer`; `OriginMarkers` in `PlayerTokens.tsx`.

Reverses the position I took an hour earlier, on Samuel's argument, which was better
than mine.

I had refused to move the token when a cut is drawn, on the grounds that a token belongs
at the tail of its own arrow — that is what a printed diagram means and what the animator
shows on frame one. Samuel pointed out what that costs and what moving it buys:

- **The court becomes the next beat's opening.** `beat[N].pos` *is* `beat[N+1].startPos`,
  so stepping between beats no longer makes every token jump. What you left is what you
  arrive at.
- **Unexplained movement becomes visible.** A player standing somewhere new with no arrow
  into them is obviously wrong, where before it was a silent rule 9 violation — the exact
  defect that had Kentucky teleporting a player 386 units.

So the renderer takes `tokensAt`. The builder uses `"end"`; the beat strip, `/dev/court`
and anything showing a play as a diagram keep `"start"`. Faint origin markers show where
a moved player came from, so an arrow never appears to start from nowhere.

The animator is untouched — it reads `positionsAt`, not the renderer's opinion, so the
concern about the two disagreeing was never real.

Two things this dragged in: draw hit-targets follow the tokens rather than sitting at
`startPos`, and in move mode they are skipped entirely, because the drag handle is now in
the same place and a draw target stacked on it swallowed the pointer.

Rules out: assuming the editing view and the printed view want the same arrangement. One
is a document; the other is a workspace mid-edit.

## 2026-08-18 — A pass finds a player where they end up, not where they started

`targetPositions()` in `src/lib/play/drawing.ts`.

Samuel asked for this more than once before I understood it: give player 4 a cut, then
try to pass to 4 at the new spot, and the pass is silently dropped.

Every receiver lookup searched `beat.startPos`. Once 4 has a cut, 4 is no longer at the
place being aimed at, so `nearestPlayerAt` found nobody and the stroke was abandoned with
no explanation. The tool was refusing to read its own diagram.

Receivers are now looked up at their position *after the movements already drawn on this
beat* — which is what steps mean: the actions happen in order, so the court a later
action targets is the court those earlier actions produced.

The visual half mattered as much. The destination showed an unlabelled ring, so there was
nothing identifying who finishes there; a coach aims at the token they can see, which is
the player's *old* position. Destinations now carry the player's number, for every player
who moves — wider than the dashed routes, which deliberately skip players whose arrow
`ActionLayer` already draws, and those are exactly the ones you pass to.

What was *not* done: moving the token itself to the destination as the cut is drawn. The
token sits at the start of its own arrow, which is what a basketball diagram means, and
moving it would put the builder's court out of step with the animator's first frame.
Naming the destination solves the same problem without that.

Rules out: reading `beat.startPos` to decide what a coach is pointing at. Within a beat
the court moves, and the tool has to move with it.

## 2026-08-18 — The quiz and review read the team's playbook, not the seed file

`src/lib/play/loadPlays.ts`.

Both screens imported `plays-interpreted.json` at module scope. A coach could draw a
play, save it, watch the 201 come back, and the quiz would still be asking about the
import — with nothing on screen to explain why. Saving looked like it did nothing.

They now fetch `/api/plays` and fall back to the seed when a team has nothing saved, is
signed out, or the request fails. The fallback is a convenience, not a silent
substitution: the source comes back with the plays and both screens say which they are
showing.

Two things this exposed, fixed at the same time:

- **The builder had no name field.** Every play was "New Play", and `plays` has a unique
  index on `(team_id, lower(name))`, so a second save would collide. Naming a play is
  part of drawing it.
- **Review assumed a source crop existed.** A hand-drawn play has none, and a broken
  image icon reads as a bug. It now says there is nothing to compare against.

Prompted by Samuel asking whether to draw a small clean playbook so quiz work stops
being confounded by import defects. That is the right call, and this is its prerequisite
— otherwise the drawing lands in Postgres and nothing reads it.

Rules out: a screen reading the seed file directly. The seed is a fallback and a test
corpus, not the app's source of truth.

## 2026-08-18 — Why plays jumped: a validation hole and an unchained import

`actionMovers` in `src/lib/play/validation.ts`, `playerPosAtT` in `positionsAt.ts`.

Samuel asked the right question — is the jumping the uploaded playbook or the system? It
was one of each, and measuring separated them. Ten of twelve plays already animated
smoothly, with a worst single-frame step under 12 units. Two did not.

**Kentucky beat 1 — data, hidden by a validation hole.** Player 1 travels 386 units with
no action to explain it, so they stand still through MOVE and snap to their destination
on HOLD. Rule 9 should have caught it, but `actionMovers` counted *any* action as
explaining travel — and player 1 throws a pass. A pass does not move you. Only cuts,
dribbles and screens count now.

That makes Kentucky invalid, which is correct and is the point: a play with an
unexplained teleport must not be quizzed on. It goes to the front of the review queue
for the missing action to be drawn. The regression test names it rather than asserting a
count, so a *second* broken play still fails and fixing Kentucky also fails — which is
the prompt to delete the line.

**Alabama beat 3 — data, exposed by an engine gap.** The importer emitted the same cut
twice, once flattened and once bent: `a1` (243,264)→(167,98) and `a6` the same route
with a corner. Sequenced one after the other, player 5 walked to the finish, snapped back
to the start, and walked it again — a 182-unit jump.

The builder cannot produce that, because `chainPlayerMovements` anchors each movement
where the previous one ended. Imported plays never go through those ops. Rather than
chain on import, `playerPosAtT` now starts every movement from where the player actually
is, whatever the stored path claims. Playback is continuous by construction, for any
producer. Alabama's worst step fell from 182.5 to 14.0 units.

Rules out: trusting a stored path's first point. The player's position is the truth; the
path describes where they go from there.

## 2026-08-18 — Possession is one function, and the draw gate reads it live

`src/lib/play/possession.ts`.

Samuel hit this editing Openkickbacks: he deleted a bogus pass, drew the correct one from
1 to 4, and then **could not make 4 dribble.** The tool insisted 4 did not have the ball
while an arrow saying otherwise was on the screen.

`canDrawAction` gated on `beat.startBall` — possession at the *start* of the beat.
Drawing a pass sets `beat.ball`, not `startBall`, so the gate never saw it.

Fixed by gating on possession as it stands after the actions already drawn. The tooltip
now distinguishes the two cases, because "only player 1 has the ball" is bewildering when
you have just watched 1 pass it away.

The same logic existed in **three** places — `validation.ts`, `actionOps.ts`, and now the
gate would have been a fourth. They had drifted: validation also treated a dribble as
claiming possession, which is harmless there but wrong for `removeAction`, where deleting
a pass would have left the ball with a receiver who merely dribbled afterwards. All three
now call `holderAfterActions`.

This is the failure the architecture rules already name — "if positions or validity are
computed in two places, one of them is wrong". Possession belongs on that list.

Rules out: reading `beat.startBall` to decide what a coach may draw. The beat is being
edited; the answer has to be current.

## 2026-08-17 — A malformed screen is repaired, never emitted

`repair_targetless_screens()` in `services/importer/derive.py`.

The rejected candidate run failed on one action: a screen in `Horns` beat 3 with nobody
to screen for. `validatePlay` rejects that outright, so a single malformed action took
the whole book from 12/12 to 11/12 and cost the entire re-import.

The importer now repairs it rather than emitting it. A screen is set in the path of a
teammate who cuts off it, so the screener finishes near whoever uses it:

1. **Infer** the nearest teammate who actually moves during the beat, within 120 units.
   Flagged for review, because it is a guess.
2. If nobody plausible moved, the mark was more likely a **cut** — a screen nobody uses
   is not a screen.
3. If the player did not travel either, **drop** it. Better a missing action than an
   invented one.

Only teammates who move are candidates. A stationary player standing next to the screen
did not cut off it, and picking them by proximity alone would look right and be wrong.

Tested with stdlib `unittest` in `services/importer/test_derive.py` — the importer had no
test setup and did not need a dependency to get one. Nine cases, including that a
well-formed screen is left untouched.

Rules out: discovering a malformed action by spending a whole re-import. Anything the
pipeline can emit that `validatePlay` rejects is a pipeline bug, not a data problem.

## 2026-08-17 — A re-import was rejected; the withdrawn flags were cleared directly

`scripts/clear-withdrawn-flags.ts`.

With rule 12 withdrawn and `derive.py` no longer emitting it, the obvious move was to
re-import so the stale flags cleared. The comparison said no:

| | seed | candidate |
|---|---|---|
| **Plays valid** | **12** | **11** |
| Unsure (`needsReview`) | 35 | 21 |
| Review flags | 46 | 38 |
| Derived (invented) | 6 | 8 |
| Avg confidence | 0.85 | 0.79 |

`Horns` beat 3 came back with a screen and no player to screen for. "Never save, animate,
assign, or quiz on a play where `valid` is false" is not a metric to trade against, so
the candidate was rejected and deleted.

The lesson is about the method rather than the model: **re-interpretation re-rolls every
read in the book.** Running it to fix a bookkeeping problem risks twelve plays to correct
a flag, and this time it cost one. Gemini being effectively free makes a re-run cheap,
not safe.

So the flags were cleared where they lived. 25 of 36 `needsReview` flags carried the
withdrawn rule-12 reason; removing exactly those left the reads untouched:

- Review flags 46 → 24, unsure 35 → 11, average confidence 0.85 → 0.90.
- The quiz pool grew 186 → 236, because the trust filter had been refusing to ask about
  actions flagged by a rule that should never have flagged them.

The script is kept and takes a dry run by default, because withdrawing a rule and
leaving its flags behind is a mistake that will recur.

Rules out: re-importing as a way to change bookkeeping. Re-import when the *reading*
should change; edit the data when the *rules* changed.

## 2026-08-16 — A passer cuts *after* the release, and rule 12 is withdrawn

`applyDependencies` in `src/lib/timing/sequence.ts`. Corrects dependency rule 3 and
withdraws rule 12 in `MASTER-BUILD-PLAN.md`.

Samuel's call, and the argument is from the notation rather than from taste: **a player
travelling with the ball is drawn as a dribble, not a cut.** So a cut attributed to a
passer can only be the move they make once their hands are empty.

The engine had it backwards. Rule 3 made a pass wait for *any* movement by the passer,
so a pass-then-cut animated as cut-then-pass — the ball arriving after the passer had
already left the spot they threw from.

Now:

- The passer's **dribble** still comes first. You throw from where you stand, and the
  dribble is what decides where that is.
- The passer's **cut or screen** is pushed after the release.

Ordering within `applyDependencies` matters and cost a test to discover: the pass→cut
rule has to run **last**, because the receiver-open rule pushes passes later. Placing
the cut against a pass time that then shifts put the player moving before they had let
go of the ball.

**Rule 12 is withdrawn.** It warned "player passes and cuts on the same beat — should
the cut be a dribble, or belong to the next beat?" That question has an answer, and
asking the coach to resolve it was the largest single source of review noise: seed
warnings fell from 20 to 8. `flag_pass_and_cut` in `derive.py` is now a no-op, so future
imports stop generating it too.

Existing `needsReview` flags carrying that reason are baked into the current seed and
will only clear on a re-import.

Rules out: treating a legal, notation-determined ordering as something for the coach to
adjudicate. Flags are for genuine ambiguity; anything else trains people to ignore them.

## 2026-08-16 — The importer can draw a bend, and the seed is re-interpreted on Gemini

`via` in `docs/skills/play-interpretation.md`, `_path_via()` in `derive.py`,
`services/importer/vision.py`. Supersedes "Keep the v1 interpretation seed".

Samuel spotted it from the review screen: a player who steps toward a teammate and then
cuts away was coming out as two things. Measuring it found something starker — **every
one of the 82 movement actions in the book was a straight line, and not one was bent.**

The cause was a missing field. The interpret skill's output schema had `type`, `by`,
`for`, `uncertain`, `reason` — and no way to say *where an arrow turns*. So `derive.py`
drew the only thing it could, `_simple_path(start, end)`, and the shape was gone.

Worse, the first leg had to become *something*. A player moving toward a teammate was
read as a pass to them, which is where the phantom pass-backs came from. The flattened
cuts and the impossible ping-pong passes were one defect, not two.

**The fix:** the model now reports `via` — the corners of a bent arrow, in travel order,
excluding the endpoints. Endpoints stay the parser's, which are trusted; only the shape
comes from the model, and a corner sitting within 12 units of the straight line is
discarded as a hand-drawn wobble rather than a real turn.

**Measured, as the earlier decision requires** (`scripts/compare-interpret.ts`):

| | v1 (Claude) | Gemini + `via` |
|---|---|---|
| Plays valid | 12 | 12 |
| Total actions | 123 | 110 |
| Derived (invented) | 21 | **6** |
| Unsure (`needsReview`) | 29 | 35 |
| Validation warnings | 27 | **20** |
| Review flags | 58 | **46** |
| Bent routes | 0 | **14** |
| Avg confidence | 0.71 | **0.79** |

The one regression is `needsReview`, and it is the right direction: invention fell from
21 to 6 while admitted uncertainty rose by 6. The skill's own governing principle is
that a wrong action costs more than a missing one, and a flag the coach can see beats a
guess they cannot.

Kickup, the worst play in the book, went from 0.33 to 0.79; Kansas 0.54 to 0.88. The
specific beat Samuel complained about — Relax beat 2 sending the ball 3 → 1 → 3 — is
simply gone.

Two supporting changes came out of this:

- **A provider seam.** `vision.py` reduces a model to "image and prompt in, text and
  tokens out". Everything else was already provider-agnostic. Gemini is preferred when
  both keys are set. The narrow seam is what made the A/B possible at all.
- **Per-frame failure isolation.** A dropped connection on frame 30 of 36 killed the
  entire run. Frames now retry with backoff, and one that still fails is flagged for
  review instead of taking the import down with it.

The candidate file was deleted after adoption rather than kept alongside, for the reason
recorded on 2026-08-12: unused play JSON in `src/data/` invites someone to import the
wrong file.

Rules out: reading a diagram as a set of straight lines between known points. Shape is
part of the play.

## 2026-08-15 — Phase 5 review: confidence ordering, and confirming means saving

`src/lib/review/`, `src/components/review/ReviewFlow.tsx`, `/coach/review`.

The import's real state, measured for the first time: **50 of 123 actions across the
twelve plays are either invented (21 `derived`) or unsure (29 `needsReview`)** — 41% —
and **no play is clean**. The best, Idaho, still has one thing to check; the worst,
Kickup, has seven of eleven actions unconfirmed and eight warnings.

That number is why review is a phase rather than a screen.

Decisions:

- **Confidence is an ordering heuristic, never a measurement.** It exists to put the
  worst play first and is deliberately not shown as a percentage; a coach told a play is
  "73% confident" would reasonably ask what the 27% is, and there is no honest answer.
  An invalid play scores 0 regardless of anything else.
- **The queue is stable.** Ties break on name, so it cannot reshuffle while a coach
  works through it.
- **Confirming saves.** "Looks right" clears the review flags via `confirmPlayActions`
  and POSTs to `/api/plays`. Confirmation that only lived in component state would be a
  button that lies. It also means review output lands in the same table the builder
  writes to — one playbook, not a reviewed copy.
- **Flags are shown on the court, not buried in a list.** Hovering a flag highlights the
  action it refers to, because "pass 4 → 2 spans 482 units" means nothing until you see
  which arrow that is.
- **Save-failure copy moved to `src/lib/play/saveErrors.ts`** and is now shared with the
  builder. A coach who learns what "create your team first" means on one screen should
  not meet different wording for the same problem on another.

Bug found while testing: action ids are only unique *within* a beat — `a1` exists on
most of them — so deduplicating flags by id alone silently dropped some. Flags are keyed
by beat and id together.

## 2026-08-15 — The quiz refuses to ask about anything nobody has confirmed

`isTrustworthy` and the `suspectTransfers` filter in `src/lib/quiz/generate.ts`.

Samuel's first question was "player 3 passes — who gets the ball?" on Relax beat 2,
where the ball goes **3 → 1 → 3 inside one beat**. The answer, 1, was correct and
invisible: by the end of the beat the ball is back with 3, so nothing a viewer could see
supported it.

Three filters now, and they share one principle — *only ask about things that are both
true and observable*:

1. **Never quiz on a `derived` or `needsReview` action.** `derived` means the pipeline
   invented it; `needsReview` means the AI was unsure. Nobody has checked either against
   the source page, and a player who memorises a guess has been taught something wrong.
2. **Never quiz on a transfer `suspectTransfers()` flags** — cross-court passes and
   possession bouncing straight back. The plausibility checks added earlier were turned
   from warning strings into structured data precisely so the generator could reuse
   them; one source of truth, two consumers.
3. **The receiver must still hold the ball at the end of the beat.** This is what caught
   Relax: an answer that is undone before the beat finishes is not answerable.

Cost: pass-target questions fall from roughly thirty to thirteen. That is the right
trade. A smaller set of questions that are all fair beats a larger set where some teach
the wrong thing, and the number climbs on its own as plays get reviewed.

Rules out: generating questions from play data without asking whether a human ever
confirmed it.

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
