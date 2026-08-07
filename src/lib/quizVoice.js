/**
 * Coach huddle voice for quiz stems, context, answers, and feedback.
 * Wording only — no grading or deck logic.
 */

import { zoneLabel } from "@/lib/courtZones";
import { beatEndPositions } from "@/lib/playModel";

export function youAre(myId) {
  return `You're the ${myId}.`;
}

/** Short spot phrase without "the" prefix where awkward */
export function spotShort(p) {
  if (!p) return "the open spot";
  const z = zoneLabel(p);
  if (z.startsWith("the ")) return z;
  return `the ${z}`;
}

/** Verb-first action answer for a player's move on this beat. */
export function actionAnswer(prev, cur, playerId, beatActions, playerMovedOnBeat) {
  const pid = String(playerId);
  const myActions = beatActions.filter((a) => String(a.by) === pid);
  const end = beatEndPositions(prev, cur)[playerId];
  const dest = end ? spotShort(end) : null;
  const moved = playerMovedOnBeat(prev, cur, playerId);
  const steps = [];

  const passAction = myActions.find((a) => a.type === "pass");
  const handoffAction = myActions.find((a) => a.type === "handoff");
  const screenAction = myActions.find((a) => a.type === "screen");
  const dribbleAction = myActions.find((a) => a.type === "dribble");

  if (passAction) {
    steps.push(`Pass to ${passAction.for}`);
  }
  if (handoffAction) {
    steps.push(`Hand off to ${handoffAction.for}`);
  }
  if (screenAction) {
    steps.push(`Set a screen for ${screenAction.for}`);
  }
  if (dribbleAction && dest) {
    steps.push(`Dribble to ${dest}`);
  } else if (moved && dest) {
    if (passAction?.for) {
      steps.push(`Cut off ${passAction.for} to ${dest}`);
    } else if (handoffAction) {
      steps.push(`Roll to ${dest}`);
    } else if (screenAction) {
      steps.push(`Roll to ${dest}`);
    } else {
      steps.push(`Cut to ${dest}`);
    }
  }

  if (!steps.length) return null;
  const text = steps.join(", then ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Ball read answer — action phrasing, not "number X at zone". */
export function passLookAnswer(forId, prev, cur, beatActions) {
  const end = beatEndPositions(prev, cur)[forId] ?? cur.pos[forId];
  const dest = end ? spotShort(end) : "the open man";
  const roll = beatActions.some((a) => a.type === "cut" && String(a.by) === String(forId));
  if (roll && dest.includes("block")) return `Pass to ${forId} at the block`;
  if (dest.includes("corner")) return `Pass to ${forId} in the corner`;
  if (dest.includes("wing")) return `Pass to ${forId} on the wing`;
  if (dest.includes("slot")) return `Pass to ${forId} in the slot`;
  if (dest.includes("elbow") || dest.includes("top")) return `Pass to ${forId} at the top`;
  return `Pass to ${forId} at ${dest}`;
}

export function handoffLookAnswer(forId) {
  return `Hand off to ${forId}`;
}

export function ballHolderAnswer(holderId, myId) {
  if (String(holderId) === String(myId)) return "You've got it";
  return `${holderId} has it`;
}

/** Describe what another player did — safe for stems (not the quiz taker). */
export function othersActionLine(a, cur, myId) {
  if (String(a.by) === String(myId)) return null;

  if (a.type === "pass") {
    return `${a.by} just moved it to ${a.for}`;
  }
  if (a.type === "handoff") {
    return `${a.by} just handed it off to ${a.for}`;
  }
  if (a.type === "screen") {
    return `${a.by} just set the pin down for ${a.for}`;
  }
  if (a.type === "cut") {
    const dest = cur.pos[a.by] ? spotShort(cur.pos[a.by]) : "the next spot";
    return `${a.by} just cut to ${dest}`;
  }
  if (a.type === "dribble") {
    const dest = cur.pos[a.by] ? spotShort(cur.pos[a.by]) : "the wing";
    return `${a.by} just dribbled to ${dest}`;
  }
  return null;
}

export function ballSituation(cur, myId) {
  if (cur.ball === myId) return "You've got it.";
  if (cur.ball) {
    const p = cur.pos[cur.ball];
    if (p) return `Ball's ${spotShort(p).replace(/^the /, "at the ")}.`;
    return `Ball's with ${cur.ball}.`;
  }
  return "";
}

export function runningPlay(playName) {
  return playName ? `Running ${playName}.` : "";
}

export function spotStem(_playName, myId) {
  return `${youAre(myId)} Where do you go on this beat?`.trim();
}

export function formationStem(playName, myId) {
  const set = playName ? `You're running ${playName}` : "See the set";
  return `${set} — where should you be?`.trim();
}

export function formationSubText() {
  return "Tap your starting spot on the floor.";
}

export function drawStem(_playName, myId) {
  return `${youAre(myId)} Draw your route.`.trim();
}

export function watchStem(_playName, myId) {
  return `${youAre(myId)} What do you do next?`.trim();
}

export function ballPassStem(_playName, myId, prev, cur, youPass) {
  const sit = ballSituation(prev, myId);
  if (youPass) {
    return `${youAre(myId)} ${sit} Who's your first look?`.trim();
  }
  return `${sit} Who gets the pass?`.trim();
}

export function ballHandoffStem(_playName, myId, prev, youHandoff) {
  const sit = ballSituation(prev, myId);
  if (youHandoff) {
    return `${youAre(myId)} ${sit} Hand off to who?`.trim();
  }
  return `${sit} Who receives the handoff?`.trim();
}

export function ballHolderStem(_playName, myId) {
  return `${youAre(myId)} Who has the ball?`.trim();
}

export function lookStem(playName) {
  return playName ? `Running ${playName}. What's the main look?` : "What's the main look?";
}

export function identifyStem() {
  return "What's the play?";
}

export function identifySub() {
  return "Watch what ran — then name it.";
}

export function categoryStem() {
  return "What type of set is this?";
}

/** Build spoiler-safe context: others' actions + ball, never yours. */
export function buildSafeContext(prev, cur, myId, beatActions, opts = {}) {
  const { priorContext = null, hideBall = false } = opts;
  const lines = [];

  for (const a of beatActions) {
    const line = othersActionLine(a, cur, myId);
    if (line) lines.push(line);
  }

  if (!hideBall && prev?.ball) {
    if (prev.ball === myId) lines.unshift("You've got it.");
    else if (prev.ball) {
      const bp = prev.pos[prev.ball];
      if (bp) lines.unshift(`Ball's with ${prev.ball} ${spotShort(bp)}.`);
      else lines.unshift(`Ball's with ${prev.ball}.`);
    }
  }

  if (!lines.length) return priorContext;

  const text = lines.slice(0, 2).join(" ");
  return priorContext ? `${priorContext} ${text}` : text;
}

export function drawSubText(context) {
  if (context) return `${context} Draw your route.`;
  return "Draw your route.";
}

export function spotSubText(context) {
  if (context) return `${context} Tap the floor.`;
  return "Tap the floor.";
}

/** Pool of plausible wrong action answers for watch/ball. */
export function actionDistractorPool(prev, cur, myId, beatActions, playerMovedOnBeat, allFrames, playName) {
  const pool = [];

  for (const id of ["1", "2", "3", "4", "5"]) {
    if (String(id) === String(myId)) continue;
    const alt = actionAnswer(prev, cur, id, beatActions, playerMovedOnBeat);
    if (alt) pool.push(alt);
  }

  for (const a of beatActions) {
    if (a.type === "pass" && String(a.by) !== String(myId)) {
      pool.push(passLookAnswer(a.for, prev, cur, beatActions));
    }
  }

  if (allFrames?.length > 1) {
    for (let i = 1; i < allFrames.length; i++) {
      const p = allFrames[i - 1];
      const c = allFrames[i];
      const alt = actionAnswer(p, c, myId, c.actions ?? [], () => true);
      if (alt) pool.push(alt);
    }
  }

  const flips = [
    "Cut to the corner",
    "Fill the slot",
    "Flare to the wing",
    "Pop to the top",
    "Drift to the weakside corner",
    "Roll to the rim",
    "Cut to the basket",
    "Fill the wing",
    "Move to the elbow",
    "Relocate to the corner",
  ];
  pool.push(...flips);

  return pool;
}

export function passDistractorPool(prev, cur, myId, beatActions, passerId, playerMovedOnBeat) {
  const pool = [];
  for (const id of ["1", "2", "3", "4", "5"]) {
    if (String(id) === String(passerId)) continue;
    pool.push(passLookAnswer(id, prev, cur, beatActions));
  }
  pool.push(
    "Skip to the weakside corner",
    "Pass to the slot",
    "Reset to the top",
    "Swing to the wing",
    "Fill the corner"
  );
  return pool;
}

/** Balance MC option lengths — avoid longest-answer tell. */
export function balancedMcOptions(correct, pool, count, shuffleFn) {
  const uniq = [...new Set(pool.filter((o) => o && o !== correct))];
  const targetLen = correct.length;
  const minLen = Math.floor(targetLen * 0.6);
  const maxLen = Math.ceil(targetLen * 1.4);

  const scored = uniq.map((o) => ({
    text: o,
    delta: Math.abs(o.length - targetLen),
    ok: o.length >= minLen && o.length <= maxLen,
  }));
  scored.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return a.delta - b.delta;
  });

  const picks = scored.slice(0, count - 1).map((s) => s.text);
  while (picks.length < count - 1 && scored.length > picks.length) {
    const next = scored[picks.length];
    if (next && !picks.includes(next.text)) picks.push(next.text);
    else break;
  }

  return shuffleFn([correct, ...picks.slice(0, count - 1)]);
}

export function contrastiveFeedback({ playName, guess, correct, altPlay }) {
  if (typeof guess !== "string" || !correct || guess === correct) return null;
  if (altPlay && altPlay !== playName) {
    return `Not quite. ${guess} — that's ${altPlay}. On ${playName}, ${correct.charAt(0).toLowerCase()}${correct.slice(1)}.`;
  }
  return `Not quite. ${guess} isn't it. ${correct}.`;
}

/** Feedback after a missed spot or draw — uses coach beat note when available. */
export function spotDrawFeedback({ playName, frameNote, kind }) {
  if (frameNote?.trim()) {
    return `Not quite. ${frameNote.trim()}`;
  }
  if (kind === "draw") {
    return `Not quite. Watch the replay — that's the route on ${playName}.`;
  }
  return `Not quite. Watch the replay — that's where you belong on ${playName}.`;
}

export function spotDrawSuccess(frameNote) {
  if (frameNote?.trim()) return frameNote.trim();
  return "Nice — you've got the spot.";
}

/** Use play breakdown for main-look MC distractors — other plays' intents, not reads. */
export function lookOptionsFromBreakdown(play, correctAnswer) {
  const bd = play?.breakdown;
  const pool = [];
  for (const field of ["entry", "advantage"]) {
    const v = bd?.[field]?.trim();
    if (v && v !== correctAnswer) pool.push(v);
  }
  return pool;
}
