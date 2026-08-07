import { normalizeImportedPlay } from "@/lib/normalizePlay";

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
    };
  });
}

/** Map breakdown motion type to frame action type. */
const MOTION_ACTION_TYPE = {
  dribble: "dribble",
  pass: "pass",
  handoff: "handoff",
  screen: "screen",
  cut: "cut",
  fill: "cut",
  relocate: "cut",
};

/** Apply breakdown motion order onto frame actions (after AI import). */
export function syncMotionOrderToActions(play) {
  const motions = play.breakdown?.motions;
  const frames = play.frames ?? play.beats;
  if (!motions?.length || !frames?.length) return play;

  const byBeat = {};
  for (const m of motions) {
    const bid = m.beatId ?? m.beat;
    if (!bid) continue;
    if (!byBeat[bid]) byBeat[bid] = [];
    byBeat[bid].push(m);
  }

  const nextFrames = frames.map((frame, idx) => {
    const beatMotions =
      byBeat[frame.id] ?? byBeat[`b${idx + 1}`] ?? [];
    if (!beatMotions.length || !(frame.actions?.length)) return frame;

    const orderByKey = new Map();
    for (const m of beatMotions) {
      const pid = m.playerId ?? m.by;
      const type = MOTION_ACTION_TYPE[m.type] ?? m.type;
      if (pid && type) orderByKey.set(`${pid}:${type}`, m.order);
    }

    const actions = frame.actions.map((a) => {
      const order = orderByKey.get(`${a.by}:${a.type}`);
      return order != null ? { ...a, order } : a;
    });

    return { ...frame, actions };
  });

  if (play.frames) return { ...play, frames: nextFrames };
  if (play.beats) return { ...play, beats: nextFrames };
  return { ...play, frames: nextFrames };
}

/** Turn imported play (beat notes + optional breakdown) into review-screen shape. */
export function enrichPlayFromImport(play) {
  const bd = play.breakdown;
  const normalized = normalizeImportedPlay(play);
  const beatNotes = normalized.frames.map((f) => f.note).filter(Boolean);

  const objective = bd?.intent?.trim();
  const purpose =
    objective ||
    normalized.purpose ||
    (beatNotes.length ? beatNotes[0] : "Know where to go on every beat.");

  let summary;
  if (bd?.intent) {
    summary = `${normalized.name} — ${bd.intent.trim()}`;
  } else if (beatNotes.length > 0) {
    summary = `${normalized.name} — ${normalized.frames.length}-beat ${(normalized.category ?? "Set").toLowerCase()}. ${beatNotes[0]}`;
  } else {
    summary = `${normalized.name} — ${normalized.frames.length}-beat ${(normalized.category ?? "Set").toLowerCase()}.`;
  }

  return {
    ...normalized,
    summary,
    purpose,
    verified: false,
    counters: [],
  };
}
