# Proposals

Things worth doing that were deliberately **not** done, with enough reasoning to decide
against them quickly. Nothing here is committed to. Where a decision was already taken,
`DECISIONS.md` is the authority and this file just points at the open part.

Ordered roughly by ratio of value to risk.

Last reviewed 2026-08-17.

---

## 1. Persist a builder draft

**Medium change, removes a real way to lose work.**

The builder holds the play in component state. A crash, a refresh, or a closed tab loses
everything drawn so far, and the error boundary has to say so in as many words.

A `localStorage` draft keyed by play id, written on the same debounce as the history
checkpoint, would cover crash and refresh. Note this sits against the rule that
localStorage is only for the logged-out demo, so it needs an explicit exception: a draft
is not progress data, and it is not the record of the play — Postgres still is.

## 2. Quiz persistence

**Blocked on nothing but a decision about scope.**

`attempts` and `mastery` exist and are empty. The runner scores in memory and says so on
screen. Wiring it up needs a player profile, which pulls Phase 6 (teams and roster)
forward — or a deliberate shortcut where a coach can drill their own playbook and have
it counted.

Worth doing soon: without it there is no weakness weighting, and without weakness
weighting the quiz is a shuffle rather than a teacher.

## 3. The remaining two question types

`draw` and `sequence`. Four of six exist now — `spot`, `pass-target`, `next-action`,
`identify` — and the pool is 236 questions across twelve plays.

`draw` is the valuable one and the expensive one: it needs pointer input on the quiz
court and grading on endpoint plus heading, which is real work. `sequence` (put three
beats in order) is cheap and would add variety.

Neither is urgent now the type mix is healthy.

## 4. Make motion follow the smoothed curve

**Touches the timing singleton. Do it only if the gap is ever visible.**

Drawn routes render as a Catmull-Rom spline; motion samples the chords between the ≤12
retained points, so a token cuts fractionally inside its own drawn curve. Deviation is
bounded by the RDP epsilon and is not visible at playback size.

Closing it means `positionsAt` sampling the spline. That is the function every consumer
depends on, and its purity is why the animator and builder agree. Not worth the risk for
an invisible improvement.

## 5. Enforce rule 11 where it can actually be enforced

Spec rule 11 caps derived actions at "well under a third" across a playbook.
`validatePlay()` does not implement it, because it validates one play and the ratio is a
property of a set. Today it is a canary test over the seed.

Options: leave it as a canary and say so in the spec; or add a `validatePlaybook(plays)`
for set-level rules, with rule 11 as its first member. The second is the honest reading,
and there will be more set-level rules later (duplicate names, per-category coverage).

Currently 6 derived actions of 104 — well inside the cap either way.

## 6. Keyboard drawing

**Genuine feature. Not a defect.**

Players can be selected by keyboard and every control has a label, but a route can only
be drawn with a pointer. A keyboard path needs a way to place waypoints — arrow keys to
move a cursor, Enter to drop a point, Escape to abandon — which is a design problem, not
a patch.

Worth doing eventually: coaches use laptops on buses, and a trackpad drag on a moving
vehicle is genuinely hard.

## 7. "Previous beat as faded ghosts"

**Specified, never built.**

`MASTER-BUILD-PLAN.md` line 173. This is beat-to-beat context and is unrelated to the
destination ghosts that were replaced by routes.

A real orientation aid when editing beat 4 of 6. Now that `DestinationRoutes` exists, the
natural implementation is the same treatment applied to `beats[n-1]` at low opacity.

## 8. Unify action id formats

**Cosmetic, but it makes ids untrustworthy.**

`addDrawnAction` allocates sequential `a1`, `a2`. `duplicateBeat` reassigns random uids.
`nextActionId` only counts the `aN` form, so after a duplicate the numbering restarts.

Verified not to collide: uid-form ids never match `^a\d+$`. Confusing rather than broken.
Note that action ids are only unique *within a beat* — that has already caused one bug,
in review flag deduplication.

## 9. Component-level tests

**The largest remaining coverage gap.**

244 tests cover `src/lib` well. Nothing drives a component. The undo-blanks-the-builder
bug, the invisible "Fix this" button, and the white-on-white quiz page were all found by
a human looking at the screen.

The argument for a renderer is that class of bug. The argument against is a new
dependency and a new convention in a codebase that has deliberately kept to `node:test`
and `tsx`.

---

## Done since this file was written

- **Dribble easing** (was §1) — resolved 2026-08-16. A dribble is paced exactly like a
  cut; overall pace is set by beat duration, raised 25%.
- **Inline editing in review** (was §5-adjacent) — built 2026-08-16. Review uses the
  builder's own editor via `usePlayEditor`, not a second one.
- **Screens with no target** (was §1) — fixed 2026-08-17. `repair_targetless_screens`
  infers the nearest moving teammate, downgrades to a cut when nobody uses it, and drops
  the action when the player did not travel either. Covered by
  `services/importer/test_derive.py`.
