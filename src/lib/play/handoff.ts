import { currentHolder } from "./possession";
import { hitTestPath } from "./drawing";
import { dist } from "./geometry";
import type { Beat, PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";

/**
 * How close a cutter has to come to the ball handler for a handoff to be on.
 *
 * Two token widths plus a little: a handoff happens shoulder to shoulder, and a player
 * running past at arm's length is the whole shape of the action.
 */
export const HANDOFF_RANGE = 42;

export type HandoffCandidate = {
  from: PlayerId;
  to: PlayerId;
  /** Where the exchange happens — the holder's spot at the end of the beat. */
  at: Vec;
};

function movementsFor(beat: Beat, id: PlayerId) {
  return beat.actions.filter(
    (a) =>
      a.by === id &&
      (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
  );
}

function alreadyTransfers(beat: Beat, id: PlayerId): boolean {
  return beat.actions.some(
    (a) => (a.type === "pass" || a.type === "handoff") && a.by === id,
  );
}

function alreadyReceives(beat: Beat, id: PlayerId): boolean {
  return beat.actions.some(
    (a) => (a.type === "pass" || a.type === "handoff") && a.for === id,
  );
}

/**
 * Players running close enough past the ball handler to take the ball from them.
 *
 * The builder offers these rather than waiting to be asked. A dribble handoff is drawn
 * as two things that already exist on the beat — the handler stopping somewhere and a
 * cutter running past them — so the coach has usually finished drawing it before there
 * is anything to click, and the handoff itself is the bit that gets forgotten.
 *
 * Nothing is offered once the ball has left: a handler who has already passed has
 * nothing to hand over.
 */
export function handoffCandidates(beat: Beat): HandoffCandidate[] {
  const holder = currentHolder(beat);
  if (alreadyTransfers(beat, holder)) return [];

  const at = beat.pos[holder] ?? beat.startPos[holder];
  if (!at) return [];

  const out: HandoffCandidate[] = [];

  for (const id of PLAYER_IDS) {
    if (id === holder) continue;
    if (alreadyReceives(beat, id)) continue;

    const movements = movementsFor(beat, id);
    if (!movements.length) continue;

    const passesClose = movements.some((movement) => {
      if (movement.path && movement.path.length >= 2) {
        return hitTestPath(at, movement.path, HANDOFF_RANGE);
      }
      const from = beat.startPos[id];
      const to = beat.pos[id];
      return Boolean(from && to && hitTestPath(at, [from, to], HANDOFF_RANGE));
    });

    if (passesClose) out.push({ from: holder, to: id, at: { ...at } });
  }

  // Nearest first: the closest runner is the likeliest exchange.
  return out.sort(
    (a, b) =>
      dist(beat.pos[a.to] ?? beat.startPos[a.to], a.at) -
      dist(beat.pos[b.to] ?? beat.startPos[b.to], b.at),
  );
}
