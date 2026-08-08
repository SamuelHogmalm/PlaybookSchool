/**
 * Timeline builder for PlayAnimator — maps beat range to sequential timeline.
 */
import {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
  SEQ_BEAT_HOLD_MS,
} from "./sequentialPlayback.js";
import { IDS } from "./playModel.js";

function copyPos(frame) {
  const out = {};
  for (const id of IDS) {
    if (frame?.pos?.[id]) out[id] = { ...frame.pos[id] };
  }
  return out;
}

function holdTimeline(frames, beatIdx, duration = SEQ_BEAT_HOLD_MS) {
  const idx = Math.max(0, Math.min(beatIdx, frames.length - 1));
  return {
    setupPos: copyPos(frames[idx]),
    setupBall: frames[idx]?.ball ?? null,
    groups: [{ parallel: false, steps: [], duration, beatIdx: idx, phase: "hold" }],
    frames,
  };
}

export function buildPlayAnimatorTimeline(frames, fromBeat = 0, toBeat = null) {
  if (!frames?.length) {
    return { setupPos: {}, setupBall: null, groups: [], frames: [] };
  }

  const last = frames.length - 1;
  const to = Math.max(0, Math.min(toBeat ?? last, last));
  const from = Math.max(0, Math.min(fromBeat ?? 0, last));

  if (from >= to || frames.length < 2) {
    return holdTimeline(frames, from);
  }

  const startBeat = from === 0 ? 1 : from + 1;
  return buildSequentialTimeline(frames, to, startBeat);
}

export function playAnimatorDuration(frames, fromBeat, toBeat, speed = 1) {
  const timeline = buildPlayAnimatorTimeline(frames, fromBeat, toBeat);
  return sequentialTimelineDuration(timeline, speed);
}

export function getPlayAnimatorState(frames, fromBeat, toBeat, elapsedMs, speed = 1) {
  const timeline = buildPlayAnimatorTimeline(frames, fromBeat, toBeat);
  const raw = getSequentialPlaybackState(timeline, elapsedMs * speed);
  const note = raw.note?.trim() || null;
  return { ...raw, caption: note, note, done: raw.done ?? false };
}
