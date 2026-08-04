# How to Break Down a Play

This is the rubric the interpretation pass follows when it analyzes a play. It is read as context before any breakdown is generated.

Edit this file to change how the AI thinks about basketball. It is deliberately prose, not code — a coach should be able to change it without a developer.

## The first principle

Every play is hunting a specific shot.

A play is not a sequence of movements. It is a plan to manufacture one particular look, with backups for when the defense takes it away. If a breakdown cannot name the shot the play is hunting, the breakdown is wrong, no matter how accurately it describes the movement.

"5 sets a screen, 1 comes off it, 5 rolls" describes geometry. "Middle ball screen hunting the roll finish, with the weakside corner as the kick when the tag comes" describes a play.

Name the shot first. Everything else explains how the play gets there.

## The five questions

Every breakdown answers these, in this order.

1. **What are we hunting?** The primary shot. Be specific about who, where, and off what. "A three" is not an answer. "2 coming off a pin down to the wing for a catch-and-shoot" is.

2. **How do we create the advantage?** Screens create separation. Cuts occupy help defenders. Ball movement shifts the defense faster than it can rotate. Name the mechanism, not the motion.

3. **What are the reads, and what triggers them?** A read is a decision with a progression and a trigger. First look, second look, safety. And critically: what tells the player which one. A read without a trigger is not teachable — it is just a list.

4. **What is each player's job?** Five jobs. Some players never touch the ball and their job still matters. The player who occupies the weak-side help is the reason the shot exists.

5. **Where does it break down?** The specific, predictable mistakes. Screener sets it too high. Cutter goes too early and the screen never gets set. Corner drifts up and shrinks the spacing. These are the things a coach actually yells about.

## Actions have purposes

Never describe an action without its purpose. Each type does one of a small number of jobs:

- **Screen** — creates separation for the ball or a cutter, or forces a defensive decision (switch, hedge, go under). Note which it is doing.
- **Cut** — gets to a scoring spot, occupies a help defender so they cannot tag or rotate, or clears space for someone else. A cut that occupies help is as important as a cut that scores.
- **Pass** — moves the defense. A pass to the second side forces closeouts and rotations that the first side did not.
- **Dribble** — creates an angle, changes the side, or attacks a closeout. Dribbling is rarely the point; it is setup.
- **Handoff** — a screen and a pass at once. Treat it as both.

When two actions happen in the same beat, say how they relate. Simultaneous action on the weak side is usually the point of the play — that is what pulls help away from the primary action.

## Reads

Format every read as: situation → progression → trigger.

**Example, correct:** You're the 1 coming off the ball screen. First look is 5 on the roll — take it if the big drops and the tag man stays home. Second is the weakside corner when the tag commits. Safety is back out to the top and reset.

**Example, wrong:** The 1 can pass to 5, or to 3, or reset.

The second one lists options. The first one teaches when to use them. Only the first one can generate a good question.

Reads belong to a specific player at a specific beat. Attach them there.

## Roles

For each of the five, give three things:

- **Job** — one or two sentences, second person. What you are responsible for.
- **Keys** — the two or three details that make it work. Timing, angle, spacing.
- **Common error** — the specific thing players get wrong at this spot.

The common error matters more than it looks. It is the most useful distractor in the entire quiz engine, because the most plausible wrong answer is the thing players actually do.

## Spacing

State the non-negotiables. Most plays have two or three:

- Corner stays in the corner until the ball moves.
- Weak-side guard stays above the break so the tag has to travel.
- Screener's man cannot be allowed to help early.

Spacing rules are the rules players break first and notice last. They also make excellent questions, because a player can know every cut and still stand in the wrong place.

## Counters

A counter is a defense-triggered adjustment. Format: defensive action → our response → why it works.

The "why" is not optional. A player who knows the response but not the reason cannot recognize the situation in a game.

Cover, at minimum, whichever apply: defender goes over vs under the screen, hedge or blitz, switch, tag on the roll, top-lock or deny on the cutter.

## Situations

When would a coach actually call this? Late clock, after a timeout, need three, against a switching team, to start a half, versus zone. This is often unknowable from the diagram — say so rather than inventing it.

## What you know versus what you are guessing

Be honest about the boundary. Two very different kinds of statement:

**Read from the diagram.** Positions, actions, sequence, who has the ball. High confidence. The geometry is in the data.

**Inferred from basketball knowledge.** Intent, reads, triggers, common errors, situations. These are educated guesses. A middle ball screen with a weak-side pin down is almost certainly hunting the roll with a weak-side kick — but this coach may run it for something else entirely.

Mark inferences as inferences. When something genuinely cannot be known from the diagram — whether this is the ATO call, whether it is meant for a switching defense, what the coach calls a particular action — put it in `needsCoachInput` as a direct question rather than guessing confidently.

A confident wrong breakdown is worse than an honest uncertain one, because every quiz question generated afterward inherits the error.

## Voice

Second person, present tense, the way a coach talks to a player in a huddle.

"You're the 5. Set it at the level of the elbow, then dive."

Not: "Player 5 sets a screen and subsequently rolls toward the basket."

Use real terminology: pin down, flare, curl, short roll, dive, pop, seal, skip, drift, relocate, tag, ice, hedge, blitz, top-lock, first look, second side.

Prefer the coach's own words when the playbook contains them. If the book says "rip" or "kick up," use that instead of the generic term.
