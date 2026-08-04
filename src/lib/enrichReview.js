/** Build crop map key — must match services/importer/interpret.py */
export function cropKey(playName, beatIndex) {
  const safe = [...playName].filter((ch) => /[a-zA-Z0-9-_]/.test(ch)).join("");
  return `${safe}_beat${beatIndex + 1}`;
}

/** Attach play-level breakdown from Stage 3 onto raw import plays (beats key). */
export function applyBreakdownsToRawPlays(plays, breakdowns = {}) {
  return plays.map((play) => {
    const bd = breakdowns[play.name];
    if (!bd) return play;
    return {
      ...play,
      breakdown: bd,
      breakdownStale: false,
      counters: (bd.counters ?? []).map((c) => ({
        trigger: c.trigger,
        answer: c.response,
      })),
    };
  });
}

/** Turn imported play (beat notes + optional breakdown) into review-screen shape. */
export function enrichPlayFromImport(play) {
  const bd = play.breakdown;
  const beatNotes = play.frames.map((f) => f.note).filter(Boolean);

  const purpose =
    bd?.intent?.trim() ||
    play.purpose ||
    (beatNotes.length
      ? beatNotes[0]
      : "Execute spacing and reads; know your role on each beat.");

  let summary;
  if (bd?.intent) {
    const parts = [play.name, bd.intent.trim()];
    if (bd.advantage?.trim()) parts.push(bd.advantage.trim());
    summary = parts.join(" — ");
  } else if (beatNotes.length > 0) {
    summary = `${play.name} — ${play.frames.length}-beat ${(play.category ?? "Set").toLowerCase()}. ${beatNotes[0]}`;
  } else {
    summary = `${play.name} — ${play.frames.length}-beat ${(play.category ?? "Set").toLowerCase()}.`;
  }

  return {
    ...play,
    summary,
    purpose,
    verified: false,
    counters:
      play.counters?.length > 0
        ? play.counters
        : (bd?.counters ?? []).map((c) => ({
            trigger: c.trigger,
            answer: c.response,
          })),
  };
}
