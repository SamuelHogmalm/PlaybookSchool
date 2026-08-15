import type { Play, PlayerId } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import { dist } from "@/lib/play/geometry";
import { suspectTransfers } from "@/lib/play/validation";

import { makeRng, pick, seedFrom, shuffle, type Rng } from "./random";
import type { ChoiceQuestion, Question, SpotQuestion } from "./types";

/** Correct within this many court units. We check they know where to go, not tracing. */
export const SPOT_TOLERANCE = 70;

/** Options must be plausible: nothing closer together than this is worth asking. */
const MIN_DISTRACTOR_SEPARATION = 40;

function playerLabel(id: PlayerId): string {
  return `Player ${id}`;
}

/**
 * Who could plausibly have received this pass.
 *
 * Never random. Preference goes to players who catch a pass somewhere else in the play —
 * a distractor that never receives anything is one a player can rule out without knowing
 * the play, which teaches nothing.
 */
function passDistractors(
  play: Play,
  beatIndex: number,
  passer: PlayerId,
  receiver: PlayerId,
): PlayerId[] {
  const beat = play.beats[beatIndex];
  const receivesElsewhere = new Set<PlayerId>();
  for (const b of play.beats) {
    for (const a of b.actions) {
      if ((a.type === "pass" || a.type === "handoff") && a.for) {
        receivesElsewhere.add(a.for);
      }
    }
  }

  const onCourt = PLAYER_IDS.filter(
    (id) => id !== passer && id !== receiver && beat.startPos[id],
  );

  const preferred = onCourt.filter((id) => receivesElsewhere.has(id));
  const rest = onCourt.filter((id) => !receivesElsewhere.has(id));
  return [...preferred, ...rest];
}

/**
 * An action the pipeline guessed is not something to quiz a player on.
 *
 * `derived` means `derive.py` invented it because the AI missed one; `needsReview`
 * means the AI was unsure. Either way nobody has confirmed it against the source page,
 * and a player who memorises a guess has been taught something wrong.
 */
function isTrustworthy(action: { derived?: boolean; needsReview?: boolean }): boolean {
  return !action.derived && !action.needsReview;
}

/**
 * "Who gets the ball?" — one per pass in the play.
 *
 * The reveal runs through the end of the beat so the player sees the ball actually
 * arrive, which is the rep they are here for.
 */
export function generatePassTargets(play: Play, rng: Rng): ChoiceQuestion[] {
  const out: ChoiceQuestion[] = [];

  // Anything validation calls implausible — a cross-court pass, a ball bouncing
  // straight back — is not a fact to test someone on.
  const suspect = new Set(suspectTransfers(play).map((s) => s.actionId));

  play.beats.forEach((beat, beatIndex) => {
    for (const action of beat.actions) {
      if (action.type !== "pass" && action.type !== "handoff") continue;
      if (!action.for) continue;
      if (!isTrustworthy(action)) continue;
      if (suspect.has(action.id)) continue;

      // The answer has to be something the player can see happen. Where the ball moves
      // on again inside the same beat — Relax beat 2 sends it 3 → 1 → 3 — the receiver
      // never visibly holds it, and the "correct" answer looks wrong to anyone watching.
      if (beat.ball !== action.for) continue;

      const distractors = passDistractors(play, beatIndex, action.by, action.for);
      if (distractors.length < 2) continue;

      const chosen = distractors.slice(0, 3);
      const choices = shuffle(
        [action.for, ...chosen].map((id) => ({
          id,
          label: playerLabel(id),
          playerId: id,
        })),
        rng,
      );

      out.push({
        id: `${play.id}-${beat.id}-${action.id}-pass-target`,
        playId: play.id,
        playName: play.name,
        type: "pass-target",
        askAtBeat: beatIndex,
        revealToBeat: beatIndex,
        subject: action.by,
        prompt: `Player ${action.by} ${
          action.type === "handoff" ? "hands off" : "passes"
        } — who gets the ball?`,
        choices,
        answerId: action.for,
      });
    }
  });

  return out;
}

/**
 * "Tap where you belong."
 *
 * Only asked where the answer is unambiguous: if another player stands within the
 * grading tolerance, a correct tap could land on the wrong person and still pass, so
 * the question is not worth asking.
 */
export function generateSpots(play: Play, rng: Rng): SpotQuestion[] {
  const out: SpotQuestion[] = [];

  play.beats.forEach((beat, beatIndex) => {
    for (const id of PLAYER_IDS) {
      const spot = beat.startPos[id];
      if (!spot) continue;

      const crowded = PLAYER_IDS.some(
        (other) =>
          other !== id &&
          beat.startPos[other] &&
          dist(spot, beat.startPos[other]) < MIN_DISTRACTOR_SEPARATION,
      );
      if (crowded) continue;

      out.push({
        id: `${play.id}-${beat.id}-${id}-spot`,
        playId: play.id,
        playName: play.name,
        type: "spot",
        askAtBeat: beatIndex,
        // Reveal runs on into the next beat so they see what the spot was *for*.
        revealToBeat: Math.min(beatIndex + 1, play.beats.length - 1),
        subject: id,
        prompt:
          beatIndex === 0
            ? `Where does player ${id} line up to start?`
            : `Beat ${beatIndex + 1}: where should player ${id} be?`,
        answer: { x: spot.x, y: spot.y },
        tolerance: SPOT_TOLERANCE,
      });
    }
  });

  return shuffle(out, rng);
}

/**
 * Every question a play can currently produce.
 *
 * Invalid plays are skipped outright — never quiz on a play that does not validate.
 */
export function generateForPlay(play: Play, seed = seedFrom(play.id)): Question[] {
  if (!play.valid) return [];
  const rng = makeRng(seed);
  return [...generatePassTargets(play, rng), ...generateSpots(play, rng)];
}

export function generateForPlays(plays: Play[], seed?: number): Question[] {
  return plays.flatMap((play) =>
    generateForPlay(play, seed === undefined ? undefined : seed + seedFrom(play.id)),
  );
}

export { pick };
