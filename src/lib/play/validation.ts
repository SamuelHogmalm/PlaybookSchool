import {
  dist,
  isOnCourt,
  isPlayerId,
  MAX_BEAT_MOVE,
  MAX_IDLE_MOVE,
  MAX_SCREENER_MOVE,
  playerMove,
} from "./geometry";
import { holderAfterActions } from "./possession";
import type { Action, Beat, Play, PlayerId, ValidationResult } from "./types";
import { ACTION_TYPES, PLAYER_IDS } from "./types";

function err(errors: string[], message: string): void {
  errors.push(message);
}

/**
 * Players whose travel this beat is explained by an action.
 *
 * Only cuts, dribbles and screens count. A pass does not move you — counting it let a
 * player be teleported 386 units in Kentucky beat 1 and still validate, because they
 * happened to also throw the ball.
 */
function actionMovers(actions: Action[]): Set<PlayerId> {
  const movers = new Set<PlayerId>();
  for (const a of actions) {
    if (!a.by) continue;
    if (a.type === "cut" || a.type === "dribble" || a.type === "screen") {
      movers.add(a.by);
    }
  }
  return movers;
}

function isTransfer(type: Action["type"]): boolean {
  return type === "pass" || type === "handoff";
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

  // Rule 9 — idle players hold position within beat (≤25 units jitter allowed)
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

  // Rule 7 — screener travel cap (idle at spot); travel-to-screen uses an explicit path
  for (const a of cur.actions) {
    if (a.type !== "screen") continue;
    if (a.path && a.path.length >= 2) continue;
    const move = playerMove(cur.startPos, cur.pos, a.by);
    if (move > MAX_SCREENER_MOVE) {
      err(
        errors,
        `${label}: screener ${a.by} moves ${Math.round(move)} units (max ${MAX_SCREENER_MOVE}).`,
      );
    }
  }
}

/*
 * Rule 12 used to warn when a player both passed and cut on one beat, asking whether
 * the cut should have been a dribble or belonged to the next beat.
 *
 * It is not ambiguous. A player travelling with the ball is drawn as a dribble, so a
 * cut by the passer is necessarily the move they make after releasing it — which is
 * now what `sequenceBeat` does. Asking the coach to resolve a question the notation
 * already answers was 25 of the seed's warnings and none of them were real.
 */

/**
 * A pass this long is almost certainly a misread, not a play.
 *
 * The court is 500 × 470. A pass spanning more than this is crossing nearly the whole
 * floor, which coaches do not draw and the parser does produce when it misreads the
 * circled possession number on a frame.
 */
export const IMPLAUSIBLE_PASS_UNITS = 320;

type Transfer = {
  beatIdx: number;
  actionId: string;
  from: PlayerId;
  to: PlayerId;
};

function transfersInOrder(play: Play): Transfer[] {
  const out: Transfer[] = [];
  play.beats.forEach((beat, beatIdx) => {
    for (const a of beat.actions) {
      if ((a.type === "pass" || a.type === "handoff") && a.for) {
        out.push({ beatIdx, actionId: a.id, from: a.by, to: a.for });
      }
    }
  });
  return out;
}

export type SuspectTransfer = {
  beatIdx: number;
  actionId: string;
  message: string;
};

/**
 * Ball movement that does not look like basketball. Structured, so it has two users.
 *
 * Both patterns are legal by rules 3–6: a pass explains a possession change whether or
 * not it is the pass that really happened. They are flagged rather than rejected because
 * only a human reading the source page can tell a genuine give-and-go from a parser that
 * misread the circled number on one frame.
 *
 * `validatePlay` turns these into warnings; the quiz generator uses them to refuse to
 * ask questions about a transfer nobody trusts.
 */
export function suspectTransfers(play: Play): SuspectTransfer[] {
  const out: SuspectTransfer[] = [];

  play.beats.forEach((beat, beatIdx) => {
    for (const a of beat.actions) {
      if (a.type !== "pass" && a.type !== "handoff") continue;
      if (!a.for) continue;
      const from = beat.startPos[a.by];
      const to = beat.startPos[a.for];
      if (!from || !to) continue;
      const length = Math.round(dist(from, to));
      if (length > IMPLAUSIBLE_PASS_UNITS) {
        out.push({
          beatIdx,
          actionId: a.id,
          message: `Beat ${beatIdx + 1} (${beat.id}): ${a.type} ${a.by} → ${a.for} spans ${length} units, nearly the width of the floor — check the source frame.`,
        });
      }
    }
  });

  const transfers = transfersInOrder(play);
  for (let i = 1; i < transfers.length; i++) {
    const prev = transfers[i - 1];
    const cur = transfers[i];
    if (cur.from === prev.to && cur.to === prev.from) {
      const message = `Beats ${prev.beatIdx + 1}–${cur.beatIdx + 1}: ball goes ${prev.from} → ${prev.to} → ${prev.from}. A pass straight back is usually a misread possession number.`;
      // Both legs are suspect: neither can be trusted as the pass that really happened.
      out.push({ beatIdx: prev.beatIdx, actionId: prev.actionId, message });
      out.push({ beatIdx: cur.beatIdx, actionId: cur.actionId, message: "" });
    }
  }

  return out;
}

function validateBallPlausibility(play: Play, warnings: string[]): void {
  for (const suspect of suspectTransfers(play)) {
    if (suspect.message) warnings.push(suspect.message);
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
 * Pure validation — spec rules 1–12.
 * @see MASTER-BUILD-PLAN.md
 */
export function validatePlay(play: Play): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!play?.beats?.length) {
    err(errors, "Play has no beats.");
    return { valid: false, errors, warnings };
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
  validateBallPlausibility(play, warnings);

  for (let i = 1; i < play.beats.length; i++) {
    validateBeatTransition(play.beats[i - 1], play.beats[i], i, errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}
