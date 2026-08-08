/**
 * PLAY MODEL LAYER — canonical play shape & editor math
 */

export {
  LINE_TOOLS,
  actionFromStroke,
  beatEndPositions,
  beatStartPositions,
  clampCourt,
  sampleStroke,
  simplifyPath,
} from "@/lib/playModel";

export { normalizeImportedPlay, markBreakdownStale } from "@/lib/normalizePlay";

export {
  actionTimingRows,
  sortBeatActions,
  actionsHaveExplicitOrder,
  reindexBeatActions,
  moveTimingStep,
  mergeStepWithNext,
  splitActionToNewStep,
  appendBeatAction,
  flattenTimingRows,
} from "@/lib/breakdownUtils";

export {
  prepareBeatActions,
  inferBeatActions,
  playerMovedOnBeat,
  ballAtBeatStart,
} from "@/lib/beatActions";
