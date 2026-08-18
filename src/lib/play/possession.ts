import type { Action, Beat, PlayerId } from "./types";

/**
 * Who holds the ball after a run of actions, starting from `start`.
 *
 * Possession moves only on a pass or a handoff, and the actions are walked in array
 * order because that is the order they were drawn and the order the beat plays.
 *
 * One implementation, because possession being computed in two places is how a play
 * ends up valid on one screen and impossible on another. `validatePlay`, the builder's
 * draw gate and the action ops all read from here.
 */
export function holderAfterActions(start: PlayerId, actions: Action[]): PlayerId {
  let holder = start;
  for (const action of actions) {
    if ((action.type === "pass" || action.type === "handoff") && action.for) {
      holder = action.for;
    }
  }
  return holder;
}

/**
 * Who has the ball *right now* on a beat being edited.
 *
 * Not `beat.startBall`: a coach who has just drawn a pass to 4 expects 4 to be able to
 * dribble, and gating on the start-of-beat holder told them 4 does not have the ball
 * while an arrow saying otherwise was on the screen.
 */
export function currentHolder(beat: Beat): PlayerId {
  return holderAfterActions(beat.startBall, beat.actions);
}
