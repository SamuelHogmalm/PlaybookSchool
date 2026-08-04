"use client";

import { useRef, useState, useEffect } from "react";
import {
  C,
  W,
  COURT_MAX_W,
  IDS,
  CourtSurface,
  Token,
  ActionLayer,
  FlyingBall,
  toSvg,
} from "@/app/court/Court";
import {
  LINE_TOOLS,
  actionFromStroke,
  actionLabel,
  applyBeatChange,
  clampCourt,
  effectivePositions,
  sampleStroke,
  uid,
} from "@/lib/playModel";
import { getPlaybackState, playerHasBall, timelineDuration } from "@/lib/playback";

const SPEED_OPTIONS = [0.5, 1, 2];

function pathToSvgD(points) {
  if (!points?.length) return "";
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

function toolColor(id) {
  if (id === "cut") return C.cut;
  if (id === "screen") return C.screen;
  return C.ball;
}

function ToolSample({ sample, color }) {
  const stroke = toolColor(color);
  if (sample === "dashed") {
    return <line x1="4" y1="6" x2="36" y2="6" stroke={stroke} strokeWidth="2.5" strokeDasharray="5 4" />;
  }
  if (sample === "short-dash") {
    return <line x1="4" y1="6" x2="36" y2="6" stroke={stroke} strokeWidth="2.5" strokeDasharray="2 4" />;
  }
  if (sample === "screen") {
    return (
      <>
        <line x1="4" y1="6" x2="28" y2="6" stroke={stroke} strokeWidth="2.5" />
        <line x1="28" y1="0" x2="28" y2="12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }
  return <line x1="4" y1="6" x2="36" y2="6" stroke={stroke} strokeWidth="2.5" />;
}

function DraftStroke({ points, tool }) {
  if (points.length < 2) return null;
  const spec = LINE_TOOLS.find((a) => a.id === tool);
  const stroke = toolColor(spec?.color || "ball");
  const dashed = spec?.sample === "dashed" ? "9 7" : spec?.sample === "short-dash" ? "2 5" : undefined;
  return (
    <path
      d={pathToSvgD(points)}
      fill="none"
      stroke={stroke}
      strokeWidth="2.5"
      strokeDasharray={dashed}
      opacity="0.9"
    />
  );
}

/**
 * FastDraw-style editor: drag players on any beat, pick a line type and draw routes.
 */
export default function PlayDrawEditor({
  play,
  setPlay,
  beatIdx: controlledIdx,
  onBeatIdxChange,
  showPlayback = true,
  showNote = true,
  runLabel = "RUN PLAY",
}) {
  const [internalIdx, setInternalIdx] = useState(1);
  const idx = controlledIdx ?? internalIdx;
  const setIdx = onBeatIdxChange ?? setInternalIdx;

  const [history, setHistory] = useState([]);
  const [lineTool, setLineTool] = useState(null);
  const [draftPoints, setDraftPoints] = useState([]);
  const [msg, setMsg] = useState("");
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState(1);

  const svgRef = useRef(null);
  const dragPlayer = useRef(null);
  const dragStartSnapshot = useRef(null);
  const drawing = useRef(false);
  const strokeRef = useRef([]);
  const raf = useRef(null);

  const safeIdx = Math.min(idx, Math.max(0, play.frames.length - 1));
  const frame = play.frames[safeIdx];
  const prev = safeIdx > 0 ? play.frames[safeIdx - 1] : null;
  const totalMs = timelineDuration(play.frames, speed);
  const isPlaying = playing;
  const viewingScrub = !playing && elapsedMs > 0 && elapsedMs < totalMs;
  const playback = isPlaying || viewingScrub ? getPlaybackState(play.frames, elapsedMs, speed) : null;
  const canEdit = !isPlaying;
  const canDraw = !!lineTool && safeIdx > 0 && canEdit;

  useEffect(() => {
    if (idx !== safeIdx) setIdx(safeIdx);
  }, [idx, safeIdx, setIdx]);

  const snapshot = () => JSON.parse(JSON.stringify(play));

  const applyPlay = (next, recordHistory = true) => {
    if (recordHistory) setHistory((h) => [...h.slice(-49), snapshot()]);
    setPlay(next);
  };

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPlay(previous);
    setMsg("Undid last change");
    setPlaying(false);
    setElapsedMs(0);
    drawing.current = false;
    dragPlayer.current = null;
    strokeRef.current = [];
    setDraftPoints([]);
  };

  useEffect(() => {
    if (isPlaying && playback?.beatIdx != null && playback.beatIdx !== safeIdx) {
      setIdx(playback.beatIdx);
    }
  }, [isPlaying, playback?.beatIdx, safeIdx, setIdx]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(t);
  }, [msg]);

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
          return 0;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, totalMs]);

  if (!frame) {
    return (
      <p className="text-sm" style={{ color: C.muted }}>
        No beats yet — click + Add beat to start.
      </p>
    );
  }

  const updateFrame = (patch, recordHistory = true) => {
    const frames = applyBeatChange(play.frames, safeIdx, patch);
    applyPlay({ ...play, frames }, recordHistory);
  };

  const setFramesLive = (frames) => {
    setPlay({ ...play, frames });
  };

  const courtPoint = (e) => {
    if (!svgRef.current) return null;
    return clampCourt(toSvg(svgRef.current, e));
  };

  const onPlayerDown = (e, id) => {
    if (!canEdit) return;
    e.stopPropagation();

    if (canDraw) {
      const effective = prev ? effectivePositions(prev.pos, frame.pos, frame.actions) : frame.pos;
      const p = clampCourt(effective[id] ?? frame.pos[id]);
      drawing.current = true;
      strokeRef.current = [p];
      setDraftPoints([p]);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    dragPlayer.current = id;
    dragStartSnapshot.current = snapshot();
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onCourtDown = (e) => {
    if (!canEdit || !canDraw) return;
    const p = courtPoint(e);
    if (!p) return;
    drawing.current = true;
    strokeRef.current = [p];
    setDraftPoints([p]);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onCourtMove = (e) => {
    if (dragPlayer.current && !drawing.current) {
      const p = courtPoint(e);
      if (!p) return;
      const frames = applyBeatChange(play.frames, safeIdx, {
        pos: { [dragPlayer.current]: p },
      });
      setFramesLive(frames);
      return;
    }

    if (!drawing.current || !canDraw) return;
    const p = courtPoint(e);
    if (!p) return;
    const last = strokeRef.current[strokeRef.current.length - 1];
    const added = sampleStroke(last, p);
    if (!added.length) return;
    strokeRef.current = [...strokeRef.current, ...added];
    setDraftPoints([...strokeRef.current]);
  };

  const finalizeStroke = () => {
    const points = strokeRef.current;
    drawing.current = false;
    strokeRef.current = [];
    setDraftPoints([]);

    if (points.length < 2) return;

    const result = actionFromStroke({
      tool: lineTool,
      points,
      prevPos: prev?.pos,
      curPos: frame.pos,
      ball: frame.ball,
      existingActions: frame.actions,
    });

    if (result.error) {
      setMsg(result.error);
      return;
    }

    const { action, patch } = result;
    const updates = { actions: [...frame.actions, action] };
    if (patch.pos) updates.pos = patch.pos;
    if (patch.ball) updates.ball = patch.ball;
    updateFrame(updates);
    setMsg(`Added: ${actionLabel(action)}`);
  };

  const onCourtUp = () => {
    if (dragPlayer.current && !drawing.current) {
      if (dragStartSnapshot.current) {
        setHistory((h) => [...h.slice(-49), dragStartSnapshot.current]);
        dragStartSnapshot.current = null;
      }
      dragPlayer.current = null;
      return;
    }
    if (drawing.current) finalizeStroke();
    dragPlayer.current = null;
  };

  const addBeat = () => {
    const clone = {
      id: uid(),
      pos: JSON.parse(JSON.stringify(frame.pos)),
      ball: frame.ball,
      actions: [],
      note: "",
    };
    const frames = [...play.frames.slice(0, safeIdx + 1), clone, ...play.frames.slice(safeIdx + 1)];
    applyPlay({ ...play, frames });
    setIdx(safeIdx + 1);
  };

  const removeBeat = () => {
    if (play.frames.length <= 1) return;
    const frames = play.frames.filter((_, i) => i !== safeIdx);
    applyPlay({ ...play, frames });
    setIdx(Math.max(0, safeIdx - 1));
    setPlaying(false);
    setElapsedMs(0);
  };

  const removeLastAction = () => {
    if (!frame.actions.length) return;
    updateFrame({ actions: frame.actions.slice(0, -1) });
    setMsg("Removed last line");
  };

  const shown = playback || frame;
  const captionNote = playback?.note;
  const layerFrame = playback ? play.frames[playback.beatIdx] : frame;
  const layerPrev =
    playback && playback.beatIdx > 0 ? play.frames[playback.beatIdx - 1] : prev;
  const activeHint = safeIdx === 0
    ? "Beat 1: drag players into starting spots. Then switch to Beat 2 to draw lines."
    : lineTool
      ? LINE_TOOLS.find((t) => t.id === lineTool)?.hint
      : "Drag any player to move them. Pick a line type below to draw cuts, passes, screens.";

  return (
    <div className="flex flex-col gap-4">
      {/* Line tools — horizontal, always visible */}
      <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-xs mb-2 font-mono" style={{ color: C.dim, letterSpacing: "0.1em" }}>
          LINE TOOLS {safeIdx === 0 && <span style={{ color: C.ball }}>— switch to Beat 2+ to draw</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length || !canEdit}
            className="px-3 py-2 rounded text-xs font-semibold disabled:opacity-35 mr-1"
            style={{ border: `1px solid ${C.line}`, color: history.length ? C.text : C.dim }}
            title="Undo last change"
          >
            ↩ Undo
          </button>
          <span style={{ color: C.line }}>|</span>
          <button
            type="button"
            onClick={() => setLineTool(null)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded min-w-[72px]"
            style={{
              background: lineTool === null ? C.panel2 : "transparent",
              border: `2px solid ${lineTool === null ? C.text : C.line}`,
              color: lineTool === null ? C.text : C.muted,
            }}
          >
            <span className="text-lg leading-none">↖</span>
            <span className="text-xs font-semibold">Drag</span>
          </button>
          {LINE_TOOLS.map((t) => {
            const active = lineTool === t.id;
            const disabled = safeIdx === 0;
            const stroke = toolColor(t.color);
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => setLineTool(t.id)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded min-w-[72px] disabled:opacity-35"
                style={{
                  background: active ? C.panel2 : "transparent",
                  border: `2px solid ${active ? stroke : C.line}`,
                  color: active ? C.text : C.muted,
                }}
              >
                <svg width="40" height="12" aria-hidden>
                  <ToolSample sample={t.sample} color={t.color} />
                </svg>
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Court */}
        <div className="flex-1 min-w-0">
          <p className="text-sm mb-2" style={{ color: msg ? C.ball : C.muted }}>
            {msg || activeHint}
          </p>

          <div
            className={`rounded-lg overflow-hidden border w-full ${COURT_MAX_W} ${canDraw ? "cursor-crosshair" : ""}`}
            style={{ borderColor: C.line, background: C.wood }}
          >
            <CourtSurface
              svgRef={svgRef}
              onPointerDown={onCourtDown}
              onPointerMove={onCourtMove}
              onPointerUp={onCourtUp}
              suffix="-draw"
            >
              {canEdit && prev && (
                <g opacity="0.25">
                  {IDS.map((id) => (
                    <circle
                      key={id}
                      cx={prev.pos[id].x}
                      cy={prev.pos[id].y}
                      r="15"
                      fill="none"
                      stroke={C.muted}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  ))}
                  <text x={W / 2} y={16} textAnchor="middle" fontSize="11" fill={C.muted} style={{ userSelect: "none" }}>
                    ghost = where they were last beat
                  </text>
                </g>
              )}
              {layerPrev && (canEdit || isPlaying || viewingScrub) && (
                <ActionLayer frame={layerFrame} prev={layerPrev} suffix="-draw" />
              )}
              {canEdit && draftPoints.length > 1 && <DraftStroke points={draftPoints} tool={lineTool} />}
              {playback?.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
              {IDS.map((id) => (
                <g key={id} data-player-token>
                  <Token
                    id={id}
                    p={shown.pos[id]}
                    hasBall={playerHasBall(playback, frame, id)}
                    draggable={canEdit}
                    onDown={onPlayerDown}
                  />
                </g>
              ))}
            </CourtSurface>
          </div>

          {captionNote && isPlaying && (
            <div className="mt-2 px-3 py-2 rounded text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text, maxWidth: 420 }}>
              <span className="text-xs font-mono mr-2" style={{ color: C.ball }}>BEAT {(playback?.beatIdx ?? 0) + 1}</span>
              {captionNote}
            </div>
          )}

          {showPlayback && (
            <>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (playing) {
                      setPlaying(false);
                      setElapsedMs(0);
                    } else {
                      setElapsedMs(0);
                      setPlaying(true);
                    }
                  }}
                  className="px-4 py-2 rounded text-xs font-bold tracking-wide"
                  style={{ background: playing ? C.panel2 : C.ball, color: playing ? C.text : "#0E1116" }}
                >
                  {playing ? "■ STOP" : `▶ ${runLabel}`}
                </button>
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      background: speed === s ? C.panel2 : "transparent",
                      border: `1px solid ${speed === s ? C.ball : C.line}`,
                      color: speed === s ? C.text : C.muted,
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 mt-3 flex-wrap">
                <span className="text-xs mr-1" style={{ color: C.dim }}>Beat:</span>
                {play.frames.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setPlaying(false); setIdx(i); setElapsedMs(0); }}
                    className="px-3 py-1.5 rounded text-xs font-mono"
                    style={{
                      background: i === safeIdx && !playing ? C.ball : C.panel2,
                      color: i === safeIdx && !playing ? "#0E1116" : C.muted,
                      border: `1px solid ${i === safeIdx && !playing ? C.ball : C.line}`,
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button type="button" onClick={addBeat} className="px-3 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.muted }}>+ Add beat</button>
                {play.frames.length > 1 && (
                  <button type="button" onClick={removeBeat} className="px-3 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.bad }}>Delete</button>
                )}
              </div>

              <input
                type="range"
                min={0}
                max={Math.max(totalMs, 1)}
                step={16}
                value={Math.min(elapsedMs, totalMs)}
                onChange={(e) => { setPlaying(false); setElapsedMs(Number(e.target.value)); }}
                className="w-full max-w-md mt-2 h-1 cursor-pointer"
                style={{ accentColor: C.ball }}
              />
            </>
          )}
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-64 flex flex-col gap-3 shrink-0">
          {showNote && (
            <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-xs mb-2" style={{ color: C.dim }}>BEAT {safeIdx + 1} NOTE</div>
              <textarea
                value={frame.note}
                onChange={(e) => updateFrame({ note: e.target.value })}
                rows={2}
                placeholder="What happens?"
                className="w-full bg-transparent outline-none text-sm resize-none"
                style={{ color: C.text }}
              />
            </div>
          )}

          <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-xs mb-2" style={{ color: C.dim }}>BALL</div>
            <div className="flex gap-1">
              {IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateFrame({ ball: id })}
                  className="w-9 h-9 rounded text-sm font-bold font-mono"
                  style={{
                    background: frame.ball === id ? C.ball : C.panel2,
                    color: frame.ball === id ? "#0E1116" : C.text,
                    border: `1px solid ${frame.ball === id ? C.ball : C.line}`,
                  }}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-xs mb-2 flex items-center justify-between" style={{ color: C.dim }}>
              <span>LINES ON THIS BEAT</span>
              {frame.actions.length > 0 && (
                <button type="button" onClick={removeLastAction} className="text-xs" style={{ color: C.ball }}>
                  Undo line
                </button>
              )}
            </div>
            {safeIdx === 0 ? (
              <p className="text-xs" style={{ color: C.muted }}>Starting alignment — no lines yet.</p>
            ) : frame.actions.length === 0 ? (
              <p className="text-xs" style={{ color: C.muted }}>Draw a line to add one.</p>
            ) : (
              frame.actions.map((a) => (
                <div key={a.id} className="flex justify-between text-sm py-1 gap-2">
                  <span style={{ color: C.text }}>{actionLabel(a)}</span>
                  <button
                    type="button"
                    onClick={() => updateFrame({ actions: frame.actions.filter((x) => x.id !== a.id) })}
                    className="text-xs shrink-0"
                    style={{ color: C.dim }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { getPlaybackState, timelineDuration } from "@/lib/playback";
