"use client";

import { createContext, useContext } from "react";

/** @deprecated legacy demo palette — prefer paper theme via CourtSurface */
export const C = {
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
  courtLine: "#3D4A5C",
};

/** Playbook School court — chalkboard inside paper frame */
export const C_PAPER = {
  bg: "#16181c",
  panel: "#1e2128",
  panel2: "#343840",
  line: "#5c6474",
  text: "#edeae4",
  muted: "#a8a29e",
  dim: "#78716c",
  ball: "#e8560f",
  screen: "#3e82c4",
  cut: "#c9a227",
  ok: "#2e8b57",
  bad: "#c4362e",
  wood: "#16181c",
  courtLine: "#6b7280",
};

const CourtColorsContext = createContext(C_PAPER);

export function useCourtColors() {
  return useContext(CourtColorsContext);
}

export function courtPalette(theme = "paper") {
  return theme === "dark" ? C : C_PAPER;
}

export const W = 500;
export const H = 470;
export const COURT_MAX_W = "max-w-[400px]";
const HOOP = { x: 250, y: 52.5 };
export const IDS = ["1", "2", "3", "4", "5"];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

// Court scale: 12 ft key width → 160 px
const PX_PER_IN = 160 / 144;
const COLLEGE_3PT_IN = 22 * 12 + 1.75; // 22′1¾″ arc radius
const CORNER_INSET_IN = 42; // ~3′6″ corner straight inset (NCAA-style break)
const THREE_PT_DIAGRAM_SCALE = 0.75; // shrink for half-court diagram (full NCAA is too large)

/** NCAA 3pt: vertical corner segments from baseline up to arc, then arc across. */
function collegeThreePointD(cx, cy, r, leftCornerX, rightCornerX) {
  const yOnArc = (x) => cy + Math.sqrt(Math.max(0, r * r - (x - cx) ** 2));
  const leftY = yOnArc(leftCornerX);
  const rightY = yOnArc(rightCornerX);

  const leftA = Math.atan2(leftY - cy, leftCornerX - cx);
  const rightA = Math.atan2(rightY - cy, rightCornerX - cx);
  const bottomA = Math.PI / 2;
  const leftA2 = leftA < bottomA ? leftA + 2 * Math.PI : leftA;

  const steps = 32;
  let d = `M ${leftCornerX} 0 L ${leftCornerX} ${leftY}`;
  for (let i = 0; i <= steps; i++) {
    const a = leftA2 + (i / steps) * (bottomA - leftA2);
    d += ` L ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }
  for (let i = 1; i <= steps; i++) {
    const a = bottomA + (i / steps) * (rightA - bottomA);
    d += ` L ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }
  d += ` L ${rightCornerX} ${rightY} L ${rightCornerX} 0`;
  return d;
}

function CourtBase() {
  const colors = useCourtColors();
  const cx = HOOP.x;
  const cy = HOOP.y;
  const r3 = COLLEGE_3PT_IN * PX_PER_IN * THREE_PT_DIAGRAM_SCALE;
  const leftCornerX = CORNER_INSET_IN * PX_PER_IN * THREE_PT_DIAGRAM_SCALE;
  const rightCornerX = W - leftCornerX;

  const keyL = 170;
  const keyR = 330;
  const keyH = 190;
  const ftR = 60;
  const boardY = 8;
  const stroke = colors.courtLine;

  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={colors.wood} />
      <rect x="1" y="1" width={W - 2} height={H - 2} fill="none" stroke={stroke} strokeWidth="2" />

      {/* Key / paint */}
      <rect x={keyL} y="0" width={keyR - keyL} height={keyH} fill="none" stroke={stroke} strokeWidth="2" />

      {/* Free-throw circle — dashed inside paint, solid toward half court */}
      <path
        d={`M ${cx - ftR} ${keyH} A ${ftR} ${ftR} 0 0 1 ${cx + ftR} ${keyH}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray="7 5"
      />
      <path
        d={`M ${cx - ftR} ${keyH} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${keyH}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      {/* Three-point line — NCAA: straight corners + arc */}
      <path
        d={collegeThreePointD(cx, cy, r3, leftCornerX, rightCornerX)}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      {/* Backboard, support, rim */}
      <line x1={cx} y1={boardY} x2={cx} y2="0" stroke={stroke} strokeWidth="2" />
      <line x1={cx - 60} y1={boardY} x2={cx + 60} y2={boardY} stroke={stroke} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="9" fill="none" stroke={stroke} strokeWidth="2" />

      {/* Half-court line + center circle (bottom) */}
      <line x1="0" y1={H} x2={W} y2={H} stroke={stroke} strokeWidth="2" />
      <path
        d={`M ${cx - ftR} ${H} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${H}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
    </g>
  );
}

function Defs({ suffix = "" }) {
  const colors = useCourtColors();
  return (
    <defs>
      <marker id={`arrowCut${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.cut} />
      </marker>
      <marker id={`arrowBall${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.ball} />
      </marker>
    </defs>
  );
}

export function ActionLayer({ frame, prev, suffix = "" }) {
  if (!prev) return null;
  const colors = useCourtColors();
  const cutMarker = `url(#arrowCut${suffix})`;
  const ballMarker = `url(#arrowBall${suffix})`;

  const effPos = (actionIndex) => {
    const out = { ...frame.pos };
    for (const a of frame.actions.slice(0, actionIndex)) {
      if (
        (a.type === "cut" || a.type === "dribble" || a.type === "screen" || a.type === "handoff") &&
        a.path?.length
      ) {
        out[a.by] = a.path[a.path.length - 1];
      }
    }
    return out;
  };

  return (
    <g>
      {frame.actions.map((a, actionIndex) => {
        const atPos = effPos(actionIndex);
        const from = atPos[a.by] ?? prev.pos[a.by];
        const to = frame.pos[a.by];
        const route = a.path?.length >= 2 ? a.path : null;

        if (a.type === "dribble") {
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={colors.ball} strokeWidth="2.5" markerEnd={ballMarker} />;
          }
          return <path key={a.id} d={squigglePath(from, to)} fill="none" stroke={colors.ball} strokeWidth="2.5" markerEnd={ballMarker} />;
        }
        if (a.type === "cut") {
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={colors.cut} strokeWidth="2.5" markerEnd={cutMarker} />;
          }
          const [p, q] = shorten(from, to, 15, 15);
          return <line key={a.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={colors.cut} strokeWidth="2.5" markerEnd={cutMarker} />;
        }
        if (a.type === "pass") {
          const target = frame.pos[a.for];
          const passFrom = route ? route[0] : from;
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return (
              <path
                key={a.id}
                d={pathToSvgD(trimmed)}
                fill="none"
                stroke={colors.ball}
                strokeWidth="2.5"
                strokeDasharray="9 7"
                markerEnd={ballMarker}
              />
            );
          }
          const [p, q] = shorten(passFrom, target, 16, 18);
          return (
            <line
              key={a.id}
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              stroke={colors.ball}
              strokeWidth="2.5"
              strokeDasharray="9 7"
              markerEnd={ballMarker}
            />
          );
        }
        if (a.type === "handoff") {
          const meet = route ? route[route.length - 1] : to;
          const handRoute = route?.length >= 2 ? route : [from, meet];
          const end = pathArrowEnd(handRoute);
          const trimmed = end ? handRoute.slice(0, -1).concat([end]) : handRoute;
          const receiver = frame.pos[a.for];
          return (
            <g key={a.id}>
              <path
                d={pathToSvgD(trimmed)}
                fill="none"
                stroke={colors.cut}
                strokeWidth="2.5"
                markerEnd={cutMarker}
              />
              <circle cx={meet.x} cy={meet.y} r="6" fill="none" stroke={colors.ball} strokeWidth="2" />
              {receiver && (
                <line
                  x1={meet.x}
                  y1={meet.y}
                  x2={receiver.x}
                  y2={receiver.y}
                  stroke={colors.ball}
                  strokeWidth="1.5"
                  strokeDasharray="2 4"
                  opacity="0.45"
                />
              )}
            </g>
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
                <path d={pathToSvgD(moveRoute)} fill="none" stroke={colors.screen} strokeWidth="2.5" />
              ) : (
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={colors.screen} strokeWidth="2.5" />
              )}
              <line x1={q.x - px} y1={q.y - py} x2={q.x + px} y2={q.y + py} stroke={colors.screen} strokeWidth="3.5" strokeLinecap="round" />
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

/** Cut arrows from beat-to-beat position changes (imported plays often have no actions). */
export function MovementArrows({
  prev,
  frame,
  suffix = "",
  highlightPlayer,
  minDist = 12,
  dimOthers = false,
  fromPositions,
  toPositions,
}) {
  if (!prev?.pos || !frame?.pos) return null;

  const colors = useCourtColors();
  const fromPos = fromPositions ?? prev.pos;
  const toPos = toPositions ?? frame.pos;

  const cutMarker = `url(#arrowCut${suffix})`;
  const ballMarker = `url(#arrowBall${suffix})`;
  const actions = frame.actions ?? [];
  const actionMovers = new Set(
    actions
      .filter((a) => ["cut", "dribble", "screen", "handoff"].includes(a.type))
      .map((a) => a.by)
  );
  for (const a of actions) {
    if (a.type === "pass" || a.type === "handoff") {
      if (a.by) actionMovers.add(a.by);
    }
  }

  const hasExplicitPass =
    prev.ball &&
    frame.ball &&
    prev.ball !== frame.ball &&
    actions.some(
      (a) =>
        (a.type === "pass" || a.type === "handoff") &&
        a.by === prev.ball &&
        a.for === frame.ball
    );

  let passLine = null;
  if (!hasExplicitPass && prev.ball && frame.ball && prev.ball !== frame.ball) {
    const from = fromPos[prev.ball];
    const to = toPos[frame.ball];
    if (from && to && dist(from, to) >= minDist) {
      const [p, q] = shorten(from, to, 16, 18);
      passLine = (
        <line
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={colors.ball}
          strokeWidth="2.5"
          strokeDasharray="9 7"
          markerEnd={ballMarker}
        />
      );
    }
  }

  return (
    <g style={{ pointerEvents: "none" }}>
      {passLine}
      {IDS.map((id) => {
        if (actionMovers.has(id)) return null;
        const from = fromPos[id];
        const to = toPos[id];
        if (!from || !to || dist(from, to) < minDist) return null;
        const highlighted = highlightPlayer === id;
        const [p, q] = shorten(from, to, 15, 15);
        return (
          <line
            key={id}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={highlighted ? colors.ok : colors.cut}
            strokeWidth={highlighted ? 3 : 2.5}
            markerEnd={cutMarker}
            opacity={dimOthers && highlightPlayer && !highlighted ? 0.45 : 0.95}
          />
        );
      })}
    </g>
  );
}

/** Faded markers for where players were on the previous beat. */
export function BeatGhostMarkers({ positions, opacity = 0.38, showLabels = true }) {
  if (!positions) return null;
  const colors = useCourtColors();
  return (
    <g opacity={opacity} style={{ pointerEvents: "none" }}>
      {IDS.map((id) => {
        const p = positions[id];
        if (!p) return null;
        return (
          <g key={id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="none"
              stroke={colors.muted}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {showLabels && (
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={colors.muted}
                style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}
              >
                {id}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function Token({ id, p, hasBall, highlight, faded, draggable, onDown }) {
  if (!p) return null;
  const colors = useCourtColors();
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      onPointerDown={draggable ? (e) => onDown(e, id) : undefined}
      style={{ cursor: draggable ? "grab" : "default", opacity: faded ? 0.28 : 1 }}
    >
      {highlight && <circle r="24" fill="none" stroke={colors.ok} strokeWidth="2" opacity="0.7" />}
      <circle r="15" fill={colors.panel2} stroke={hasBall ? colors.ball : colors.muted} strokeWidth={hasBall ? 3 : 2} />
      <text textAnchor="middle" y="5.5" fontSize="15" fontWeight="700" fill={colors.text} style={{ fontFamily: "ui-monospace, monospace", userSelect: "none" }}>
        {id}
      </text>
      {hasBall && <circle cx="12" cy="-12" r="5" fill={colors.ball} />}
    </g>
  );
}

/** Animated ball traveling in the air (pass / handoff) */
export function FlyingBall({ x, y }) {
  const colors = useCourtColors();
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: "none" }}>
      <ellipse cx="0" cy="6" rx="6" ry="2.5" fill="#000" opacity="0.2" />
      <circle r="7" fill={colors.ball} stroke={colors.wood} strokeWidth="1.5" />
      <path
        d="M -3 -2 Q 0 1 3 -2"
        fill="none"
        stroke={colors.wood}
        strokeWidth="1.2"
        opacity="0.35"
        strokeLinecap="round"
      />
    </g>
  );
}

export function CourtSurface({
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  svgRef,
  suffix = "",
  theme = "paper",
}) {
  const colors = courtPalette(theme);
  return (
    <CourtColorsContext.Provider value={colors}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <Defs suffix={suffix} />
        <CourtBase />
        {children}
      </svg>
    </CourtColorsContext.Provider>
  );
}

export function CourtFrameView({
  frame,
  prev,
  next: _next,
  suffix = "",
  maxWidthClass = COURT_MAX_W,
  showGhost = false,
  showActions = true,
  /** Inferred cut/pass lines for this beat (prev → frame). Off when explicit actions render. */
  showMovementLines = true,
  draggable = false,
  onDown = undefined,
  theme = "paper",
}) {
  if (!frame?.pos) return null;
  const hasExplicitActions = (frame.actions?.length ?? 0) > 0;
  const showInferred = showMovementLines && prev?.pos && !(showActions && hasExplicitActions);
  return (
    <div className={`overflow-hidden border border-rule w-full ${maxWidthClass} ${theme === "paper" ? "ps-court-frame" : "rounded-lg"}`} style={theme === "paper" ? undefined : { borderColor: C.line, background: C.wood }}>
      <CourtSurface suffix={suffix} theme={theme}>
        {showGhost && prev && <BeatGhostMarkers positions={prev.pos} />}
        {showInferred && (
          <MovementArrows
            prev={prev}
            frame={frame}
            suffix={suffix}
            fromPositions={prev.pos}
            toPositions={frame.pos}
          />
        )}
        {showActions && hasExplicitActions && prev && (
          <ActionLayer frame={frame} prev={prev} suffix={suffix} />
        )}
        {IDS.map((id) => (
          <Token key={id} id={id} p={frame.pos[id]} hasBall={frame.ball === id} draggable={draggable} onDown={onDown} />
        ))}
      </CourtSurface>
    </div>
  );
}

export function toSvg(svgEl, e) {
  const r = svgEl.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}
