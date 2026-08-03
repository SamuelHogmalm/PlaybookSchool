"use client";

import { useState, useRef, useEffect, useMemo } from "react";

/* ============================================================
   PlayLab — basketball play editor + auto-generated player quiz
   The point: a play is a SEMANTIC MODEL, not a drawing.
   Everything the player app asks is derived from that model.
   ============================================================ */

const C = {
  bg: "#0E1116",
  panel: "#161B22",
  panel2: "#1C232D",
  line: "#2A323E",
  text: "#E6EAF0",
  muted: "#8B95A5",
  dim: "#5A6474",
  ball: "#FF7A2F",
  screen: "#4CC2FF",
  cut: "#C9A227",
  ok: "#3FD68C",
  bad: "#FF5C5C",
  wood: "#15130E",
};

const W = 500;
const H = 470;
const COURT_MAX_W = "max-w-[400px]";
const HOOP = { x: 250, y: 52.5 };
const IDS = ["1", "2", "3", "4", "5"];
const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

const ACTION_TYPES = [
  { id: "screen", label: "Screen", needs: ["by", "for"] },
  { id: "cut", label: "Cut", needs: ["by"] },
  { id: "dribble", label: "Dribble", needs: ["by"] },
  { id: "pass", label: "Pass", needs: ["by", "for"] },
  { id: "handoff", label: "Handoff", needs: ["by", "for"] },
];

const BEAT_DURATION_MS = 2000;
const BEAT_HOLD_MS = 600;
const SPEED_OPTIONS = [0.5, 1, 2];

const SEED = {
  name: "Horns Down",
  category: "Half court set",
  frames: [
    {
      id: "f1",
      pos: {
        1: { x: 250, y: 400 },
        2: { x: 45, y: 62 },
        3: { x: 455, y: 62 },
        4: { x: 180, y: 195 },
        5: { x: 320, y: 195 },
      },
      ball: "1",
      actions: [],
      note: "Horns alignment. Bigs at the elbows, shooters in the corners.",
    },
    {
      id: "f2",
      pos: {
        1: { x: 312, y: 332 },
        2: { x: 45, y: 62 },
        3: { x: 455, y: 62 },
        4: { x: 180, y: 195 },
        5: { x: 300, y: 330 },
      },
      ball: "1",
      actions: [
        { id: "a1", type: "screen", by: "5", for: "1" },
        { id: "a2", type: "dribble", by: "1" },
      ],
      note: "5 steps up and sets the ball screen. 1 comes off it going right.",
    },
    {
      id: "f3",
      pos: {
        1: { x: 402, y: 278 },
        2: { x: 45, y: 62 },
        3: { x: 455, y: 62 },
        4: { x: 108, y: 112 },
        5: { x: 268, y: 132 },
      },
      ball: "1",
      actions: [
        { id: "a3", type: "cut", by: "5" },
        { id: "a4", type: "screen", by: "4", for: "2" },
      ],
      note: "5 rolls hard to the rim. Weakside, 4 turns and pin-downs for 2.",
    },
    {
      id: "f4",
      pos: {
        1: { x: 402, y: 278 },
        2: { x: 96, y: 258 },
        3: { x: 455, y: 62 },
        4: { x: 152, y: 92 },
        5: { x: 268, y: 132 },
      },
      ball: "2",
      actions: [
        { id: "a5", type: "cut", by: "2" },
        { id: "a6", type: "pass", by: "1", for: "2" },
      ],
      note: "2 comes off the pin-down to the wing. 1 swings it for the catch-and-shoot.",
    },
  ],
  counters: [
    { trigger: "Your defender goes UNDER the ball screen", answer: "Rise up into the pull-up three — don't turn the corner" },
    { trigger: "X5 hedges hard on the ball screen", answer: "5 slips early, hit the pocket pass in the short roll" },
    { trigger: "X2 chases over the top of the pin-down", answer: "2 curls to the elbow instead of flaring out" },
    { trigger: "The help defender tags the roller", answer: "Skip it to the weakside corner for the open three" },
  ],
};

/* ---------- geometry helpers ---------- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const uid = () => Math.random().toString(36).slice(2, 9);

function squigglePath(a, b, amp = 7, waves = 6) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i <= waves; i++) {
    const t1 = (i - 0.5) / waves;
    const t2 = i / waves;
    const s = (i % 2 ? 1 : -1) * amp;
    d += ` Q ${a.x + dx * t1 + px * s} ${a.y + dy * t1 + py * s} ${a.x + dx * t2} ${a.y + dy * t2}`;
  }
  return d;
}

function shorten(a, b, padA = 16, padB = 16) {
  const len = dist(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return [
    { x: a.x + ux * padA, y: a.y + uy * padA },
    { x: b.x - ux * padB, y: b.y - uy * padB },
  ];
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function pathToSvgD(points) {
  if (!points?.length) return "";
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

function pathArrowEnd(points, pad = 15) {
  if (!points?.length) return null;
  if (points.length < 2) return points[0];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return shorten(a, b, 0, pad)[1];
}

function timelineDuration(frames, speed) {
  const n = frames.length;
  if (n <= 1) return BEAT_HOLD_MS / speed;
  return (n * BEAT_HOLD_MS + (n - 1) * BEAT_DURATION_MS) / speed;
}

function beatHoldStartMs(beatIdx, speed) {
  const unit = (BEAT_HOLD_MS + BEAT_DURATION_MS) / speed;
  return beatIdx * unit;
}

function getPlaybackState(frames, elapsedMs, speed) {
  if (!frames.length) return null;
  const hold = BEAT_HOLD_MS / speed;
  const trans = BEAT_DURATION_MS / speed;
  let t = 0;

  for (let i = 0; i < frames.length; i++) {
    if (elapsedMs < t + hold) {
      return {
        pos: frames[i].pos,
        ball: frames[i].ball,
        beatIdx: i,
        note: frames[i].note,
        inTransition: false,
      };
    }
    t += hold;

    if (i < frames.length - 1) {
      if (elapsedMs < t + trans) {
        const raw = (elapsedMs - t) / trans;
        const f = easeInOut(raw);
        const a = frames[i].pos;
        const b = frames[i + 1].pos;
        const out = {};
        IDS.forEach((id) => {
          out[id] = { x: lerp(a[id].x, b[id].x, f), y: lerp(a[id].y, b[id].y, f) };
        });
        return {
          pos: out,
          ball: frames[f < 0.5 ? i : i + 1].ball,
          beatIdx: i + 1,
          note: frames[i + 1].note,
          inTransition: true,
        };
      }
      t += trans;
    }
  }

  const last = frames.length - 1;
  return {
    pos: frames[last].pos,
    ball: frames[last].ball,
    beatIdx: last,
    note: frames[last].note,
    inTransition: false,
  };
}

/* ---------- court ---------- */
function CourtBase() {
  const r3 = 197.5; // HS three: 19'9"
  const ax = Math.sqrt(r3 * r3 - (HOOP.y - 0) * (HOOP.y - 0));
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={C.wood} />
      <rect x="1" y="1" width={W - 2} height={H - 2} fill="none" stroke={C.line} strokeWidth="2" />
      <rect x="170" y="0" width="160" height="190" fill="none" stroke={C.line} strokeWidth="2" />
      <circle cx="250" cy="190" r="60" fill="none" stroke={C.line} strokeWidth="2" />
      <path
        d={`M ${250 + ax} 0 A ${r3} ${r3} 0 0 1 ${250 - ax} 0`}
        fill="none"
        stroke={C.line}
        strokeWidth="2"
      />
      <line x1="190" y1="8" x2="310" y2="8" stroke={C.line} strokeWidth="3" />
      <circle cx={HOOP.x} cy={HOOP.y} r="9" fill="none" stroke={C.dim} strokeWidth="2.5" />
      <circle cx="250" cy={H} r="60" fill="none" stroke={C.line} strokeWidth="2" />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="arrowCut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={C.cut} />
      </marker>
      <marker id="arrowBall" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={C.ball} />
      </marker>
    </defs>
  );
}

function ActionLayer({ frame, prev }) {
  if (!prev) return null;
  return (
    <g>
      {frame.actions.map((a) => {
        const from = prev.pos[a.by];
        const to = frame.pos[a.by];
        const route = a.path?.length >= 2 ? a.path : null;

        if (a.type === "dribble") {
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={C.ball} strokeWidth="2.5" markerEnd="url(#arrowBall)" />;
          }
          return <path key={a.id} d={squigglePath(from, to)} fill="none" stroke={C.ball} strokeWidth="2.5" markerEnd="url(#arrowBall)" />;
        }
        if (a.type === "cut") {
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={C.cut} strokeWidth="2.5" markerEnd="url(#arrowCut)" />;
          }
          const [p, q] = shorten(from, to, 15, 15);
          return <line key={a.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.cut} strokeWidth="2.5" markerEnd="url(#arrowCut)" />;
        }
        if (a.type === "pass" || a.type === "handoff") {
          const target = frame.pos[a.for];
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return (
              <path
                key={a.id}
                d={pathToSvgD(trimmed)}
                fill="none"
                stroke={C.ball}
                strokeWidth="2.5"
                strokeDasharray={a.type === "pass" ? "9 7" : "2 5"}
                markerEnd="url(#arrowBall)"
              />
            );
          }
          const [p, q] = shorten(from, target, 16, 18);
          return (
            <line
              key={a.id}
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              stroke={C.ball} strokeWidth="2.5"
              strokeDasharray={a.type === "pass" ? "9 7" : "2 5"}
              markerEnd="url(#arrowBall)"
            />
          );
        }
        if (a.type === "screen") {
          const target = frame.pos[a.for];
          const moveRoute = route || [from, to];
          const endPt = route ? route[route.length - 1] : to;
          const [p, q] = shorten(moveRoute[0], endPt, 15, 2);
          const len = dist(q, target) || 1;
          const px = (-(target.y - q.y) / len) * 13;
          const py = ((target.x - q.x) / len) * 13;
          return (
            <g key={a.id}>
              {route ? (
                <path d={pathToSvgD(moveRoute)} fill="none" stroke={C.screen} strokeWidth="2.5" />
              ) : (
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.screen} strokeWidth="2.5" />
              )}
              <line x1={q.x - px} y1={q.y - py} x2={q.x + px} y2={q.y + py} stroke={C.screen} strokeWidth="3.5" strokeLinecap="round" />
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

function Token({ id, p, hasBall, highlight, faded, draggable, onDown }) {
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      onPointerDown={draggable ? (e) => onDown(e, id) : undefined}
      style={{ cursor: draggable ? "grab" : "default", opacity: faded ? 0.28 : 1 }}
    >
      {highlight && <circle r="24" fill="none" stroke={C.ok} strokeWidth="2" opacity="0.7" />}
      <circle r="15" fill={C.panel2} stroke={hasBall ? C.ball : C.muted} strokeWidth={hasBall ? 3 : 2} />
      <text textAnchor="middle" y="5.5" fontSize="15" fontWeight="700" fill={C.text} style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}>
        {id}
      </text>
      {hasBall && <circle cx="12" cy="-12" r="5" fill={C.ball} />}
    </g>
  );
}

/* ---------- shared court surface ---------- */
function CourtSurface({ children, onPointerDown, onPointerMove, onPointerUp, svgRef }) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Defs />
      <CourtBase />
      {children}
    </svg>
  );
}

function toSvg(svgEl, e) {
  const r = svgEl.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}

/* ============================================================
   EDITOR
   ============================================================ */
function Editor({ play, setPlay }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showJson, setShowJson] = useState(false);
  const [draft, setDraft] = useState({ type: "screen", by: "5", for: "1" });
  const svgRef = useRef(null);
  const drag = useRef(null);
  const raf = useRef(null);

  const frame = play.frames[idx];
  const prev = idx > 0 ? play.frames[idx - 1] : null;
  const totalMs = timelineDuration(play.frames, speed);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      setElapsedMs((prevMs) => {
        const next = prevMs + dt;
        if (next >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, totalMs]);

  const inPlayback = playing || elapsedMs > 0;
  const playback = inPlayback ? getPlaybackState(play.frames, elapsedMs, speed) : null;

  const updateFrame = (patch) => {
    const frames = play.frames.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setPlay({ ...play, frames });
  };

  const onDown = (e, id) => {
    if (inPlayback) return;
    e.stopPropagation();
    drag.current = id;
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current || !svgRef.current) return;
    const p = toSvg(svgRef.current, e);
    updateFrame({
      pos: {
        ...frame.pos,
        [drag.current]: {
          x: Math.max(18, Math.min(W - 18, Math.round(p.x))),
          y: Math.max(18, Math.min(H - 18, Math.round(p.y))),
        },
      },
    });
  };
  const onUp = () => { drag.current = null; };

  const addFrame = () => {
    const clone = {
      id: uid(),
      pos: JSON.parse(JSON.stringify(frame.pos)),
      ball: frame.ball,
      actions: [],
      note: "",
    };
    const frames = [...play.frames.slice(0, idx + 1), clone, ...play.frames.slice(idx + 1)];
    setPlay({ ...play, frames });
    setIdx(idx + 1);
  };

  const removeFrame = () => {
    if (play.frames.length <= 2) return;
    setPlay({ ...play, frames: play.frames.filter((_, i) => i !== idx) });
    setIdx(Math.max(0, idx - 1));
  };

  const addAction = () => {
    if (idx === 0) return;
    const spec = ACTION_TYPES.find((a) => a.id === draft.type);
    const a = { id: uid(), type: draft.type, by: draft.by };
    if (spec.needs.includes("for")) a.for = draft.for;
    updateFrame({ actions: [...frame.actions, a] });
    if (draft.type === "pass" || draft.type === "handoff") updateFrame({ actions: [...frame.actions, a], ball: draft.for });
  };

  const shown = playback || frame;
  const captionNote = playback?.note;
  const label = (a) =>
    `${a.type === "screen" ? `${a.by} screens for ${a.for}` :
      a.type === "pass" ? `${a.by} passes to ${a.for}` :
      a.type === "handoff" ? `${a.by} hands off to ${a.for}` :
      a.type === "cut" ? `${a.by} cuts` : `${a.by} dribbles`}`;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* court */}
      <div className="flex-1 min-w-0">
        <div className={`rounded-lg overflow-hidden border w-full ${COURT_MAX_W}`} style={{ borderColor: C.line, background: C.wood }}>
          <CourtSurface svgRef={svgRef} onPointerMove={onMove} onPointerUp={onUp}>
            {!inPlayback && prev && (
              <g opacity="0.22">
                {IDS.map((id) => (
                  <circle key={id} cx={prev.pos[id].x} cy={prev.pos[id].y} r="15" fill="none" stroke={C.muted} strokeWidth="1.5" strokeDasharray="3 3" />
                ))}
              </g>
            )}
            {!inPlayback && <ActionLayer frame={frame} prev={prev} />}
            {IDS.map((id) => (
              <Token key={id} id={id} p={shown.pos[id]} hasBall={shown.ball === id} draggable={!inPlayback} onDown={onDown} />
            ))}
          </CourtSurface>
        </div>

        {captionNote && inPlayback && (
          <div
            className="mt-2 px-3 py-2 rounded text-sm leading-snug"
            style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text, maxWidth: 400 }}
          >
            <span className="text-xs font-mono mr-2" style={{ color: C.ball }}>
              BEAT {(playback?.beatIdx ?? 0) + 1}
            </span>
            {captionNote}
          </div>
        )}

        {/* playback controls */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => {
              if (playing) {
                setPlaying(false);
              } else {
                if (elapsedMs >= totalMs) setElapsedMs(0);
                setPlaying(true);
              }
            }}
            className="px-3 py-2 rounded text-xs font-semibold tracking-wide"
            style={{ background: playing ? C.panel2 : C.ball, color: playing ? C.text : "#0E1116" }}
          >
            {playing ? "STOP" : elapsedMs > 0 && elapsedMs < totalMs ? "RESUME" : "RUN PLAY"}
          </button>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className="px-2 py-2 rounded text-xs font-mono"
              style={{
                background: speed === s ? C.panel2 : "transparent",
                border: `1px solid ${speed === s ? C.ball : C.line}`,
                color: speed === s ? C.text : C.muted,
              }}
            >
              {s}x
            </button>
          ))}
          {play.frames.map((f, i) => (
            <button
              key={f.id}
              onClick={() => {
                setPlaying(false);
                setIdx(i);
                setElapsedMs(0);
              }}
              className="px-3 py-2 rounded text-xs font-mono"
              style={{
                background: i === idx && !playing ? C.panel2 : "transparent",
                border: `1px solid ${i === idx && !playing ? C.ball : C.line}`,
                color: i === idx && !playing ? C.text : C.muted,
              }}
            >
              BEAT {i + 1}
            </button>
          ))}
          <button onClick={addFrame} className="px-3 py-2 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.muted }}>+ Beat</button>
          <button onClick={removeFrame} className="px-3 py-2 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Delete beat</button>
        </div>

        {/* scrub bar */}
        <div className="mt-2 flex items-center gap-2" style={{ maxWidth: 400 }}>
          <input
            type="range"
            min={0}
            max={Math.max(totalMs, 1)}
            step={16}
            value={Math.min(elapsedMs, totalMs)}
            onChange={(e) => {
              setPlaying(false);
              setElapsedMs(Number(e.target.value));
            }}
            className="flex-1 h-1 accent-orange-500 cursor-pointer"
            style={{ accentColor: C.ball }}
          />
          <span className="text-xs font-mono shrink-0" style={{ color: C.dim, minWidth: 72 }}>
            {playback ? `B${playback.beatIdx + 1}` : `B${idx + 1}`}
          </span>
        </div>
      </div>

      {/* inspector */}
      <div className="w-full lg:w-80 flex flex-col gap-3">
        <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-xs mb-2" style={{ color: C.dim, letterSpacing: "0.12em" }}>PLAY NAME</div>
          <input
            value={play.name}
            onChange={(e) => setPlay({ ...play, name: e.target.value })}
            className="w-full bg-transparent outline-none text-lg font-semibold"
            style={{ color: C.text }}
          />
          <div className="text-xs mt-1" style={{ color: C.muted }}>{play.category}</div>
        </div>

        <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-xs mb-2" style={{ color: C.dim, letterSpacing: "0.12em" }}>WHAT HAPPENS ON BEAT {idx + 1}</div>
          <textarea
            value={frame.note}
            onChange={(e) => updateFrame({ note: e.target.value })}
            rows={3}
            placeholder="Tell the player what this beat is."
            className="w-full bg-transparent outline-none text-sm resize-none"
            style={{ color: C.text }}
          />
        </div>

        <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-xs mb-2" style={{ color: C.dim, letterSpacing: "0.12em" }}>ACTIONS</div>
          {idx === 0 ? (
            <div className="text-xs" style={{ color: C.muted }}>Beat 1 is the alignment. Actions start on beat 2.</div>
          ) : (
            <>
              {frame.actions.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1">
                  <span style={{ color: C.text }}>{label(a)}</span>
                  <button
                    onClick={() => updateFrame({ actions: frame.actions.filter((x) => x.id !== a.id) })}
                    style={{ color: C.dim }}
                    className="text-xs px-2"
                  >
                    remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="flex-1 rounded px-2 py-1 text-xs outline-none"
                  style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}
                >
                  {ACTION_TYPES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <select
                  value={draft.by}
                  onChange={(e) => setDraft({ ...draft, by: e.target.value })}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}
                >
                  {IDS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <select
                  value={draft.for}
                  onChange={(e) => setDraft({ ...draft, for: e.target.value })}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}
                >
                  {IDS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <button onClick={addAction} className="px-3 rounded text-xs font-semibold" style={{ background: C.ball, color: "#0E1116" }}>Add</button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowJson((v) => !v)}
          className="rounded-lg p-3 text-left"
          style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}
        >
          <div className="text-xs" style={{ letterSpacing: "0.12em", color: C.dim }}>UNDER THE HOOD</div>
          <div className="text-sm mt-1" style={{ color: C.text }}>
            {showJson ? "Hide" : "Show"} the play as data
          </div>
          <div className="text-xs mt-1">This is what FastDraw doesn't have. It's why the quiz writes itself.</div>
        </button>
        {showJson && (
          <pre
            className="rounded-lg p-3 text-xs overflow-auto"
            style={{ background: "#0A0D12", border: `1px solid ${C.line}`, color: C.ok, maxHeight: 260 }}
          >
            {JSON.stringify(play.frames[idx], null, 1)}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   QUIZ GENERATION — derived entirely from the play model
   ============================================================ */
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function generateQuestions(play, myId) {
  const qs = [];
  const F = play.frames;

  for (let i = 1; i < F.length; i++) {
    const prev = F[i - 1];
    const cur = F[i];

    // 1. spatial recall — the differentiated one
    IDS.forEach((pid) => {
      if (dist(prev.pos[pid], cur.pos[pid]) > 45) {
        qs.push({
          kind: "spot",
          weight: pid === myId ? 3 : 1,
          player: pid,
          frameIdx: i,
          prompt: `You're #${pid}. Beat ${i + 1} — put yourself where you need to be.`,
          target: cur.pos[pid],
          from: prev,
        });
      }
    });

    cur.actions.forEach((a) => {
      if (a.type === "screen") {
        qs.push({
          kind: "mc",
          weight: a.for === myId || a.by === myId ? 3 : 1,
          prompt: `Beat ${i + 1}: who sets the screen for #${a.for}?`,
          correct: `#${a.by} (${POS_NAME[a.by]})`,
          options: IDS.filter((x) => x !== a.for).map((x) => `#${x} (${POS_NAME[x]})`),
          from: F[i - 1],
        });
      }
      if (a.type === "pass") {
        qs.push({
          kind: "mc",
          weight: a.by === myId ? 3 : 1,
          prompt: `Beat ${i + 1}: #${a.by} has it. Where's the ball going?`,
          correct: `#${a.for} (${POS_NAME[a.for]})`,
          options: IDS.filter((x) => x !== a.by).map((x) => `#${x} (${POS_NAME[x]})`),
          from: F[i - 1],
        });
      }
    });

    // 3. sequence recall
    if (cur.note && i < F.length) {
      const others = F.filter((f, j) => j !== i && f.note).map((f) => f.note);
      if (others.length >= 2) {
        qs.push({
          kind: "mc",
          weight: 1,
          prompt: `The play is on beat ${i}. What happens next?`,
          correct: cur.note,
          options: [cur.note, ...others],
          from: F[i - 1],
        });
      }
    }
  }

  // 4. coach-authored counters — the read questions
  play.counters.forEach((c) => {
    qs.push({
      kind: "mc",
      weight: 2,
      prompt: c.trigger + ". What's the read?",
      correct: c.answer,
      options: [c.answer, ...play.counters.filter((x) => x !== c).map((x) => x.answer)],
      from: F[1] || F[0],
    });
  });

  const weighted = qs.flatMap((q) => Array(q.weight).fill(q));
  const picked = [];
  const seen = new Set();
  for (const q of shuffle(weighted)) {
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    picked.push(q);
    if (picked.length >= 8) break;
  }
  return picked;
}

/* ============================================================
   PLAYER MODE
   ============================================================ */
function Player({ play }) {
  const [myId, setMyId] = useState("1");
  const [started, setStarted] = useState(false);
  const [qs, setQs] = useState([]);
  const [n, setN] = useState(0);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const svgRef = useRef(null);

  const begin = () => {
    setQs(generateQuestions(play, myId));
    setN(0); setScore(0); setGuess(null); setResult(null); setStarted(true);
  };

  const q = qs[n];

  const submit = () => {
    if (guess == null) return;
    let right;
    if (q.kind === "spot") right = dist(guess, q.target) <= 48;
    else right = guess === q.correct;
    setResult(right);
    if (right) setScore((s) => s + 1);
  };

  const next = () => {
    if (n + 1 >= qs.length) { setStarted(false); return; }
    setN(n + 1); setGuess(null); setResult(null);
  };

  const options = useMemo(() => (q && q.kind === "mc" ? shuffle([...new Set(q.options)]).slice(0, 4).includes(q.correct)
    ? shuffle([...new Set(q.options)]).slice(0, 4)
    : shuffle([q.correct, ...[...new Set(q.options)].filter((o) => o !== q.correct).slice(0, 3)])
    : []), [q]);

  if (!started) {
    const done = qs.length > 0;
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 480 }}>
        {done ? (
          <>
            <div className="text-xs mb-2" style={{ color: C.dim, letterSpacing: "0.14em" }}>SESSION COMPLETE</div>
            <div className="text-6xl font-bold font-mono mb-2" style={{ color: score / qs.length >= 0.75 ? C.ok : C.ball }}>
              {score}<span style={{ color: C.dim }}>/{qs.length}</span>
            </div>
            <p className="text-sm mb-6 max-w-sm" style={{ color: C.muted }}>
              Every miss feeds the spaced-repetition queue. Coach sees this on the dashboard by position.
            </p>
          </>
        ) : (
          <>
            <div className="text-xs mb-2" style={{ color: C.dim, letterSpacing: "0.14em" }}>TODAY'S REPS</div>
            <h2 className="text-3xl font-semibold mb-2" style={{ color: C.text }}>{play.name}</h2>
            <p className="text-sm mb-6 max-w-sm" style={{ color: C.muted }}>
              No one wrote these questions. They're generated from the play the coach drew.
            </p>
          </>
        )}
        <div className="flex gap-2 mb-6">
          {IDS.map((i) => (
            <button
              key={i}
              onClick={() => setMyId(i)}
              className="w-14 h-14 rounded-lg text-sm font-mono font-bold"
              style={{
                background: myId === i ? C.ball : C.panel,
                color: myId === i ? "#0E1116" : C.muted,
                border: `1px solid ${myId === i ? C.ball : C.line}`,
              }}
            >
              {i}<div className="text-xs font-normal">{POS_NAME[i]}</div>
            </button>
          ))}
        </div>
        <button onClick={begin} className="px-8 py-3 rounded-lg font-semibold" style={{ background: C.ball, color: "#0E1116" }}>
          {done ? "Run it again" : "Start"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      <div className="flex-1 min-w-0">
        <div className={`rounded-lg overflow-hidden border w-full ${COURT_MAX_W}`} style={{ borderColor: C.line }}>
          <CourtSurface
            svgRef={svgRef}
            onPointerDown={(e) => {
              if (q.kind !== "spot" || result !== null) return;
              setGuess(toSvg(svgRef.current, e));
            }}
          >
            {IDS.map((id) => (
              <Token
                key={id}
                id={id}
                p={q.from.pos[id]}
                hasBall={q.from.ball === id}
                faded={q.kind === "spot" && id === q.player}
                highlight={q.kind === "spot" && id === q.player && result === null}
              />
            ))}
            {q.kind === "spot" && guess && (
              <circle cx={guess.x} cy={guess.y} r="15" fill="none" stroke={result === false ? C.bad : C.ok} strokeWidth="3" strokeDasharray="4 3" />
            )}
            {q.kind === "spot" && result !== null && (
              <g>
                <circle cx={q.target.x} cy={q.target.y} r="18" fill="none" stroke={C.ok} strokeWidth="2.5" />
                <text x={q.target.x} y={q.target.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={C.ok} style={{ fontFamily: "ui-monospace, monospace" }}>
                  {q.player}
                </text>
              </g>
            )}
          </CourtSurface>
        </div>
      </div>

      <div className="w-full lg:w-80 flex flex-col">
        <div className="flex items-center gap-1 mb-3">
          {qs.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded" style={{ background: i < n ? C.ok : i === n ? C.ball : C.line }} />
          ))}
        </div>
        <div className="text-xs mb-2 font-mono" style={{ color: C.dim }}>
          {n + 1} / {qs.length} · YOU ARE #{myId} {POS_NAME[myId]}
        </div>
        <h3 className="text-xl font-semibold mb-4 leading-snug" style={{ color: C.text }}>{q.prompt}</h3>

        {q.kind === "spot" ? (
          <p className="text-sm mb-4" style={{ color: C.muted }}>Tap the spot on the floor.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {options.map((o) => {
              const chosen = guess === o;
              const reveal = result !== null;
              const isRight = o === q.correct;
              return (
                <button
                  key={o}
                  disabled={reveal}
                  onClick={() => setGuess(o)}
                  className="text-left px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    background: reveal && isRight ? "#12301F" : chosen ? C.panel2 : C.panel,
                    border: `1px solid ${reveal && isRight ? C.ok : reveal && chosen ? C.bad : chosen ? C.ball : C.line}`,
                    color: C.text,
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {result !== null && (
          <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: C.panel, border: `1px solid ${result ? C.ok : C.bad}`, color: C.text }}>
            <div className="font-semibold mb-1" style={{ color: result ? C.ok : C.bad }}>
              {result ? "That's it." : "Not quite."}
            </div>
            {q.kind === "spot" ? play.frames[q.frameIdx].note : q.correct}
          </div>
        )}

        <button
          onClick={result === null ? submit : next}
          disabled={guess == null}
          className="px-6 py-3 rounded-lg font-semibold"
          style={{
            background: guess == null ? C.panel : C.ball,
            color: guess == null ? C.dim : "#0E1116",
          }}
        >
          {result === null ? "Check" : n + 1 >= qs.length ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SHELL
   ============================================================ */
export default function PlayLab() {
  const [play, setPlay] = useState(SEED);
  const [mode, setMode] = useState("coach");

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.line }}>
        <div className="flex items-baseline gap-3">
          <span className="font-bold tracking-tight text-lg">PlayLab</span>
          <span className="text-xs font-mono" style={{ color: C.dim }}>{play.frames.length} BEATS · {play.counters.length} READS</span>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["coach", "Coach"], ["player", "Player"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className="px-4 py-1.5 text-sm font-medium"
              style={{ background: mode === k ? C.panel2 : "transparent", color: mode === k ? C.text : C.muted }}
            >
              {l}
            </button>
          ))}
        </div>
      </header>
      {mode === "coach" ? <Editor play={play} setPlay={setPlay} /> : <Player play={play} />}
    </div>
  );
}
