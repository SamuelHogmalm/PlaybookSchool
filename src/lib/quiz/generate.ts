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

/** Short phrase for an action, for multiple-choice options. */
function describeAction(action: {
  type: string;
  by: PlayerId;
  for?: PlayerId;
}): string {
  switch (action.type) {
    case "screen":
      return `Player ${action.by} screens for ${action.for}`;
    case "pass":
      return `Player ${action.by} passes to ${action.for}`;
    case "handoff":
      return `Player ${action.by} hands off to ${action.for}`;
    case "dribble":
      return `Player ${action.by} dribbles`;
    default:
      return `Player ${action.by} cuts`;
  }
}

/**
 * "What does player X do next?"
 *
 * Only asked about a player with exactly one action on the beat, so the answer cannot
 * be argued with. Distractors are never invented: another player's real action on the
 * same beat, or the same player's real action from a different one.
 */
export function generateNextActions(play: Play, rng: Rng): ChoiceQuestion[] {
  const out: ChoiceQuestion[] = [];
  const suspect = new Set(suspectTransfers(play).map((s) => s.actionId));

  play.beats.forEach((beat, beatIndex) => {
    // Needs a lead-in: "what happens next" is meaningless from a standing start.
    if (beatIndex === 0) return;

    for (const id of PLAYER_IDS) {
      const mine = beat.actions.filter((a) => a.by === id);
      if (mine.length !== 1) continue;
      const answer = mine[0];
      if (!isTrustworthy(answer) || suspect.has(answer.id)) continue;

      const elsewhere = play.beats
        .flatMap((b, i) => (i === beatIndex ? [] : b.actions))
        .filter((a) => a.by === id && isTrustworthy(a));
      const others = beat.actions.filter(
        (a) => a.by !== id && isTrustworthy(a),
      );

      const answerLabel = describeAction(answer);
      const seen = new Set([answerLabel]);
      const distractors: string[] = [];
      for (const candidate of [...elsewhere, ...others]) {
        const label = describeAction(candidate);
        if (seen.has(label)) continue;
        seen.add(label);
        distractors.push(label);
        if (distractors.length === 3) break;
      }
      if (distractors.length < 2) continue;

      const choices = shuffle(
        [answerLabel, ...distractors].map((label, i) => ({
          id: `c${i}`,
          label,
        })),
        rng,
      );

      out.push({
        id: `${play.id}-${beat.id}-${id}-next`,
        playId: play.id,
        playName: play.name,
        type: "next-action",
        askAtBeat: beatIndex,
        revealToBeat: beatIndex,
        subject: id,
        prompt: `What does player ${id} do next?`,
        choices,
        answerId: choices.find((c) => c.label === answerLabel)!.id,
      });
    }
  });

  return out;
}

/**
 * "Which play is this?" — the whole thing animates with the name hidden.
 *
 * One per play, and only where there are enough other plays to choose from; three
 * options drawn from the same playbook is the minimum that tests recognition rather
 * than elimination.
 */
export function generateIdentify(
  play: Play,
  playbook: Play[],
  rng: Rng,
): ChoiceQuestion[] {
  const others = playbook.filter((p) => p.valid && p.id !== play.id);
  if (others.length < 3) return [];

  const picked = shuffle(others, rng).slice(0, 3);
  const choices = shuffle(
    [play, ...picked].map((p) => ({ id: p.id, label: p.name })),
    rng,
  );

  return [
    {
      id: `${play.id}-identify`,
      playId: play.id,
      playName: play.name,
      type: "identify",
      askAtBeat: play.beats.length - 1,
      revealToBeat: play.beats.length - 1,
      prompt: "Which play is this?",
      choices,
      answerId: play.id,
    },
  ];
}

/**
 * Every question a play can currently produce.
 *
 * Invalid plays are skipped outright — never quiz on a play that does not validate.
 * `playbook` is only needed for questions that draw options from other plays.
 */
export function generateForPlay(
  play: Play,
  seed = seedFrom(play.id),
  playbook: Play[] = [],
): Question[] {
  if (!play.valid) return [];
  const rng = makeRng(seed);
  return [
    ...generatePassTargets(play, rng),
    ...generateNextActions(play, rng),
    ...generateIdentify(play, playbook, rng),
    ...generateSpots(play, rng),
  ];
}

export function generateForPlays(plays: Play[], seed?: number): Question[] {
  return plays.flatMap((play) =>
    generateForPlay(
      play,
      seed === undefined ? undefined : seed + seedFrom(play.id),
      plays,
    ),
  );
}

export { pick };
