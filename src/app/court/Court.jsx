"use client";

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
};

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
  const stroke = "#3D4A5C";

  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill={C.wood} />
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
  return (
    <defs>
      <marker id={`arrowCut${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={C.cut} />
      </marker>
      <marker id={`arrowBall${suffix}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={C.ball} />
      </marker>
    </defs>
  );
}

export function ActionLayer({ frame, prev, suffix = "" }) {
  if (!prev) return null;
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
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={C.ball} strokeWidth="2.5" markerEnd={ballMarker} />;
          }
          return <path key={a.id} d={squigglePath(from, to)} fill="none" stroke={C.ball} strokeWidth="2.5" markerEnd={ballMarker} />;
        }
        if (a.type === "cut") {
          if (route) {
            const end = pathArrowEnd(route);
            const trimmed = end ? route.slice(0, -1).concat([end]) : route;
            return <path key={a.id} d={pathToSvgD(trimmed)} fill="none" stroke={C.cut} strokeWidth="2.5" markerEnd={cutMarker} />;
          }
          const [p, q] = shorten(from, to, 15, 15);
          return <line key={a.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.cut} strokeWidth="2.5" markerEnd={cutMarker} />;
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
                stroke={C.ball}
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
              stroke={C.ball}
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
                stroke={C.cut}
                strokeWidth="2.5"
                markerEnd={cutMarker}
              />
              <circle cx={meet.x} cy={meet.y} r="6" fill="none" stroke={C.ball} strokeWidth="2" />
              {receiver && (
                <line
                  x1={meet.x}
                  y1={meet.y}
                  x2={receiver.x}
                  y2={receiver.y}
                  stroke={C.ball}
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

/** Cut arrows from beat-to-beat position changes (imported plays often have no actions). */
export function MovementArrows({
  prev,
  frame,
  suffix = "",
  highlightPlayer,
  minDist = 12,
  dimOthers = false,
}) {
  if (!prev?.pos || !frame?.pos) return null;

  const cutMarker = `url(#arrowCut${suffix})`;
  const ballMarker = `url(#arrowBall${suffix})`;
  const actionMovers = new Set(
    (frame.actions ?? [])
      .filter((a) => ["cut", "dribble", "screen", "handoff"].includes(a.type))
      .map((a) => a.by)
  );

  let passLine = null;
  if (prev.ball && frame.ball && prev.ball !== frame.ball) {
    const from = prev.pos[prev.ball];
    const to = frame.pos[frame.ball];
    if (from && to && dist(from, to) >= minDist) {
      const [p, q] = shorten(from, to, 16, 18);
      passLine = (
        <line
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={C.ball}
          strokeWidth="2.5"
          strokeDasharray="9 7"
          markerEnd={ballMarker}
        />
      );
    }
  }

  return (
    <g>
      {passLine}
      {IDS.map((id) => {
        if (actionMovers.has(id)) return null;
        const from = prev.pos[id];
        const to = frame.pos[id];
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
            stroke={highlighted ? C.ok : C.cut}
            strokeWidth={highlighted ? 3 : 2.5}
            markerEnd={cutMarker}
            opacity={dimOthers && highlightPlayer && !highlighted ? 0.45 : 0.95}
          />
        );
      })}
    </g>
  );
}

export function Token({ id, p, hasBall, highlight, faded, draggable, onDown }) {
  if (!p) return null;
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

/** Animated ball traveling in the air (pass / handoff) */
export function FlyingBall({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: "none" }}>
      <ellipse cx="0" cy="6" rx="6" ry="2.5" fill="#000" opacity="0.2" />
      <circle r="7" fill={C.ball} stroke="#0E1116" strokeWidth="1.5" />
      <path
        d="M -3 -2 Q 0 1 3 -2"
        fill="none"
        stroke="#0E1116"
        strokeWidth="1.2"
        opacity="0.35"
        strokeLinecap="round"
      />
    </g>
  );
}

export function CourtSurface({ children, onPointerDown, onPointerMove, onPointerUp, svgRef, suffix = "" }) {
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
      <Defs suffix={suffix} />
      <CourtBase />
      {children}
    </svg>
  );
}

export function CourtFrameView({
  frame,
  prev,
  suffix = "",
  maxWidthClass = COURT_MAX_W,
  showGhost = true,
  showActions = true,
  draggable = false,
  onDown = undefined,
}) {
  if (!frame?.pos) return null;
  return (
    <div className={`rounded-lg overflow-hidden border w-full ${maxWidthClass}`} style={{ borderColor: C.line, background: C.wood }}>
      <CourtSurface suffix={suffix}>
        {showGhost && prev && (
          <g opacity="0.22">
            {IDS.map((id) =>
              prev.pos[id] ? (
                <circle key={id} cx={prev.pos[id].x} cy={prev.pos[id].y} r="15" fill="none" stroke={C.muted} strokeWidth="1.5" strokeDasharray="3 3" />
              ) : null
            )}
          </g>
        )}
        {showActions && <ActionLayer frame={frame} prev={prev} suffix={suffix} />}
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
