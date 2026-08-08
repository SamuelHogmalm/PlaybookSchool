import {
  attachBreakdown,
  enrichPlayForQuiz,
} from "@/lib/playData";
import interpretedPlays from "@/data/plays-interpreted.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { ACTION_TYPES, uid } from "@/lib/playModel";

export const VERIFY_STORAGE_KEY = "ps-verify-overlay";

const BASE_PLAYS = interpretedPlays.map(normalizeImportedPlay).map(attachBreakdown).map(enrichPlayForQuiz);

function emptyOverlay() {
  return { version: 1, verified: {}, patches: {} };
}

/** @returns {{ version: number, verified: Record<string, boolean>, patches: Record<string, { frames?: object[] }> }} */
export function loadOverlay() {
  if (typeof window === "undefined") return emptyOverlay();
  try {
    const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      verified: parsed.verified ?? {},
      patches: parsed.patches ?? {},
    };
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay(overlay) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    /* quota */
  }
}

function beatKey(playName, beatId) {
  return `${playName}:${beatId}`;
}

export function isBeatVerified(playName, beatId, overlay = loadOverlay()) {
  return !!overlay.verified[beatKey(playName, beatId)];
}

/** Merge local patches onto base interpreted plays. */
export function mergePlays(overlay = loadOverlay()) {
  return BASE_PLAYS.map((play) => {
    const patch = overlay.patches[play.name];
    const frames = play.frames.map((frame, i) => {
      const pf = patch?.frames?.[i];
      if (!pf) {
        return {
          ...frame,
          actions: (frame.actions ?? []).map((a) => ({ ...a })),
        };
      }
      return {
        ...frame,
        ...pf,
        ball: pf.ball ?? frame.ball,
        note: pf.note !== undefined ? pf.note : frame.note ?? "",
        actions:
          pf.actions !== undefined
            ? pf.actions.map((a) => ({ ...a }))
            : (frame.actions ?? []).map((a) => ({ ...a })),
      };
    });
    return { ...play, frames };
  });
}

export function getBasePlays() {
  return BASE_PLAYS;
}

export function exportForPromotion(plays) {
  return plays.map((play) => {
    const row = {
      name: play.name,
      category: play.category ?? "Set",
      beats: play.frames.map(({ id, pos, ball, actions, note, needs_review, review_reason, animation_issues }) => {
        const beat = {
          id,
          pos,
          ball,
        actions: (actions ?? []).map(({ id: aid, type, by, for: fo, path, order, uncertain, reason }) => {
          const a = { id: aid, type, by };
          if (fo != null) a.for = fo;
          if (path?.length) a.path = path;
          if (order != null) a.order = order;
          if (uncertain) a.uncertain = true;
          if (reason) a.reason = reason;
          return a;
        }),
          note: note ?? "",
        };
        if (needs_review) beat.needs_review = true;
        if (review_reason) beat.review_reason = review_reason;
        if (animation_issues?.length) beat.animation_issues = animation_issues;
        return beat;
      }),
      counters: play.counters ?? [],
    };
    if (play.breakdown && !play.breakdownStale) {
      row.breakdown = play.breakdown;
    }
    if (play.purpose) row.purpose = play.purpose;
    if (play.summary) row.summary = play.summary;
    return row;
  });
}

export function countVerifyStats(plays, overlay = loadOverlay()) {
  let total = 0;
  let verified = 0;
  const byPlay = {};

  for (const play of plays) {
    let pTotal = play.frames.length;
    let pVerified = 0;
    for (const frame of play.frames) {
      total += 1;
      if (overlay.verified[beatKey(play.name, frame.id)]) {
        verified += 1;
        pVerified += 1;
      }
    }
    byPlay[play.name] = { total: pTotal, verified: pVerified };
  }

  return { total, verified, byPlay };
}

export function patchBeat(playName, beatIndex, framePatch, overlay) {
  const basePlay = BASE_PLAYS.find((p) => p.name === playName);
  const frameCount = basePlay?.frames.length ?? 0;
  const prevFrames = overlay.patches[playName]?.frames ?? [];
  const frames = [...prevFrames];
  while (frames.length < frameCount) frames.push(undefined);

  frames[beatIndex] = { ...(frames[beatIndex] ?? {}), ...framePatch };

  return {
    ...overlay,
    patches: {
      ...overlay.patches,
      [playName]: { frames },
    },
  };
}

export function setBeatVerifiedFlag(playName, beatId, verified, overlay) {
  const key = beatKey(playName, beatId);
  const next = {
    ...overlay,
    verified: { ...overlay.verified, [key]: verified },
  };
  if (!verified) delete next.verified[key];
  return next;
}

export function clearOverlay() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VERIFY_STORAGE_KEY);
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { ACTION_TYPES, uid };
