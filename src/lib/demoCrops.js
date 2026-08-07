import demoCrops from "@/data/demo-crops.json";
import { cropKey } from "@/lib/enrichReview";

/** Demo PDF crops bundled for review-demo (Alabama beats from sample parse). */
export function getDemoCropsForPlay(playName) {
  const out = {};
  for (let i = 0; i < 8; i += 1) {
    const key = cropKey(playName, i);
    if (demoCrops[key]) out[key] = demoCrops[key];
  }
  return out;
}

export function hasDemoCrops(playName) {
  return !!demoCrops[cropKey(playName, 0)];
}
