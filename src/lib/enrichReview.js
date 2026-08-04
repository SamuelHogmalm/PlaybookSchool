/** Build crop map key — must match services/importer/interpret.py */
export function cropKey(playName, beatIndex) {
  const safe = [...playName].filter((ch) => /[a-zA-Z0-9-_]/.test(ch)).join("");
  return `${safe}_beat${beatIndex + 1}`;
}

/** Turn imported play (with AI beat notes) into review-screen shape. */
export function enrichPlayFromImport(play) {
  const beatNotes = play.frames.map((f) => f.note).filter(Boolean);
  const summary =
    beatNotes.length > 0
      ? `${play.name} — ${play.frames.length}-beat ${play.category.toLowerCase()}. ${beatNotes[0]}`
      : `${play.name} — ${play.frames.length}-beat ${play.category.toLowerCase()}.`;

  return {
    ...play,
    summary,
    purpose: "Execute spacing and reads; know your role on each beat.",
    verified: false,
    counters: play.counters?.length ? play.counters : [],
  };
}
