import type { Beat, Play, PlayerId, Vec } from "./types";
import { PLAYER_IDS } from "./types";
import {
  ALIGNMENT_PRESETS,
  copyPositions,
  snapClampPoint,
  type AlignmentPresetName,
} from "./editor";

function cloneBeat(beat: Beat): Beat {
  return {
    ...beat,
    startPos: copyPositions(beat.startPos),
    pos: copyPositions(beat.pos),
    actions: beat.actions.map((a) => ({
      ...a,
      path: a.path?.map((p) => ({ x: p.x, y: p.y })),
    })),
  };
}

function cloneBeats(beats: Beat[]): Beat[] {
  return beats.map(cloneBeat);
}

export { cloneBeat, cloneBeats };

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** beat[N].startPos === beat[N-1].pos for N > 0. */
export function linkBeatPositions(beats: Beat[]): Beat[] {
  const next = cloneBeats(beats);
  for (let i = 1; i < next.length; i++) {
    for (const id of PLAYER_IDS) {
      next[i].startPos[id] = { ...next[i - 1].pos[id] };
    }
  }
  return next;
}

/** Move one player's destination; keeps beat[N].pos === beat[N+1].startPos. */
export function updateBeatPlayerPos(
  beats: Beat[],
  beatIndex: number,
  playerId: PlayerId,
  pos: Vec,
): Beat[] {
  const next = cloneBeats(beats);
  const snapped = snapClampPoint(pos);
  next[beatIndex].pos[playerId] = snapped;
  if (beatIndex + 1 < next.length) {
    next[beatIndex + 1].startPos[playerId] = { ...snapped };
  }
  for (const a of next[beatIndex].actions) {
    if (a.by === playerId || a.for === playerId) {
      delete a.derived;
      delete a.needsReview;
      delete a.reason;
    }
  }
  return next;
}

export function applyPresetToBeat(
  beats: Beat[],
  beatIndex: number,
  presetName: AlignmentPresetName,
): Beat[] {
  const preset = copyPositions(ALIGNMENT_PRESETS[presetName]);
  for (const id of PLAYER_IDS) {
    preset[id] = snapClampPoint(preset[id]);
  }
  const next = cloneBeats(beats);
  if (beatIndex === 0) {
    next[0].startPos = copyPositions(preset);
    next[0].pos = copyPositions(preset);
  } else {
    next[beatIndex].pos = copyPositions(preset);
  }
  if (beatIndex + 1 < next.length) {
    for (const id of PLAYER_IDS) {
      next[beatIndex + 1].startPos[id] = { ...next[beatIndex].pos[id] };
    }
  }
  return next;
}

export function addBeat(beats: Beat[]): Beat[] {
  const prev = beats[beats.length - 1];
  const pos = copyPositions(prev.pos);
  const newBeat: Beat = {
    id: `b${beats.length + 1}`,
    startPos: copyPositions(prev.pos),
    pos,
    startBall: prev.ball,
    ball: prev.ball,
    actions: [],
  };
  return [...cloneBeats(beats), newBeat];
}

export function duplicateBeat(beats: Beat[], index: number): Beat[] {
  const source = beats[index];
  const copy: Beat = {
    ...cloneBeat(source),
    id: `b${beats.length + 1}`,
    actions: source.actions.map((a) => ({ ...a, id: uid() })),
  };
  const next = cloneBeats(beats);
  next.splice(index + 1, 0, copy);
  return linkBeatPositions(
    next.map((b, i) => ({ ...b, id: `b${i + 1}` })),
  );
}

export function deleteBeat(beats: Beat[], index: number): Beat[] {
  if (beats.length <= 2) return cloneBeats(beats);
  const next = cloneBeats(beats);
  next.splice(index, 1);
  return linkBeatPositions(next.map((b, i) => ({ ...b, id: `b${i + 1}` })));
}

export function reorderBeat(
  beats: Beat[],
  fromIndex: number,
  toIndex: number,
): Beat[] {
  if (fromIndex === toIndex) return cloneBeats(beats);
  const next = cloneBeats(beats);
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return linkBeatPositions(next.map((b, i) => ({ ...b, id: `b${i + 1}` })));
}

export function createEmptyPlay(name = "New Play"): Play {
  const positions = copyPositions(ALIGNMENT_PRESETS.Horns);
  const now = new Date().toISOString();
  const mkBeat = (id: string): Beat => ({
    id,
    startPos: copyPositions(positions),
    pos: copyPositions(positions),
    startBall: "1",
    ball: "1",
    actions: [],
  });

  return {
    id: uid(),
    teamId: "local",
    name,
    category: "Set",
    beats: [mkBeat("b1"), mkBeat("b2")],
    version: 1,
    valid: false,
    validationErrors: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touchPlay(play: Play): Play {
  return { ...play, updatedAt: new Date().toISOString() };
}

/** beat[N].startBall === beat[N-1].ball for N > 0; idle beats inherit end ball. */
export function linkBeatBall(beats: Beat[]): Beat[] {
  const next = cloneBeats(beats);
  for (let i = 1; i < next.length; i++) {
    next[i].startBall = next[i - 1].ball;
    if (next[i].actions.length === 0) {
      next[i].ball = next[i].startBall;
    }
  }
  return next;
}

export function setPlayBeats(play: Play, beats: Beat[]): Play {
  return touchPlay({ ...play, beats: linkBeatBall(beats) });
}
