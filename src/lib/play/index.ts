export type {
  Action,
  ActionType,
  Beat,
  Play,
  PlayerId,
  SeedPlay,
  ValidationResult,
  Vec,
} from "./types";

export {
  ACTION_TYPES,
  PLAYER_IDS,
} from "./types";

export {
  COURT_HEIGHT,
  COURT_MARGIN,
  COURT_WIDTH,
  MAX_BEAT_MOVE,
  MAX_IDLE_MOVE,
  MAX_SCREENER_MOVE,
  dist,
  isOnCourt,
  isPlayerId,
  playerMove,
} from "./geometry";

export { normalizeSeedPlay } from "./normalize";
export { validatePlay } from "./validation";
export {
  addBeat,
  applyPresetToBeat,
  createEmptyPlay,
  deleteBeat,
  duplicateBeat,
  linkBeatPositions,
  linkBeatBall,
  reorderBeat,
  setPlayBeats,
  updateBeatPlayerPos,
} from "./beatOps";
export {
  ALIGNMENT_PRESETS,
  clientToCourt,
  clampToCourt,
  copyPositions,
  GRID_SIZE,
  PRESET_NAMES,
  snapClampPoint,
  snapPoint,
  snapToGrid,
  type AlignmentPresetName,
} from "./editor";
export {
  addDrawnAction,
  confirmAction,
  confirmPlayActions,
  isValidDraw,
  removeAction,
  type DrawnActionInput,
} from "./actionOps";
export {
  actionHitPaths,
  canDrawAction,
  DRAW_TOOLS,
  hitTestPath,
  MAX_PATH_POINTS,
  MIN_DRAW_LENGTH,
  nearestPlayerAt,
  pathLength,
  simplifyPath,
  type BuilderTool,
  type DrawActionGate,
} from "./drawing";
