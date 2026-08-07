# How to Break Down a Play

This rubric guides the AI when it translates a diagram into our animated play model. Edit this file to change how the AI interprets plays — no developer needed.

## What the AI does

1. **Read movements from the diagram** — who moves, what type (cut, screen, pass, dribble, handoff), in what order within each beat.
2. **Name the main look** — one sentence: the final shot this play is designed to get (who, where, how). Example: "2 catch-and-shoot on the left wing off the pin down."

That is all. No reads. No player options. No defensive counters. No role essays.

## Movements (primary output)

For every beat, list each movement in **play order** (order field starts at 1 each beat):

- **dribble** — handler moves with the ball
- **pass / handoff** — ball moves player to player (one arrow = one action)
- **screen** — screener sets before the cutter uses it (lower order number than the cut)
- **cut / fill / relocate** — player moves without the ball

Rules:

- One pass arrow = one pass. Never list multiple pass options from the same player.
- Screener moves **before** the cutter in order.
- Dribble before pass when the handler needs to create an angle.
- Off-ball players fill vacated spots when a teammate cuts away.

## Main look (`intent`)

One sentence only. The shot we are hunting at the end of the play.

Good: "4 catches on the wing for a three after 5's down screen for 1."

Bad: "Multiple options depending on the defense." Bad: "Read and react."

## What NOT to output

Do not generate: reads, pass progressions, roles, counters, situations, spacing rules, common errors, beat purposes, or coaching essays. Those are not used. If something is unclear from the diagram, omit it — do not guess.

## Voice

Short, factual movement descriptions. "5 sets a down screen for 1, then rolls." Not strategic analysis.

## Animation playback (how the app uses your output)

The coach app animates **one action at a time** within each beat, in this order:

1. **dribble** — ball handler moves with the ball  
2. **pass / handoff** — ball travels to exactly one receiver  
3. **screen** — screener moves to the screen spot  
4. **cut / fill / relocate** — off-ball movement  

Rules for clean animation:

- **One pass arrow = one pass.** Multiple dashed lines from the same player are "reads" on paper — pick ONE or omit and flag for coach review.
- **Passer must have the ball** at the start of the beat; receiver must match the ball handler at the **end** of the beat.
- **Assign `order`** on every action when a beat has more than one movement.
- **Screener before cutter** in order (lower order number).
- If you cannot assign an arrow to exactly one player with certainty, **omit it** — the coach fixes it in review.
