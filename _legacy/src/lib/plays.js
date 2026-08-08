import { loadAllPlays, getPlayByName as findPlay } from "@/lib/playData";

export const allPlays = loadAllPlays();

export function getPlayByName(name) {
  return findPlay(name, allPlays);
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
