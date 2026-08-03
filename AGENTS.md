# PlayLab — Agent Context

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- Deploy target: **Vercel**
- Source lives in `src/app/`
- `PlayLab.jsx` stays as `.jsx` — do not convert to `.tsx`

## Core principle

**A play is a semantic model, not a drawing.**

The court visualization is derived from the model. The player quiz is auto-generated from the model. Never treat coordinates as the source of truth — beats, positions, and actions are.

## Play data model

```ts
Play {
  name: string
  category: string
  frames: Frame[]   // called "beats" in the UI
  counters: Counter[]
}

Frame {
  id: string
  pos: Record<"1"|"2"|"3"|"4"|"5", { x: number, y: number }>
  ball: "1"|"2"|"3"|"4"|"5"        // which player has the ball
  actions: Action[]
  note: string                       // coach's read / teaching note
}

Vec { x: number, y: number }

Action {
  id: string
  type: "screen" | "cut" | "dribble" | "pass" | "handoff"
  by: "1"|"2"|"3"|"4"|"5"           // player performing the action
  for?: "1"|"2"|"3"|"4"|"5"         // target player (screens, passes, handoffs)
  path?: Vec[]                       // optional sampled route (~6-12 points); when absent, render as straight line
}

Counter {
  trigger: string    // defensive read / what the defense does
  answer: string     // what the offense should do
}
```

### Positions

| ID | Role |
|----|------|
| 1  | PG   |
| 2  | SG   |
| 3  | SF   |
| 4  | PF   |
| 5  | C    |

## Rules

- Frames are temporal beats — each frame is a moment in the play's progression
- Actions reference players by ID (`by`, `for`), not by pixel coordinates
- `path` is optional on actions — when absent, render/grade as straight line between start and end; existing plays without paths keep working unchanged
- When `path` is present, the diagram renders the actual curve (e.g. curl vs flare can share an endpoint but differ semantically)
- Player quiz questions are generated from frame transitions and actions — don't hardcode quiz content
- Coach mode edits the model; Player mode quizzes from it
- **No localStorage** — persistence will come from Supabase (not set up yet)
- **No auth, payments, or AI APIs yet** — add only when the feature needs them

## What not to build yet

- Supabase / database
- Clerk / auth
- Stripe / billing
- AI API integrations

## File map

- `src/app/PlayLab.jsx` — entire app (Editor + Player quiz + court rendering)
- `src/app/page.tsx` — renders `<PlayLab />`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
