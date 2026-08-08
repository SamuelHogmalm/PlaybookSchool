import {
  dist,
  isOnCourt,
  isPlayerId,
  MAX_BEAT_MOVE,
  MAX_IDLE_MOVE,
  MAX_SCREENER_MOVE,
  playerMove,
} from "./geometry";
import type { Action, Beat, Play, PlayerId, ValidationResult } from "./types";
import { ACTION_TYPES, PLAYER_IDS } from "./types";

function err(errors: string[], message: string): void {
  errors.push(message);
}

function actionMovers(actions: Action[]): Set<PlayerId> {
  const movers = new Set<PlayerId>();
  for (const a of actions) {
    if (a.by) movers.add(a.by);
  }
  return movers;
}

function isTransfer(type: Action["type"]): boolean {
  return type === "pass" || type === "handoff";
}

/** Simulate possession through beat actions; returns final holder. */
function holderAfterActions(start: PlayerId, actions: Action[]): PlayerId {
  let holder = start;
  for (const a of actions) {
    if (a.type === "pass" || a.type === "handoff") {
      if (a.for) holder = a.for;
    } else if (a.type === "dribble") {
      holder = a.by;
    }
  }
  return holder;
}

function validateBeatStructure(beat: Beat, beatIdx: number, errors: string[]): void {
  const label = `Beat ${beatIdx + 1} (${beat.id})`;

  for (const id of PLAYER_IDS) {
    const start = beat.startPos[id];
    const end = beat.pos[id];
    if (!start) {
      err(errors, `${label}: missing startPos for player ${id}.`);
    } else if (!isOnCourt(start)) {
      err(
        errors,
        `${label}: player ${id} startPos (${start.x}, ${start.y}) is off the court.`,
      );
    }
    if (!end) {
      err(errors, `${label}: missing position for player ${id}.`);
      continue;
    }
    if (!isOnCourt(end)) {
      err(
        errors,
        `${label}: player ${id} at (${end.x}, ${end.y}) is off the court.`,
      );
    }
  }

  if (!beat.startBall || !isPlayerId(beat.startBall)) {
    err(errors, `${label}: invalid startBall "${beat.startBall}".`);
  }

  if (!beat.ball || !isPlayerId(beat.ball)) {
    err(errors, `${label}: invalid ball holder "${beat.ball}".`);
  }

  for (const a of beat.actions) {
    if (!ACTION_TYPES.includes(a.type)) {
      err(errors, `${label}: unknown action type "${a.type}".`);
    }
    if (!isPlayerId(a.by)) {
      err(errors, `${label}: action ${a.id} has invalid by "${a.by}".`);
    }
    if (isTransfer(a.type) || a.type === "screen") {
      if (!a.for || !isPlayerId(a.for)) {
        err(errors, `${label}: ${a.type} ${a.id} requires a valid for player.`);
      }
    }
  }
}

function validateWithinBeatMovement(beat: Beat, beatIdx: number, errors: string[]): void {
  const label = `Beat ${beatIdx + 1} (${beat.id})`;

  // Rule 8 — teleport cap (within-beat startPos -> pos)
  for (const id of PLAYER_IDS) {
    const move = playerMove(beat.startPos, beat.pos, id);
    if (move > MAX_BEAT_MOVE) {
      err(
        errors,
        `${label}: player ${id} moves ${Math.round(move)} units (max ${MAX_BEAT_MOVE}).`,
      );
    }
  }

  // Rule 9 — idle players hold position within beat (≤60 units spacing allowed)
  const movers = actionMovers(beat.actions);
  for (const id of PLAYER_IDS) {
    if (movers.has(id)) continue;
    const a = beat.startPos[id];
    const b = beat.pos[id];
    if (a && b && dist(a, b) > MAX_IDLE_MOVE) {
      err(
        errors,
        `${label}: player ${id} moved without an action.`,
      );
    }
  }
}

function validateBeatTransition(
  prev: Beat,
  cur: Beat,
  beatIdx: number,
  errors: string[],
): void {
  const label = `Beat ${beatIdx + 1} (${cur.id})`;
  const startHolder = prev.ball;

  if (cur.startBall !== prev.ball) {
    err(
      errors,
      `${label}: startBall is ${cur.startBall} but previous beat ends with ${prev.ball}.`,
    );
  }

  // Rule 3 — ball continuity across beats (holder must reach cur.ball via actions)
  if (prev.ball !== cur.ball) {
    const reached = holderAfterActions(prev.ball, cur.actions);
    if (reached !== cur.ball) {
      err(
        errors,
        `${label}: ball moves ${prev.ball}→${cur.ball} with no pass/handoff path from ${prev.ball} to ${cur.ball}.`,
      );
    }
  }

  // Rule 5 — only holder may pass, dribble, handoff
  let holder = startHolder;
  for (const a of cur.actions) {
    if (a.type === "pass" || a.type === "handoff" || a.type === "dribble") {
      if (a.by !== holder) {
        err(
          errors,
          `${label}: ${a.type} by ${a.by} but ${holder} has the ball.`,
        );
      }
      if (a.type === "pass" || a.type === "handoff") {
        if (a.for) holder = a.for;
      } else {
        holder = a.by;
      }
    }
  }

  const finalHolder = holderAfterActions(startHolder, cur.actions);

  // End-of-beat possession must match declared ball
  if (finalHolder !== cur.ball) {
    err(
      errors,
      `${label}: actions imply ball with ${finalHolder} but beat.ball is ${cur.ball}.`,
    );
  }

  // Rule 4 — pass receiver must hold ball at beat end (allows chains via final holder)
  for (let i = 0; i < cur.actions.length; i++) {
    const a = cur.actions[i];
    if (!isTransfer(a.type) || !a.for) continue;

    const laterChain = cur.actions
      .slice(i + 1)
      .some((later) => isTransfer(later.type) && later.by === a.for);

    if (!laterChain && cur.ball !== a.for) {
      err(
        errors,
        `${label}: pass/handoff ${a.by}→${a.for} but beat.ball is ${cur.ball}.`,
      );
    }
  }

  // Rule 6 — no self pass/screen
  for (const a of cur.actions) {
    if (a.for && a.by === a.for) {
      err(
        errors,
        `${label}: ${a.type} ${a.id} — player ${a.by} cannot target themselves.`,
      );
    }
  }

  // Rule 7 — screener travel cap
  for (const a of cur.actions) {
    if (a.type !== "screen") continue;
    const move = playerMove(prev.pos, cur.pos, a.by);
    if (move > MAX_SCREENER_MOVE) {
      err(
        errors,
        `${label}: screener ${a.by} moves ${Math.round(move)} units (max ${MAX_SCREENER_MOVE}).`,
      );
    }
  }
}

function validateFirstBeatActions(beat: Beat, errors: string[]): void {
  const label = `Beat 1 (${beat.id})`;
  let holder = beat.startBall;

  for (const a of beat.actions) {
    if (a.type === "pass" || a.type === "handoff" || a.type === "dribble") {
      if (a.by !== holder) {
        err(
          errors,
          `${label}: ${a.type} by ${a.by} but ${holder} has the ball.`,
        );
      }
      if (a.type === "pass" || a.type === "handoff") {
        if (a.for) holder = a.for;
      } else {
        holder = a.by;
      }
    }
    if (a.for && a.by === a.for) {
      err(
        errors,
        `${label}: ${a.type} ${a.id} — player ${a.by} cannot target themselves.`,
      );
    }
  }

  const finalHolder = holderAfterActions(beat.startBall, beat.actions);
  if (finalHolder !== beat.ball) {
    err(
      errors,
      `${label}: actions imply ball with ${finalHolder} but beat.ball is ${beat.ball}.`,
    );
  }
}

/**
 * Pure validation — spec rules 1–10.
 * @see MASTER-BUILD-PLAN.md
 */
export function validatePlay(play: Play): ValidationResult {
  const errors: string[] = [];

  if (!play?.beats?.length) {
    err(errors, "Play has no beats.");
    return { valid: false, errors };
  }

  // Rule 10
  if (play.beats.length < 2) {
    err(errors, "Play must have at least two beats.");
  }

  for (let i = 0; i < play.beats.length; i++) {
    validateBeatStructure(play.beats[i], i, errors);
    validateWithinBeatMovement(play.beats[i], i, errors);
  }

  validateFirstBeatActions(play.beats[0], errors);

  for (let i = 1; i < play.beats.length; i++) {
    validateBeatTransition(play.beats[i - 1], play.beats[i], i, errors);
  }

  return { valid: errors.length === 0, errors };
}
