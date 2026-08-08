import { reindexBeatActions } from "@/lib/breakdownUtils";
import { sanitizeFrameActions } from "@/lib/beatActions";

function finalizeFrameActions(frame) {
  return {
    ...frame,
    actions: reindexBeatActions(sanitizeFrameActions(frame.actions ?? [], frame.ball)),
    inferMoves: false,
  };
}

/** Map imported play JSON (beats) to the app's Play shape (frames). */
export function normalizeImportedPlay(raw) {
  const beats = raw.beats ?? raw.frames ?? [];
  const frames = beats.map(({ _source, ...beat }) => ({
    ...beat,
    needs_review: beat.needs_review ?? false,
    review_reason: beat.review_reason ?? null,
    animation_issues: beat.animation_issues ?? null,
    confidence: beat.confidence ?? null,
    actions: beat.actions ?? [],
  }));
  return {
    name: raw.name,
    category: raw.category ?? "Set",
    frames: frames.map(finalizeFrameActions),
    counters: raw.counters ?? [],
    breakdown: raw.breakdown ?? null,
    breakdownStale: raw.breakdownStale ?? false,
    purpose: raw.purpose,
    summary: raw.summary,
  };
}

/** Call when coach edits beats/actions — triggers breakdown regeneration. */
export function markBreakdownStale(play) {
  if (!play?.breakdown) return play;
  return { ...play, breakdownStale: true };
}
