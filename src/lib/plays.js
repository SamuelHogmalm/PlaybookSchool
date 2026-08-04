import importedPlays from "@/data/plays.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";

export const allPlays = importedPlays.map(normalizeImportedPlay);

export function getPlayByName(name) {
  return allPlays.find((p) => p.name === name) ?? null;
}

export const heroPlay = getPlayByName("Alabama") ?? allPlays[0];

export function groupPlaysByCategory(plays = allPlays) {
  const groups = {};
  for (const play of plays) {
    const cat = play.category || "Set";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(play);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}
