# Cursor Prompt — Playbook Import Pipeline

Before pasting this, put these three files in the repo:

- `plays.json` → `src/data/plays.json` (12 real plays, already extracted)
- `fastdraw_parser.py` → `services/importer/parser.py` (tested, working)
- `sample_frame_crop.png` → anywhere, just so you can see what stage 2 reads

Then paste everything below the line into Cursor.

---

Read AGENTS.md first. Then complete these tasks **in order**, stopping after each
so I can test.

## Background

Coaches export playbooks from FastDraw as PDFs. Those PDFs are vector, not scans,
which means most of the play is recoverable deterministically with no AI at all.
A tested Python parser already exists at `services/importer/parser.py`. It extracts,
per beat: all five player positions mapped into our 500x470 court system, which
player has the ball, the play name, and the beat ordering. It was verified against
a real 12-play playbook with a 36/36 success rate.

What the parser does **not** extract is the arrows — passes, cuts, screens,
dribbles. That is stage 2, and it uses a vision model.

**Do not rewrite the parser.** It works. Wrap it.

## Task 1 — Load the sample data

`src/data/plays.json` contains 12 real plays with correct positions and ball
possession, and empty `actions` and `note` fields.

Add a dev-only route `/dev/import-preview` that renders all 12 plays using the
existing court renderer, one card per play with a beat stepper. This is purely so
I can confirm the data lands correctly before any upload code exists.

## Task 2 — The importer service

Stage 1 needs Python (pdfplumber, poppler). Do **not** try to run it on Vercel —
poppler isn't available in that runtime.

Create `services/importer` as a standalone FastAPI service, deployable to Railway
or Render:

- `POST /parse` — accepts a PDF, runs `parser.parse()` and `parser.extract_frames()`,
  returns the play JSON plus base64 frame crops.
- Dockerfile installing `poppler-utils`, `pdfplumber`, `pillow`, `fastapi`, `uvicorn`.
- Health check at `/health`.
- Reject files over 25MB or 100 pages.

If the PDF has no detectable FastDraw court rects, return a clear
`unsupported_format` error rather than an empty result. We will handle other
playbook formats later; failing loudly is correct for now.

## Task 3 — Stage 2, arrow interpretation

Add `POST /interpret` to the same service. For each frame crop, call the Anthropic
API with the image **and** the already-known player coordinates, and ask only for
the semantic layer.

Use `claude-sonnet-5`. Model choice matters: we are not asking it to estimate
positions — it already has those — only to read relationships. Send the crop as a
base64 image block.

The prompt to use, verbatim:

```
You are reading one frame of a basketball play diagram.

The five players' positions are already known and given below in a 500x470
coordinate system (baseline at top, y=0; half-court line at bottom, y=470;
hoop center at x=250, y=52).

Players: {positions_json}
Ball handler: {ball}

Standard notation in this diagram:
- Solid line with an arrowhead = a cut (player movement)
- Dashed line with an arrowhead = a pass
- Wavy or zigzag line = a dribble
- Line ending in a short perpendicular bar = a screen; the bar is where
  the screen is set

Identify ONLY the actions in this frame. Return strict JSON, no prose,
no markdown fences:

{
  "actions": [
    {"type": "screen|cut|dribble|pass|handoff", "by": "1-5", "for": "1-5 or null"}
  ],
  "note": "one sentence a high school player would understand",
  "confidence": "high|medium|low"
}

Rules:
- "by" is the player performing the action. For a screen, "by" is the screener
  and "for" is the player being screened.
- For a pass, "by" is the passer and "for" is the receiver.
- If an arrow's owner is ambiguous, omit that action rather than guessing.
- Set confidence to "low" if arrows cross or you are unsure of any assignment.
```

Handling:
- Parse the response defensively — strip any stray fences before `JSON.parse`.
- If parsing fails or `confidence` is `low`, keep the beat with empty actions and
  flag it `needs_review: true`. Never drop a beat.
- Process frames concurrently, max 5 at a time.
- Log token usage per import so we can track cost.

## Task 4 — Coach-facing import flow

In the Next.js app:

1. `/import` — drag-and-drop a PDF. Upload to Supabase Storage.
2. Create an `imports` row with status `parsing` → `interpreting` → `review` →
   `complete`. Poll it and show real progress: "Found 12 plays, 36 beats. Reading
   play 4 of 12…"
3. **Review screen — this is the most important part of the feature.** Show every
   beat side by side: the original PDF crop on the left, our rendered version on
   the right. The coach confirms or fixes. Beats flagged `needs_review` sort to
   the top and are visually marked.
4. "Confirm all" for a fast path, plus per-beat editing that opens the existing
   editor inline.
5. On confirm, write the plays to the `plays` table for that team.

Do not auto-accept AI output into the playbook without the coach seeing it. The
review step is the product, not a safety net — it is what makes the import
trustworthy enough that a coach imports their whole book instead of abandoning
it on page three.

## Task 5 — Cost guardrails

- Store `input_tokens`, `output_tokens`, and computed cost on the `imports` row.
- Hard cap: refuse an import projected over $2 and tell the coach why.
- Skip stage 2 entirely if the coach chooses "positions only" — that path is free
  and still gives them a working, quizzable playbook.

---

Do not build the AI tutor chat in this prompt.
