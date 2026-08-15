import type { Play } from "@/lib/play/types";
import { suspectTransfers, validatePlay } from "@/lib/play/validation";

export type FlaggedAction = {
  beatIndex: number;
  actionId: string;
  /** Shown next to the action on the court. Short enough to read at a glance. */
  why: string;
};

export type PlayReview = {
  playId: string;
  name: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalActions: number;
  derivedCount: number;
  needsReviewCount: number;
  /**
   * 0–1, higher is more trustworthy.
   *
   * An ordering heuristic, not a measurement. Its only job is to put the play most
   * likely to be wrong in front of the coach first; the exact number is not meaningful
   * and should never be shown as a percentage.
   */
  confidence: number;
  flagged: FlaggedAction[];
};

/** Weights chosen so an invented action costs more than an unsure one. */
const DERIVED_WEIGHT = 0.5;
const NEEDS_REVIEW_WEIGHT = 0.3;
const WARNING_WEIGHT = 0.06;

export function reviewPlay(play: Play): PlayReview {
  const { valid, errors, warnings } = validatePlay(play);

  let totalActions = 0;
  let derivedCount = 0;
  let needsReviewCount = 0;
  const flagged: FlaggedAction[] = [];

  play.beats.forEach((beat, beatIndex) => {
    for (const action of beat.actions) {
      totalActions++;
      if (action.derived) {
        derivedCount++;
        flagged.push({
          beatIndex,
          actionId: action.id,
          why: action.reason
            ? `Added by the importer — ${action.reason}`
            : "Added by the importer, not read from the page",
        });
        continue;
      }
      if (action.needsReview) {
        needsReviewCount++;
        flagged.push({
          beatIndex,
          actionId: action.id,
          why: action.reason ?? "The importer was unsure about this one",
        });
      }
    }
  });

  // Action ids are only unique within a beat — "a1" exists on most of them — so the
  // identity of a flag is the pair, not the id.
  const key = (beatIndex: number, actionId: string) => `${beatIndex}:${actionId}`;
  const seen = new Set(flagged.map((f) => key(f.beatIndex, f.actionId)));

  for (const suspect of suspectTransfers(play)) {
    if (seen.has(key(suspect.beatIdx, suspect.actionId))) continue;
    seen.add(key(suspect.beatIdx, suspect.actionId));
    flagged.push({
      beatIndex: suspect.beatIdx,
      actionId: suspect.actionId,
      why: suspect.message || "This pass does not look like basketball",
    });
  }

  const ratio = (n: number) => (totalActions ? n / totalActions : 0);
  const raw =
    1 -
    DERIVED_WEIGHT * ratio(derivedCount) -
    NEEDS_REVIEW_WEIGHT * ratio(needsReviewCount) -
    WARNING_WEIGHT * warnings.length;

  return {
    playId: play.id,
    name: play.name,
    valid,
    errors,
    warnings,
    totalActions,
    derivedCount,
    needsReviewCount,
    // A play that does not validate goes to the front regardless of anything else.
    confidence: valid ? Math.max(0, Math.min(1, raw)) : 0,
    flagged,
  };
}

/**
 * Every play, worst first.
 *
 * Ties break on name so the order is stable between runs — a review queue that
 * reshuffles itself while the coach works through it would be maddening.
 */
export function reviewPlaybook(plays: Play[]): PlayReview[] {
  return plays
    .map(reviewPlay)
    .sort((a, b) => a.confidence - b.confidence || a.name.localeCompare(b.name));
}

/** Nothing left for a human to look at. */
export function isClean(review: PlayReview): boolean {
  return review.valid && review.flagged.length === 0 && review.warnings.length === 0;
}
