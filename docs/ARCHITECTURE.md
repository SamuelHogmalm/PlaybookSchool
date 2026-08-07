# Playbook architecture

Five layers. Each layer only talks to the one below it through a small public API.

```
PDF upload
    ↓
[1] IMPORT + AI REVIEW     services/importer + src/lib/review
    ↓  Play JSON (frames/beats)
[2] PLAY BUILDER           src/app/play (editor) + src/lib/play
    ↓  Play (same shape, coach-edited)
[3] ANIMATION              src/lib/animation
    ↓  timeline + frame state (pos, ball, routes)
[4] QUIZ GENERATION        src/lib/quiz
    ↓  Question[]
[5] QUIZ SESSION           src/components/player/PlayerQuizSession
    ↓  UI (uses animation + questions, no business logic)
```

---

## Layer 1 — Import & AI review

**Purpose:** PDF → structured play JSON + optional AI breakdown (intent + motions).

| Location | Role |
|----------|------|
| `services/importer/parser.py` | PDF geometry → raw beats |
| `services/importer/interpret.py` | AI: positions, actions, notes |
| `services/importer/breakdown.py` | AI: intent + motion steps per beat |
| `src/lib/review/` | Client-side breakdown helpers, enrich for UI |
| `src/app/import/` | Upload flow, session state, crops |
| `src/app/play/PlayReview.jsx` | Review UI (PDF compare + beat editor) |

**Output shape:** `{ name, category, beats[] }` where each beat has `{ pos, ball, actions, note }`.

**Not responsible for:** animation, quiz, or persisting to playbook (export is manual today).

**Public API:** `src/lib/review/index.js`

---

## Layer 2 — Play builder (coach)

**Purpose:** Author and edit plays. Owns the canonical `Play` shape in memory.

| Location | Role |
|----------|------|
| `src/lib/playModel.js` | Stroke → action, paths, court math |
| `src/lib/normalizePlay.js` | Import JSON → `Play` |
| `src/lib/breakdownUtils.js` | Action ordering, timing rows |
| `src/app/play/PlayDrawEditor.jsx` | Draw routes, sequence steps, edit beats |
| `src/app/court/Court.jsx` | Renderer only (tokens, lines, SVG) |

**Public API:** `src/lib/play/index.js` (re-exports the above)

---

## Layer 3 — Animation

**Purpose:** Turn a `Play` + beat range into frame-by-frame state for the court.

One engine: **sequential timeline** in `sequentialPlayback.js`.

| File | Role |
|------|------|
| `sequentialPlayback.js` | Build timeline groups + `getSequentialPlaybackState` |
| `playAnimatorEngine.js` | Beat-range wrapper for `PlayAnimator` |
| `animation/constants.js` | Durations |
| `animation/index.js` | **Import animation from here in UI** |

**Consumers:** `PlayAnimator` (quiz), `PlayDrawEditor` / `PlayPlayback` (coach preview).

---

## Layer 4 — Quiz generation

| Location | Role |
|----------|------|
| `src/lib/quiz.js` | Formation, draw, watch buckets + scoring |
| `src/lib/dailyQuiz.js` | Multi-play daily deck |
| `src/lib/quizVoice.js`, `quizInstructions.js` | Prompts and phase copy |

**Public API:** `src/lib/quiz/index.js`

---

## Layer 5 — Quiz session (UI)

**Purpose:** Run questions — drive `PlayAnimator` with props, never compute positions.

| Location | Role |
|----------|------|
| `PlayerQuizSession.jsx` | Phase machine: lead-in → ask → reveal → result |
| `PlayAnimator.jsx` | rAF loop, calls animation layer |
| `AnimatorCourt.jsx` | Court + ActiveRouteLayer display |

**Rule:** Session changes `from`/`to`/`playing` on `PlayAnimator`. Animation layer does the rest.

---

## Data flow (step by step)

1. **Coach uploads PDF** → importer returns beats → `ImportContext` session
2. **Coach reviews** → `PlayReview` + AI breakdown → coach edits beats/actions
3. **Export** → `plays-interpreted.json` + `plays-breakdowns.json`
4. **`loadAllPlays()`** → normalizes + attaches breakdown → playbook + quiz source
5. **Quiz session** → `generateFlashcardDeck(play)` → questions
6. **Lead-in** → `PlayAnimator(play, from=0, to=askAtBeat)`
7. **Reveal** → `PlayAnimator(play, from=askAtBeat, to=revealToBeat)`

---

## Deprecated (do not use in new code)

| File | Replace with |
|------|----------------|
| `positionsAt.js` | `animation/deriveActions.js` (dev debug only) |
| `playInterpolation.js` | `animation/index.js` |
| `playback.js` `getPlaybackState` | `sequentialPlayback.js` |
| `PlayLab.jsx` | Split editor + `PlayerQuizSession` |
| `src/app/play/SequentialPlayCourt.jsx` | Removed — use `PlayAnimator` |

---

## What to fix next (priority)

1. **Smooth transitions** — tune `animation/constants.js`; avoid double-hold gaps
2. **Quiz runner rewrite** — four-phase session using new `Question` shape
3. **Import → playbook** — persist without manual JSON export
4. **Choice questions** — intent from breakdown layer 1
