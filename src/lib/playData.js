/**
 * Canonical play data: interpreted beats + optional AI breakdowns + review fields.
 * Player app, quiz, and verify all read from here.
 */

import interpretedPlays from "@/data/plays-interpreted.json";
import playBreakdowns from "@/data/plays-breakdowns.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { enrichPlayFromImport } from "@/lib/enrichReview";

/** Attach sidecar breakdown JSON onto a normalized play. */
export function attachBreakdown(play) {
  const bd = playBreakdowns[play.name];
  if (!bd) return play;
  return {
    ...play,
    breakdown: bd,
    breakdownStale: bd.breakdownStale ?? false,
    counters:
      play.counters?.length > 0
        ? play.counters
        : (bd.counters ?? []).map((c) => ({
            trigger: c.trigger,
            answer: c.response ?? c.answer,
            response: c.response ?? c.answer,
          })),
  };
}

/** Full enrich for quiz + player (purpose, summary, counters from breakdown). */
export function enrichPlayForQuiz(play) {
  return enrichPlayFromImport(play);
}

/** All plays with beats, breakdown (when available), purpose, and summary. */
export function loadAllPlays() {
  return interpretedPlays.map(normalizeImportedPlay).map(attachBreakdown).map(enrichPlayForQuiz);
}

export function getPlayByName(name, plays = loadAllPlays()) {
  return plays.find((p) => p.name === name) ?? null;
}

export function hasBreakdown(play) {
  return !!(play?.breakdown && !play.breakdownStale);
}

export function breakdownStats(plays = loadAllPlays()) {
  const withBd = plays.filter((p) => hasBreakdown(p)).length;
  return { total: plays.length, withBreakdown: withBd };
}
