/** Breakdown schema helpers — motions, action ordering. */

export const ACTION_TYPE_ORDER = {
  dribble: 1,
  pass: 2,
  handoff: 2,
  screen: 3,
  cut: 4,
  fill: 4,
  relocate: 4,
};

const STAGE_TYPES = {
  dribble: ["dribble"],
  ball: ["pass", "handoff"],
  screen: ["screen"],
  move: ["cut", "fill", "relocate"],
};

/** Rank for sorting — explicit order wins, else type-based default. */
export function actionOrderRank(action) {
  if (action?.order != null && !Number.isNaN(Number(action.order))) {
    return Number(action.order);
  }
  return ACTION_TYPE_ORDER[action?.type] ?? 99;
}

/** Sort beat actions: dribble → pass/ball → screen → cut/fill. */
export function sortBeatActions(actions = []) {
  return [...actions].sort((a, b) => {
    const oa = actionOrderRank(a);
    const ob = actionOrderRank(b);
    if (oa !== ob) return oa - ob;
    const ta = ACTION_TYPE_ORDER[a.type] ?? 99;
    const tb = ACTION_TYPE_ORDER[b.type] ?? 99;
    return ta - tb;
  });
}

export function stageKeyForType(type) {
  if (type === "dribble") return "dribble";
  if (type === "pass" || type === "handoff") return "ball";
  if (type === "screen") return "screen";
  return "move";
}

/** Actions belonging to one staged window, sorted by order. */
export function actionsInStage(actions, stageKey) {
  const types = STAGE_TYPES[stageKey] ?? [];
  return sortBeatActions(
    actions.filter((a) => {
      if (stageKey === "move") {
        return !["dribble", "pass", "handoff", "screen"].includes(a.type);
      }
      return types.includes(a.type);
    })
  );
}

/** Group breakdown motions by beat id (b1, b2, …). */
export function motionsByBeat(breakdown) {
  const map = new Map();
  for (const m of breakdown?.motions ?? []) {
    const beatId = m.beatId ?? m.beat ?? "b1";
    if (!map.has(beatId)) map.set(beatId, []);
    map.get(beatId).push(m);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }
  return map;
}

/** Main objective — the shot we are hunting. Ignores legacy reads/mainReads arrays. */
export function mainObjectiveFromBreakdown(breakdown) {
  if (!breakdown) return null;
  if (breakdown.intent?.trim()) return breakdown.intent.trim();
  return null;
}

/** Coach-set timing rows — same `order` = same step (parallel). */
export function actionTimingRows(actions = []) {
  const map = new Map();
  for (const a of actions) {
    const o = actionOrderRank(a);
    if (!map.has(o)) map.set(o, []);
    map.get(o).push(a);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, items], idx) => ({
      step: idx + 1,
      items: sortBeatActions(items),
    }));
}

export function flattenTimingRows(rows) {
  const out = [];
  rows.forEach((row, i) => {
    const step = i + 1;
    for (const a of row.items) {
      out.push({ ...a, order: step });
    }
  });
  return out;
}

export function reindexBeatActions(actions = []) {
  const rows = actionTimingRows(actions).map((r) => ({ items: [...r.items] }));
  return flattenTimingRows(rows);
}

/** New drawn line starts its own step at the end. */
export function appendBeatAction(actions = [], action) {
  const step = actionTimingRows(actions).length + 1;
  return reindexBeatActions([...actions, { ...action, order: step }]);
}

export function moveTimingStep(actions, stepIndex, direction) {
  const rows = actionTimingRows(actions).map((r) => ({ items: [...r.items] }));
  const target = stepIndex + direction;
  if (target < 0 || target >= rows.length) return actions;
  [rows[stepIndex], rows[target]] = [rows[target], rows[stepIndex]];
  return flattenTimingRows(rows);
}

/** Merge this step with the one below — they run at the same time. */
export function mergeStepWithNext(actions, stepIndex) {
  const rows = actionTimingRows(actions).map((r) => ({ items: [...r.items] }));
  if (stepIndex < 0 || stepIndex >= rows.length - 1) return actions;
  rows[stepIndex].items.push(...rows[stepIndex + 1].items);
  rows.splice(stepIndex + 1, 1);
  return flattenTimingRows(rows);
}

/** Pull one move out of a shared step into its own step below. */
export function splitActionToNewStep(actions, actionId) {
  const rows = actionTimingRows(actions).map((r) => ({ items: [...r.items] }));
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].items.findIndex((a) => a.id === actionId);
    if (j < 0) continue;
    if (rows[i].items.length === 1) return actions;
    const [item] = rows[i].items.splice(j, 1);
    rows.splice(i + 1, 0, { items: [item] });
    return flattenTimingRows(rows);
  }
  return actions;
}

export function actionsHaveExplicitOrder(actions = []) {
  return actions.some((a) => a.order != null && !Number.isNaN(Number(a.order)));
}

/** Keep only intent + motions from AI breakdown. */
export function stripBreakdown(bd) {
  if (!bd || typeof bd !== "object") return bd;
  const out = {
    intent: bd.intent?.trim() || "",
    motions: Array.isArray(bd.motions) ? bd.motions : [],
  };
  if (bd.breakdownStale != null) out.breakdownStale = bd.breakdownStale;
  if (bd.breakdownModel) out.breakdownModel = bd.breakdownModel;
  return out;
}

/** @deprecated use stripBreakdown */
export function stripLegacyReadsFromBreakdown(bd) {
  return stripBreakdown(bd);
}

/** @deprecated unused — quiz no longer asks main-look MC */
export function mainReadsFromBreakdown(breakdown) {
  const obj = mainObjectiveFromBreakdown(breakdown);
  return obj ? [obj] : [];
}

const MOTION_TYPE_LABEL = {
  dribble: "Dribble",
  pass: "Pass",
  handoff: "Handoff",
  screen: "Screen",
  cut: "Cut",
  fill: "Fill",
  relocate: "Relocate",
};

export function formatMotionStep(motion) {
  const type = MOTION_TYPE_LABEL[motion.type] ?? motion.type ?? "Move";
  const who = motion.playerId ? `#${motion.playerId}` : "";
  const text = motion.description ?? motion.text ?? "";
  return { type, who, text, order: motion.order };
}
