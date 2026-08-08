/**
 * AI REVIEW LAYER — breakdown schema, enrich, import API
 */

export {
  stripBreakdown,
  mainObjectiveFromBreakdown,
  motionsByBeat,
  formatMotionStep,
} from "@/lib/breakdownUtils";

export { enrichPlayFromImport } from "@/lib/enrichReview";

export { loadAllPlays, attachBreakdown, enrichPlayForQuiz, getPlayByName, hasBreakdown } from "@/lib/playData";

export {
  checkImporterHealth,
  parsePdf as fetchParse,
  interpretPlays as fetchInterpret,
  breakdownPlays as fetchBreakdown,
} from "@/lib/importerApi";

export { getDemoCropsForPlay, hasDemoCrops } from "@/lib/demoCrops";

export {
  validateBeatAnimation,
  validatePlayAnimation,
  animationIssueSummary,
} from "@/lib/validateAnimation";

export { syncMotionOrderToActions, applyBreakdownsToRawPlays } from "@/lib/enrichReview";
