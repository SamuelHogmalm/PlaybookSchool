/** Shared play model helpers — presets, paths, action creation from drawn strokes */

export const IDS = ["1", "2", "3", "4", "5"];

export const ACTION_TYPES = [
  { id: "screen", label: "Screen", needs: ["by", "for"], color: "screen", hint: "Drag from screener to screen spot" },
  { id: "cut", label: "Cut", needs: ["by"], color: "cut", hint: "Drag the player's route" },
  { id: "dribble", label: "Dribble", needs: ["by"], color: "ball", hint: "Drag the dribble path" },
  { id: "pass", label: "Pass", needs: ["by", "for"], color: "ball", hint: "Drag from passer to receiver", dashed: true },
  { id: "handoff", label: "Handoff", needs: ["by", "for"], color: "ball", hint: "Drag from handler to receiver", dashed: "short" },
];

export const LINE_TOOLS = [
  { id: "cut", label: "Cut", sample: "solid", color: "cut", hint: "Draw from player to where they cut" },
  { id: "dribble", label: "Dribble", sample: "wavy", color: "ball", hint: "Draw the dribble path" },
  { id: "pass", label: "Pass", sample: "dashed", color: "ball", hint: "Draw from passer to receiver" },
  { id: "screen", label: "Screen", sample: "screen", color: "screen", hint: "Draw screener's path — ends with T-bar" },
  { id: "handoff", label: "Handoff", sample: "short-dash", color: "ball", hint: "Draw from handler to receiver" },
];

/** @deprecated use LINE_TOOLS — kept for imports */
export const DRAW_TOOLS = LINE_TOOLS;

export const CATEGORIES = [
  "Set",
  "Transition",
  "BLOB",
  "SLOB",
  "Press Break",
  "Zone Offense",
  "Defense",
];

export const ALIGNMENT_PRESETS = {
  Horns: {
    1: { x: 250, y: 400 },
    2: { x: 45, y: 62 },
    3: { x: 455, y: 62 },
    4: { x: 180, y: 195 },
    5: { x: 320, y: 195 },
  },
  "4-Out 1-In": {
    1: { x: 250, y: 380 },
    2: { x: 55, y: 120 },
    3: { x: 445, y: 120 },
    4: { x: 120, y: 280 },
    5: { x: 250, y: 200 },
  },
  "5-Out": {
    1: { x: 250, y: 380 },
    2: { x: 55, y: 100 },
    3: { x: 445, y: 100 },
    4: { x: 120, y: 300 },
    5: { x: 380, y: 300 },
  },
  Box: {
    1: { x: 250, y: 380 },
    2: { x: 180, y: 280 },
    3: { x: 320, y: 280 },
    4: { x: 180, y: 180 },
    5: { x: 320, y: 180 },
  },
  "1-4 High": {
    1: { x: 250, y: 400 },
    2: { x: 80, y: 140 },
    3: { x: 420, y: 140 },
    4: { x: 160, y: 140 },
    5: { x: 340, y: 140 },
  },
};

export const COUNTER_EXAMPLES = [
  { trigger: "Your defender goes UNDER the ball screen", answer: "Rise up into the pull-up three — don't turn the corner" },
  { trigger: "X5 hedges hard on the ball screen", answer: "5 slips early, hit the pocket pass in the short roll" },
  { trigger: "Help rotates to the roller", answer: "Skip it to the weakside corner for the open three" },
];

export const uid = () => Math.random().toString(36).slice(2, 9);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function clampCourt(p, margin = 18, w = 500, h = 470) {
  return {
    x: Math.max(margin, Math.min(w - margin, Math.round(p.x))),
    y: Math.max(margin, Math.min(h - margin, Math.round(p.y))),
  };
}

export function simplifyPath(points, maxPoints = 10) {
  if (!points?.length) return [];
  if (points.length <= maxPoints) return points.map((p) => clampCourt(p));
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (points.length - 1));
    out.push(points[idx]);
  }
  return out.map((p) => clampCourt(p));
}

export function sampleStroke(prev, next, minDist = 8) {
  if (!prev) return [next];
  if (dist(prev, next) >= minDist) return [next];
  return [];
}

/** Nearest player within maxDist pixels of a point */
export function nearestPlayer(pos, point, maxDist = 42) {
  let best = null;
  let bestD = maxDist;
  for (const id of IDS) {
    if (!pos[id]) continue;
    const d = dist(pos[id], point);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Positions after prior actions on the same beat (e.g. dribble then pass). */
export function effectivePositions(prevPos, curPos, actions = []) {
  const pos = { ...curPos };
  for (const a of actions) {
    if ((a.type === "cut" || a.type === "dribble" || a.type === "screen") && a.path?.length) {
      pos[a.by] = a.path[a.path.length - 1];
    }
  }
  return pos;
}

/**
 * Turn a drawn stroke into an Action + frame updates.
 * Pass/handoff start from the player's current spot on this beat (after prior dribbles, etc.).
 */
export function actionFromStroke({ tool, points, prevPos, curPos, ball, existingActions = [] }) {
  if (!tool || points.length < 2 || !prevPos) return { error: "Draw a longer line on the court." };

  const effective = effectivePositions(prevPos, curPos, existingActions);
  let path = simplifyPath(points);
  const start = path[0];
  const end = path[path.length - 1];

  let by = null;

  if (tool === "pass" || tool === "handoff") {
    // Passer = ball handler at their current spot (after any dribble this beat)
    if (ball && effective[ball]) {
      const d = dist(effective[ball], start);
      if (d < 80) by = ball;
    }
    if (!by) by = nearestPlayer(effective, start, 70) || nearestPlayer(curPos, start, 70);
    if (!by) by = ball;
  } else {
    by =
      nearestPlayer(effective, start, 70) ||
      nearestPlayer(prevPos, start, 70) ||
      nearestPlayer(curPos, start, 70);
  }

  if (!by) return { error: "Start your line on a player (near their circle)." };

  const actorStart = effective[by] ?? prevPos[by] ?? curPos[by];
  path[0] = { ...actorStart };

  const action = { id: uid(), type: tool, by, path: [...path] };
  const patch = {};

  if (tool === "pass" || tool === "handoff" || tool === "screen") {
    let forId = nearestPlayer(effective, end, 70) || nearestPlayer(curPos, end, 70);
    if (!forId && tool === "screen") forId = nearestPlayer(prevPos, end, 70);
    if (!forId || forId === by) {
      return { error: tool === "screen" ? "End the line near who gets screened." : "End the line on the receiver." };
    }
    action.for = forId;
    const target = effective[forId] ?? curPos[forId] ?? prevPos[forId];
    path[path.length - 1] = clampCourt(target);
    action.path = path;
  }

  if (tool === "cut" || tool === "dribble" || tool === "screen") {
    patch.pos = { ...curPos, [by]: clampCourt(end) };
  }

  if (tool === "pass" || tool === "handoff") {
    patch.ball = action.for;
  }

  return { action, patch };
}

export function createEmptyPlay(name = "Untitled play", category = "Set") {
  const pos = JSON.parse(JSON.stringify(ALIGNMENT_PRESETS.Horns));
  const beat1 = {
    id: uid(),
    pos,
    ball: "1",
    actions: [],
    note: "Starting alignment.",
  };
  return {
    name,
    category,
    frames: [
      beat1,
      {
        id: uid(),
        pos: JSON.parse(JSON.stringify(pos)),
        ball: "1",
        actions: [],
        note: "",
      },
    ],
    counters: [],
  };
}

export function actionLabel(a) {
  if (a.type === "screen") return `${a.by} screens for ${a.for}`;
  if (a.type === "pass") return `${a.by} passes to ${a.for}`;
  if (a.type === "handoff") return `${a.by} hands off to ${a.for}`;
  if (a.type === "cut") return `${a.by} cuts`;
  return `${a.by} dribbles`;
}

/**
 * Apply a patch to one beat and ripple position changes forward to later beats
 * (and shift related action paths on those beats).
 */
export function applyBeatChange(frames, beatIdx, patch) {
  if (!frames[beatIdx]) return frames;

  const old = frames[beatIdx];
  const merged = {
    ...old,
    ...patch,
    pos: patch.pos ? { ...old.pos, ...patch.pos } : old.pos,
    actions: patch.actions ?? old.actions,
  };

  const next = frames.map((f, i) => (i === beatIdx ? merged : { ...f, pos: { ...f.pos }, actions: [...(f.actions ?? [])] }));

  if (!patch.pos) return next;

  const deltas = {};
  for (const id of IDS) {
    if (patch.pos[id]) {
      const dx = patch.pos[id].x - old.pos[id].x;
      const dy = patch.pos[id].y - old.pos[id].y;
      if (dx || dy) deltas[id] = { dx, dy };
    }
  }

  if (!Object.keys(deltas).length) return next;

  for (let i = beatIdx + 1; i < next.length; i++) {
    const pos = { ...next[i].pos };
    for (const id of IDS) {
      if (deltas[id] && pos[id]) {
        pos[id] = clampCourt({ x: pos[id].x + deltas[id].dx, y: pos[id].y + deltas[id].dy });
      }
    }
    const actions = next[i].actions.map((a) => {
      if (!a.path?.length) return a;
      const touch =
        deltas[a.by] || (a.for && deltas[a.for]);
      if (!touch) return a;
      const d = deltas[a.by] || deltas[a.for];
      return {
        ...a,
        path: a.path.map((p) => clampCourt({ x: p.x + d.dx, y: p.y + d.dy })),
      };
    });
    next[i] = { ...next[i], pos, actions };
  }

  return next;
}

export function savePlayToSession(play) {
  const id = play.id || uid();
  const stored = { ...play, id };
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(`playlab:play:${id}`, JSON.stringify(stored));
  }
  return id;
}

export function loadPlayFromSession(id) {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(`playlab:play:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
