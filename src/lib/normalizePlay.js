/** Map imported play JSON (beats) to the app's Play shape (frames). */
export function normalizeImportedPlay(raw) {
  const beats = raw.beats ?? raw.frames ?? [];
  return {
    name: raw.name,
    category: raw.category ?? "Set",
    frames: beats.map(({ _source, ...beat }) => beat),
    counters: raw.counters ?? [],
  };
}
