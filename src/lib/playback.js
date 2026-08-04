import { IDS } from "@/app/court/Court";
import { effectivePositions } from "@/lib/playModel";

export const BEAT_DURATION_MS = 2000;
export const BEAT_HOLD_MS = 600;
export const SPEED_OPTIONS = [0.5, 1, 2];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function timelineDuration(frames, speed) {
  const n = frames.length;
  if (n <= 1) return BEAT_HOLD_MS / speed;
  return (n * BEAT_HOLD_MS + (n - 1) * BEAT_DURATION_MS) / speed;
}

function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

/** Point at fraction t ∈ [0,1] along a polyline path */
export function samplePolyline(pts, t) {
  if (!pts?.length) return null;
  if (pts.length === 1) return { ...pts[0] };
  const total = polylineLength(pts);
  if (total === 0) return { ...pts[0] };
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const u = seg === 0 ? 1 : target / seg;
      return {
        x: lerp(pts[i - 1].x, pts[i].x, u),
        y: lerp(pts[i - 1].y, pts[i].y, u),
      };
    }
    target -= seg;
  }
  return { ...pts[pts.length - 1] };
}

function passRoute(action, prevFrame, nextFrame) {
  const idx = nextFrame.actions.indexOf(action);
  const prior = nextFrame.actions.slice(0, idx);
  const atPos = effectivePositions(prevFrame.pos, nextFrame.pos, prior);
  if (action.path?.length >= 2) return action.path.map((p) => ({ ...p }));
  const from = atPos[action.by] ?? prevFrame.pos[action.by];
  const to = nextFrame.pos[action.for];
  return [from, to].map((p) => ({ ...p }));
}

/** Animate players along action paths during a beat transition (cuts, dribbles, handoffs). */
export function getTransitionPositions(prevFrame, nextFrame, f) {
  const out = {};
  IDS.forEach((id) => {
    out[id] = {
      x: lerp(prevFrame.pos[id].x, nextFrame.pos[id].x, f),
      y: lerp(prevFrame.pos[id].y, nextFrame.pos[id].y, f),
    };
  });

  for (let i = 0; i < nextFrame.actions.length; i++) {
    const a = nextFrame.actions[i];
    if (!["cut", "dribble", "screen", "handoff"].includes(a.type)) continue;

    const prior = nextFrame.actions.slice(0, i);
    const atPos = effectivePositions(prevFrame.pos, nextFrame.pos, prior);
    const from = atPos[a.by] ?? prevFrame.pos[a.by];
    const end = a.path?.length ? a.path[a.path.length - 1] : nextFrame.pos[a.by];
    const route = a.path?.length >= 2 ? a.path : [from, end];
    out[a.by] = samplePolyline(route, f);
  }

  return out;
}

const HANDOFF_BALL_MEET = 0.88;

function resolveBall(prevFrame, nextFrame, f) {
  const handoff = nextFrame.actions.find((a) => a.type === "handoff");
  if (handoff) {
    if (f < HANDOFF_BALL_MEET) {
      return { ballCarrier: handoff.by, ballInAir: null };
    }
    return { ballCarrier: handoff.for, ballInAir: null };
  }

  const pass = nextFrame.actions.find((a) => a.type === "pass");

  if (pass) {
    const route = passRoute(pass, prevFrame, nextFrame);
    const releaseAt = 0.22;
    const catchAt = 0.78;

    if (f < releaseAt) {
      return { ballCarrier: pass.by, ballInAir: null };
    }
    if (f >= catchAt) {
      return { ballCarrier: pass.for, ballInAir: null };
    }

    const t = (f - releaseAt) / (catchAt - releaseAt);
    const eased = easeInOut(t);
    const p = samplePolyline(route, eased);
    const arc = Math.sin(t * Math.PI) * 16;
    return { ballCarrier: null, ballInAir: { x: p.x, y: p.y - arc } };
  }

  const dribble = nextFrame.actions.find((a) => a.type === "dribble" && a.by === prevFrame.ball);
  const carrier = dribble ? dribble.by : f < 0.5 ? prevFrame.ball : nextFrame.ball;
  return { ballCarrier: carrier, ballInAir: null };
}

/**
 * Playback state including animated in-air ball for passes.
 * ballCarrier — player who shows the ball on their token (null if in air)
 * ballInAir — { x, y } while the ball travels between players
 */
export function getPlaybackState(frames, elapsedMs, speed) {
  if (!frames.length) return null;
  const hold = BEAT_HOLD_MS / speed;
  const trans = BEAT_DURATION_MS / speed;
  let t = 0;

  for (let i = 0; i < frames.length; i++) {
    if (elapsedMs < t + hold) {
      const frame = frames[i];
      return {
        pos: frame.pos,
        ball: frame.ball,
        ballCarrier: frame.ball,
        ballInAir: null,
        beatIdx: i,
        note: frame.note,
        inTransition: false,
        transitionF: 0,
      };
    }
    t += hold;

    if (i < frames.length - 1) {
      if (elapsedMs < t + trans) {
        const raw = (elapsedMs - t) / trans;
        const f = easeInOut(raw);
        const out = getTransitionPositions(frames[i], frames[i + 1], f);
        const { ballCarrier, ballInAir } = resolveBall(frames[i], frames[i + 1], f);
        return {
          pos: out,
          ball: frames[i + 1].ball,
          ballCarrier,
          ballInAir,
          beatIdx: i + 1,
          note: frames[i + 1].note,
          inTransition: true,
          transitionF: f,
        };
      }
      t += trans;
    }
  }

  const last = frames.length - 1;
  const frame = frames[last];
  return {
    pos: frame.pos,
    ball: frame.ball,
    ballCarrier: frame.ball,
    ballInAir: null,
    beatIdx: last,
    note: frame.note,
    inTransition: false,
    transitionF: 0,
  };
}

/** Whether a player token should show the ball dot */
export function playerHasBall(playback, frame, playerId) {
  if (playback?.ballInAir) return false;
  const carrier = playback?.ballCarrier ?? playback?.ball ?? frame?.ball;
  return carrier === playerId;
}

/** Animate one beat transition (quiz reveal, etc.) */
export function getBeatTransitionState(prevFrame, nextFrame, elapsedMs, opts = {}) {
  const hold = (opts.holdMs ?? BEAT_HOLD_MS) / (opts.speed ?? 1);
  const trans = (opts.transMs ?? BEAT_DURATION_MS) / (opts.speed ?? 1);
  const total = hold + trans;

  if (elapsedMs <= hold) {
    return {
      pos: prevFrame.pos,
      ball: prevFrame.ball,
      ballCarrier: prevFrame.ball,
      ballInAir: null,
      done: false,
      totalMs: total,
    };
  }

  if (elapsedMs <= hold + trans) {
    const f = easeInOut((elapsedMs - hold) / trans);
    const out = getTransitionPositions(prevFrame, nextFrame, f);
    const { ballCarrier, ballInAir } = resolveBall(prevFrame, nextFrame, f);
    return {
      pos: out,
      ball: nextFrame.ball,
      ballCarrier,
      ballInAir,
      done: false,
      totalMs: total,
    };
  }

  return {
    pos: nextFrame.pos,
    ball: nextFrame.ball,
    ballCarrier: nextFrame.ball,
    ballInAir: null,
    done: true,
    totalMs: total,
  };
}

export const QUIZ_REVEAL_HOLD_MS = 500;
export const QUIZ_REVEAL_TRANS_MS = 1600;
