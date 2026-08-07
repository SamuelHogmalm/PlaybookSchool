/**
 * Dev-only: summarize frame actions as text for /dev/animator debug table.
 * Playback uses @/lib/animation — not this file.
 */
import { IDS as PLAYER_IDS } from "../playModel.js";

export { PLAYER_IDS };

export function describeBeatActions(play, beatIdx) {
  const frame = play?.frames?.[beatIdx];
  const actions = frame?.actions ?? [];
  const byPlayer = Object.fromEntries(PLAYER_IDS.map((id) => [id, "still"]));

  for (const a of actions) {
    if (!a?.by) continue;
    const t = a.type ?? "cut";
    if (t === "screen") byPlayer[a.by] = `SCREEN${a.for ? ` for ${a.for}` : ""}`;
    else byPlayer[a.by] = t.toUpperCase();
  }

  return byPlayer;
}

export function formatBeatLine(play, beatIdx) {
  const d = describeBeatActions(play, beatIdx);
  const parts = PLAYER_IDS.map((id) => `${id} ${d[id]}`);
  return `beat ${beatIdx + 1}: ${parts.join(" | ")}`;
}

export function formatAllBeatLines(play) {
  const frames = play?.frames ?? [];
  return frames.map((_, i) => formatBeatLine(play, i));
}

export function debugPlayerRowsFromActions(play, beatIdx) {
  const d = describeBeatActions(play, beatIdx);
  return PLAYER_IDS.map((id) => ({
    id,
    x: null,
    y: null,
    moving: d[id] !== "still",
    action: d[id].toLowerCase().split(" ")[0],
    screenFor: d[id].includes("for") ? d[id].split("for ")[1] : null,
  }));
}
