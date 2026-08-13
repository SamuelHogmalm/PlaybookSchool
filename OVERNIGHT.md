# Overnight run — 13 August 2026

Eleven commits, `9f3fbd9..ede4b02`, 34 files, +2310 / −201. All pushed to `origin/main`.

Everything in the brief was completed. Nothing was blocked, so there is no `BLOCKED.md`.

**Verified at the end of the run:**

| Check | Before | After |
|---|---|---|
| `npm test` | 70 pass | **161 pass**, 0 fail |
| `npm run build` | clean | clean |
| `npm run lint` | **3 errors**, 17 warnings | **0 errors**, 8 warnings |
| `npm run test:seed` | not run | 12/12 valid |

The 8 remaining lint warnings are all outside the play engine (scripts, auth `.js`, the
landing page). None are new.

---

## The five items

### 1. `CLAUDE.md` — audited whole, three things were wrong

- Documented `plays-interpreted-v2/v3.json` as "kept for comparison". They were deleted
  in `3aee652`, the same night they were created.
- Said rule 11 (derived-action ratio) was enforced by `validatePlay()`, **in two
  places**. It is not, and cannot be — it is a property of a whole playbook and
  validation runs on one play. It is a canary test over the seed.
- Put the hoop and lane constants in `src/lib/play/geometry.ts`. They are in
  `src/lib/court/courtLines.ts`.

Added: the builder history invariant, the save endpoint and its migration, the
`middleware.js → proxy.js` rename, a `DECISIONS.md` pointer, and a state section saying
active work is Phase 2 rather than Phase 4.

### 2. Arrow smoothing — done, in one place rather than two

Ramer–Douglas–Peucker reduces a stroke to ≤12 points when the action is committed;
`pathToSvgD` renders those points as a Catmull-Rom spline emitted as cubic Béziers.

The brief asked for it "in BOTH `pathToSvgD` and the animator's route rendering". It
turned out one change covers three surfaces: `ActionLayer` (builder), `RouteLayer`
(animator) and `DrawPreview` (the live stroke) all call `pathToSvgD`. Making them
identical was a matter of not adding a second path renderer.

Both halves preserve endpoints exactly — RDP can only drop points, Catmull-Rom
interpolates its control points. 16 tests, including that the endpoints survive.

**Known limit, documented:** motion samples the chords between retained points, so a
token cuts fractionally inside its own drawn curve. Bounded by the RDP epsilon and not
visible at playback size. Closing it means changing `positionsAt` — the singleton — so I
left it and wrote it into `PROPOSALS.md`.

### 3. Live drawing — done, plus a bug the brief did not mention

Every pointer move now writes the action through `upsertDrawnAction`, which rewrites one
action by id instead of appending per frame. Frames go through `replacePresent` (no undo
step) with a `checkpoint` on a 400 ms debounce — the debounce you sanctioned, and it was
needed.

Token dragging turned out to be worse than drawing: it called `mutate` on every pointer
move, so dragging a player across the court pushed **dozens** of undo steps. Same fix.

**Two action types are held back, for data reasons rather than effort.** A screen needs
the player it is set for, which the coach picks *after* the stroke. A pass needs a
receiver, unknown until the cursor finds one. Writing either early puts an action into
the play that `validatePlay` rejects and flashes errors mid-stroke. Passes start writing
the moment a receiver is under the cursor.

**Bug found and fixed:** `removeAction` reset a player's position when their movement was
deleted but never touched `beat.ball`. Deleting a pass left the beat holding a ball that
arrived by no visible means, failing rules 3 and 4 on a play the coach thought they had
just cleaned up. Rollback of an abandoned stroke depends on removal being complete, which
is how it surfaced.

### 4. Ghosts → routes — done, and it made a validation problem visible

`BeatGhostMarkers` is gone. `DestinationRoutes` draws travel toward `beat.pos` through
the same `pathToSvgD` the animator uses.

Players who already have a movement action are skipped, because `ActionLayer` draws their
route and a second line along it is just heavier. What remains is travel with no action to
explain it — which is exactly what validation rule 9 objects to. The old ghost looked the
same whether the play was valid or not; the route makes the problem visible.

Move mode keeps a grab ring at each destination. The instruction text now reads "drag the
ring at the end of a player's route" instead of naming ghosts.

Selection logic is `unexplainedTravel()` in `actionGeometry.ts` so it is testable — 6
tests. Two of them failed first and were **my** error, not the code's: on beat 1
`updateBeatPlayerPos` deliberately moves `startPos` too, because beat 1's `startPos` *is*
the opening alignment.

### 5. `movementActionForPlayer` — deleted

The `/dev/animator` beat table now lists every movement per player ("screen → roll") with
a timing window each, which is what the Phase 3 checkpoint asks you to confirm by eye.

---

## Fallback work

### Test coverage: 70 → 161

New: `normalizeSeedPlay` (the untested seed producer — 14 tests pinning the rule that a
beat's `pos` comes from the *next* beat's `startPos`), `samplePolyline` (arc-length not
per-segment, which every animated position depends on), the easing curves, snap/clamp/
`clientToCourt`, `nearestPlayerAt`, hit testing, and `playerBeatMove`.

### Bugs found

**Undo after "add beat" blanked the entire builder.** The most serious thing found all
night. `beatIndex` was not clamped when undo shrank the play, so `play.beats[2]` was
`undefined` and `if (!beat) return null` unmounted everything — *including the beat strip
you would need to select a different beat*. Unrecoverable without a reload. The index is
now clamped on read.

**Strokes ended at the sideline.** `EditableCourt` treated `pointerleave` as
`pointerup`, so drawing through the sideline and back finished the stroke at the edge.
Both gestures set pointer capture, which guarantees `pointerup` is delivered off-court,
so the leave handler was unnecessary. `pointerCancel` now handles a gesture actually
being taken away. **Not verified in a browser — reasoned from the pointer-capture spec.**

**Lint had been failing on `main`.** Three errors in `usePlayPlayback.ts`, all
pre-existing. Two were refs written during render — a real defect, since React can
discard and replay a render and the ref keeps the discarded value. Fixed properly rather
than suppressed.

**Dribble easing contradicts its own comment.** Documented as "~70% of cut speed", it
leads the cut curve at every point. Both lanes are 0.60 wide, so the curve is the cause:
`Math.pow(t, 0.85)` compresses early time instead of stretching it. **Left unchanged** —
changing a motion curve changes how all twelve seed plays animate, and that is your call,
not a cleanup. Pinned by a test that says so. → `PROPOSALS.md` item 1.

**Checked, not a bug:** action-id collision after `duplicateBeat`. Uid-form ids never
match `^a\d+$`, so `nextActionId` always returns a free id. Confusing, not broken.

### Error states

`/plays/new` had no error boundary — a throw anywhere in the play engine left a blank
page. It has one now, and the copy is honest that resetting discards the play, because
the builder holds it in component state and there is no draft persistence. I did not want
it promising a recovery that does not exist. `/dev/animator` no longer assumes the seed
file is non-empty.

### Accessibility

Scope call: labelling and announcements are a defect and were fixed; a keyboard-drawable
court is a feature nobody asked for and went to `PROPOSALS.md`.

`ValidationBanner` was three separate elements swapped between states, so the live region
appeared at the same moment as its content — the case screen readers commonly do not
announce. It is now one always-mounted region, `alert`/`assertive` for errors and
`status`/`polite` otherwise. Palette tools became labelled toggle buttons using
`aria-disabled` rather than `disabled`, so the tooltip explaining *why* a tool is off
stays reachable — that explanation is the whole teaching mechanism behind the ball gate.
Player tokens are focusable and selectable with Enter/Space. Undo/redo got real labels
and `aria-keyshortcuts`.

---

## Things for you

1. **The dribble easing question** (`PROPOSALS.md` §1) is the only one I could not decide
   without you: is a dribble meant to lag a cut, or lead it?
2. **Two changes want a real browser.** The pointer-capture change and the whole live-draw
   flow were verified through their pure functions and then reasoned about. `npm run dev`
   → `/plays/new`: draw a cut through the sideline and back; draw and abandon a stroke,
   then check Ctrl+Z does not step through it; drag a token and check one Ctrl+Z returns
   it.
3. **`DECISIONS.md` now has 20 entries.** Ten reconstructed from git and your note, ten
   written as the work happened. Worth a skim to check I recorded your reasoning about
   v1/v2/v3 the way you actually meant it.
4. **`PROPOSALS.md` §8** is the honest gap: 161 tests and not one drives a component. The
   undo-blanks-the-builder bug is precisely the class that lives there.
