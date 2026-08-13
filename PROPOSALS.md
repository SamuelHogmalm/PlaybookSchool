# Proposals

Things worth doing that were deliberately **not** done, with enough reasoning to decide
against them quickly. Nothing here is committed to. Where a decision was already taken
and recorded, `DECISIONS.md` is the authority and this file just points at the open part.

Ordered roughly by ratio of value to risk.

---

## 1. Fix the dribble easing, or fix its comment

**Small change, needs a judgement call.**

`easeInOutDribble` is documented as "~70% of cut speed (stretched time)" and does the
opposite: it leads `easeInOutCut` at every point, reaching twice the cut's progress at
t=0.1. `Math.pow(t, 0.85)` uses an exponent below 1, which compresses early time rather
than stretching it. The lanes are not compensating — cut is 0.10–0.70 and dribble
0.25–0.85, both 0.60 wide.

So one of two things is true, and only Samuel can say which:

- **The comment is right and the code is wrong.** A dribble should lag a cut, and the
  exponent should be above 1 (≈1.15). This changes how all twelve seed plays animate.
- **The code is right and the comment is wrong.** A ball-handler accelerating off the
  catch may be what the animation actually wants, in which case delete the comment.

Current behaviour is pinned by a test that says plainly it records a discrepancy, so
either fix is a visible diff. Cost: minutes, plus a look at `/dev/animator`.

## 2. Persist a builder draft

**Medium change, removes a real way to lose work.**

The builder holds the play in component state. A crash, a refresh, or a closed tab loses
everything drawn so far, and the new error boundary has to say so in as many words. Save
error copy already reassures the coach their work is "still in this tab" — which is true
and also the whole problem.

A `localStorage` draft keyed by play id, written on the same debounce as the history
checkpoint, would cover crash and refresh. Note this sits against the rule that
localStorage is only for the logged-out demo (`MASTER-BUILD-PLAN.md`), so it needs an
explicit exception: a draft is not progress data, and it is not the record of the play —
Postgres still is.

## 3. Make motion follow the smoothed curve

**Touches the timing singleton. Do it only if the gap is ever visible.**

Drawn routes render as a Catmull-Rom spline; motion samples the chords between the ≤12
retained points. A token therefore cuts fractionally inside its own drawn curve. The
deviation is bounded by the RDP epsilon — a few court units on a hand-drawn arc — and is
not visible at playback size.

Closing it means `positionsAt` sampling the spline rather than the polyline. That is the
one function every consumer depends on, and its purity and test coverage are the reason
the animator and the builder agree. Not worth the risk for an invisible improvement, but
worth knowing the option exists if someone ever draws a hard hook and complains.

## 4. Enforce rule 11 where it can actually be enforced

**Small, but needs a decision about scope.**

Spec rule 11 caps derived actions at "well under a third" across a playbook.
`validatePlay()` does not implement it, because it validates one play and the ratio is a
property of a set. Today it is a canary test over the seed with an absolute ceiling
(≤30; currently 21 of 123, 17%).

Options: leave it as a canary and say so in the spec; or add a
`validatePlaybook(plays)` that runs set-level rules, with rule 11 as its first member.
The second is the honest reading of the spec, and there will be more set-level rules
later (duplicate names, per-category coverage).

## 5. Keyboard drawing

**Genuine feature. Not a defect.**

Players can now be selected by keyboard, and every control has a label, but a route can
only be drawn with a pointer. A keyboard path would need a way to place waypoints —
arrow keys to move a cursor, Enter to drop a point, Escape to abandon — and that is a
design problem, not a patch.

Worth doing eventually: coaches use laptops on buses, and a trackpad drag on a moving
vehicle is genuinely hard. Not worth doing blind.

## 6. "Previous beat as faded ghosts"

**Specified, never built.**

`MASTER-BUILD-PLAN.md` line 173: "Selecting a beat shows the previous beat as faded
ghosts." This is beat-to-beat context and is unrelated to the destination ghosts that
were just replaced by routes — those showed `beat.pos` within the current beat.

It is a real orientation aid when editing beat 4 of 6. Now that `DestinationRoutes`
exists, the natural implementation is the same treatment applied to `beats[n-1]` at low
opacity, rather than a new component.

## 7. Unify action id formats

**Cosmetic, but it makes ids untrustworthy.**

`addDrawnAction` allocates sequential `a1`, `a2`. `duplicateBeat` reassigns random uids.
`nextActionId` only counts the `aN` form, so after a duplicate the numbering restarts —
a beat can hold `pqvcvbj`, `2x3l2bp`, `a1`.

Verified this session that it does **not** collide: uid-form ids never match `^a\d+$`,
so a claimed id is always free. It is confusing rather than broken. If a future feature
sorts or displays ids, fix it first.

## 8. Component-level tests

**The largest real coverage gap.**

161 tests cover `src/lib` well. Nothing tests a component. Everything in the builder
verified this session — live drawing, undo coalescing, the beat-index clamp, rollback of
an abandoned stroke — was verified through the pure functions underneath and then
reasoned about, not driven.

The undo-blanks-the-builder bug fixed this session is exactly the class of defect that
lives in the component layer and cannot be caught by testing `src/lib`. That is the
argument for a renderer; the argument against is that it is a new dependency and a new
convention in a codebase that has deliberately kept to `node:test` and `tsx`.
