/** Map imported play JSON (beats) to the app's Play shape (frames). */
export function normalizeImportedPlay(raw) {
  const beats = raw.beats ?? raw.frames ?? [];
  return {
    name: raw.name,
    category: raw.category ?? "Set",
    frames: beats.map(({ _source, ...beat }) => beat),
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
