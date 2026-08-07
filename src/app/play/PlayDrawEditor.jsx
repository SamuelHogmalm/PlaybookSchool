"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  C,
  W,
  H,
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
  beatEndPositions,
  beatStartPositions,
  clampCourt,
  effectivePositions,
  sampleStroke,
  uid,
} from "@/lib/playModel";
import {
  reindexBeatActions,
  appendBeatAction,
  actionTimingRows,
  moveTimingStep,
  mergeStepWithNext,
  splitActionToNewStep,
} from "@/lib/breakdownUtils";
import ActiveRouteLayer from "@/app/play/ActiveRouteLayer";
import {
  buildSequentialTimeline,
  getSequentialPlaybackState,
  sequentialTimelineDuration,
} from "@/lib/sequentialPlayback";
import { playerHasBallFromState } from "@/hooks/useSequentialPlayback";
import { SPEED_OPTIONS } from "@/lib/playback";

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
  theme = "dark",
}) {
  const paper = theme === "paper";
  const [internalIdx, setInternalIdx] = useState(0);
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
  const timeline = useMemo(() => buildSequentialTimeline(play.frames), [play.frames]);
  const totalMs = sequentialTimelineDuration(timeline, speed);
  const isPlaying = playing;
  const viewingScrub = !playing && elapsedMs > 0 && elapsedMs < totalMs;
  const playback = isPlaying || viewingScrub ? getSequentialPlaybackState(timeline, elapsedMs * speed) : null;
  const canEdit = !isPlaying;
  const canDraw = !!lineTool && canEdit;
  const posBase = prev?.pos ?? frame.pos;

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
      const effective = effectivePositions(posBase, frame.pos, frame.actions);
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
      prevPos: posBase,
      curPos: frame.pos,
      ball: frame.ball,
      existingActions: frame.actions,
    });

    if (result.error) {
      setMsg(result.error);
      return;
    }

    const { action, patch } = result;
    const updates = { actions: appendBeatAction(frame.actions, action) };
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
    const next = reindexBeatActions(frame.actions.slice(0, -1));
    updateFrame({ actions: next, inferMoves: next.length ? frame.inferMoves : false });
    setMsg("Removed last line");
  };

  const timingRows = useMemo(() => actionTimingRows(frame.actions), [frame.actions]);

  const removeAction = (actionId) => {
    const next = reindexBeatActions(frame.actions.filter((x) => x.id !== actionId));
    updateFrame({
      actions: next,
      inferMoves: next.length ? frame.inferMoves : false,
    });
    setMsg("Removed movement");
  };

  const clearAllActions = () => {
    if (!frame.actions.length) return;
    updateFrame({ actions: [], inferMoves: false });
    setMsg("Cleared all lines on this beat");
  };

  const tokenPos = playback?.pos ?? frame.pos;
  const captionNote = playback?.note;
  const activeHint = lineTool
    ? LINE_TOOLS.find((t) => t.id === lineTool)?.hint
    : "Each beat = one PDF frame. Drag players, draw lines to match the diagram.";

  const startPos = prev ? beatStartPositions(prev, frame) : frame.pos;
  const endPos = prev ? beatEndPositions(prev, frame) : frame.pos;
  const distPt = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  return (
    <div className="flex flex-col gap-4">
      <div className={paper ? "ps-editor-toolbar" : "rounded-lg p-3"} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}` }}>
        <div className={`text-xs mb-2 font-mono ${paper ? "text-ink-soft uppercase tracking-widest" : ""}`} style={paper ? undefined : { color: C.dim, letterSpacing: "0.1em" }}>
          LINE TOOLS
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length || !canEdit}
            className={paper ? "ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs mr-1 disabled:opacity-35" : "px-3 py-2 rounded text-xs font-semibold disabled:opacity-35 mr-1"}
            style={paper ? undefined : { border: `1px solid ${C.line}`, color: history.length ? C.text : C.dim }}
            title="Undo last change"
          >
            ↩ Undo
          </button>
          {!paper && <span style={{ color: C.line }}>|</span>}
          <button
            type="button"
            onClick={() => setLineTool(null)}
            className={paper ? `ps-editor-tool-btn ${lineTool === null ? "is-active" : ""}` : "flex flex-col items-center gap-1 px-3 py-2 rounded min-w-[72px]"}
            style={paper ? undefined : {
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
            const stroke = toolColor(t.color);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setLineTool(t.id)}
                className={
                  paper
                    ? `ps-editor-tool-btn ${active ? "is-active" : ""}`
                    : "flex flex-col items-center gap-1 px-3 py-2 rounded min-w-[72px]"
                }
                style={
                  paper
                    ? active
                      ? { borderColor: stroke }
                      : undefined
                    : {
                        background: active ? C.panel2 : "transparent",
                        border: `2px solid ${active ? stroke : C.line}`,
                        color: active ? C.text : C.muted,
                      }
                }
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
          <p className={`text-sm mb-2 ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: msg ? C.ball : C.muted }}>
            {msg || activeHint}
          </p>

          <div
            className={`overflow-hidden border w-full ${COURT_MAX_W} ${canDraw ? "cursor-crosshair" : ""} ${paper ? "ps-court-frame" : "rounded-lg"}`}
            style={paper ? undefined : { borderColor: C.line, background: C.wood }}
          >
            <CourtSurface
              svgRef={svgRef}
              theme={paper ? "paper" : "dark"}
              onPointerDown={onCourtDown}
              onPointerMove={onCourtMove}
              onPointerUp={onCourtUp}
              suffix="-draw"
            >
              {canEdit && !isPlaying && !viewingScrub && frame.actions.length > 0 && (
                <ActionLayer frame={frame} prev={prev} suffix="-draw" />
              )}
              {(isPlaying || viewingScrub) && playback && (
                <ActiveRouteLayer activeRoutes={playback.activeRoutes ?? []} suffix="-draw" />
              )}
              {canEdit && draftPoints.length > 1 && <DraftStroke points={draftPoints} tool={lineTool} />}
              {playback?.ballInAir && <FlyingBall x={playback.ballInAir.x} y={playback.ballInAir.y} />}
              {IDS.map((id) => (
                <g key={id} data-player-token>
                  <Token
                    id={id}
                    p={tokenPos[id]}
                    hasBall={
                      playback
                        ? playerHasBallFromState(playback, id)
                        : frame.ball === id
                    }
                    draggable={canEdit}
                    onDown={onPlayerDown}
                  />
                </g>
              ))}
            </CourtSurface>
          </div>

          {captionNote && (isPlaying || viewingScrub) && (
            <div className={`mt-2 px-3 py-2 text-sm max-w-md ${paper ? "border border-rule bg-paper-2" : "rounded"}`} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}`, color: C.text, maxWidth: 420 }}>
              <span className={`text-xs font-mono mr-2 ${paper ? "text-jersey font-data" : ""}`} style={paper ? undefined : { color: C.ball }}>BEAT {(playback?.beatIdx ?? 0) + 1}</span>
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
                  className={paper ? "ps-btn ps-btn-primary py-0 min-h-[36px] text-xs" : "px-4 py-2 rounded text-xs font-bold tracking-wide"}
                  style={paper ? undefined : { background: playing ? C.panel2 : C.ball, color: playing ? C.text : "#0E1116" }}
                >
                  {playing ? "■ STOP" : `▶ ${runLabel}`}
                </button>
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={paper ? `ps-editor-beat-btn ${speed === s ? "is-active" : ""}` : "px-2 py-1 rounded text-xs font-mono"}
                    style={paper ? undefined : {
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
                <span className={`text-xs mr-1 ${paper ? "font-data text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim }}>Beat:</span>
                {play.frames.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setPlaying(false); setIdx(i); setElapsedMs(0); }}
                    className={paper ? `ps-editor-beat-btn ${i === safeIdx && !playing ? "is-active" : ""}` : "px-3 py-1.5 rounded text-xs font-mono"}
                    style={paper ? undefined : {
                      background: i === safeIdx && !playing ? C.ball : C.panel2,
                      color: i === safeIdx && !playing ? "#0E1116" : C.muted,
                      border: `1px solid ${i === safeIdx && !playing ? C.ball : C.line}`,
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button type="button" onClick={addBeat} className={paper ? "ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs" : "px-3 py-1.5 rounded text-xs"} style={paper ? undefined : { border: `1px solid ${C.line}`, color: C.muted }}>+ Add beat</button>
                {play.frames.length > 1 && (
                  <button type="button" onClick={removeBeat} className={paper ? "ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs text-flag" : "px-3 py-1.5 rounded text-xs"} style={paper ? undefined : { border: `1px solid ${C.line}`, color: C.bad }}>Delete</button>
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
                style={{ accentColor: paper ? "var(--jersey)" : C.ball }}
              />
            </>
          )}
        </div>

        <div className="w-full lg:w-64 flex flex-col gap-3 shrink-0">
          {showNote && (
            <div className={paper ? "ps-editor-side" : "rounded-lg p-3"} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}` }}>
              <div className={`text-xs mb-2 ${paper ? "font-data uppercase tracking-widest text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim }}>BEAT {safeIdx + 1} NOTE</div>
              <textarea
                value={frame.note}
                onChange={(e) => updateFrame({ note: e.target.value })}
                rows={2}
                placeholder="What happens?"
                className={`w-full bg-transparent outline-none text-sm resize-none ${paper ? "text-ink ps-input border-0 p-0 min-h-0" : ""}`}
                style={paper ? undefined : { color: C.text }}
              />
            </div>
          )}

          <div className={paper ? "ps-editor-side" : "rounded-lg p-3"} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}` }}>
            <div className={`text-xs mb-2 ${paper ? "font-data uppercase tracking-widest text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim }}>BALL</div>
            <div className="flex gap-1">
              {IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateFrame({ ball: id })}
                  className={paper ? `font-data w-9 h-9 border text-sm font-bold min-h-[36px] ${frame.ball === id ? "border-jersey bg-jersey/10 text-jersey" : "border-rule text-ink-soft"}` : "w-9 h-9 rounded text-sm font-bold font-mono"}
                  style={paper ? undefined : {
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

          <div className={paper ? "ps-editor-side" : "rounded-lg p-3"} style={paper ? undefined : { background: C.panel, border: `1px solid ${C.line}` }}>
            <div className={`text-xs mb-2 flex items-center justify-between gap-2 ${paper ? "font-data uppercase tracking-widest text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim }}>
              <span>Play order this beat</span>
              <div className="flex gap-2">
                {frame.actions.length > 0 && (
                  <>
                    <button type="button" onClick={clearAllActions} className={`text-xs ${paper ? "text-flag font-semibold" : ""}`} style={paper ? undefined : { color: C.bad }}>
                      Clear all
                    </button>
                    <button type="button" onClick={removeLastAction} className={`text-xs ${paper ? "text-chalk font-semibold" : ""}`} style={paper ? undefined : { color: C.ball }}>
                      Undo last
                    </button>
                  </>
                )}
              </div>
            </div>
            {frame.actions.length === 0 ? (
              <p className={`text-xs ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>No lines yet — pick a line type and draw on the court.</p>
            ) : (
              <>
              <div className="space-y-2">
                {timingRows.map((row, rowIdx) => (
                  <div
                    key={row.step}
                    className={`rounded border p-2 ${paper ? "border-rule bg-paper-2/40" : ""}`}
                    style={paper ? undefined : { borderColor: C.line, background: C.panel2 }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-widest ${paper ? "font-data text-jersey" : "font-mono"}`} style={paper ? undefined : { color: C.ball }}>
                        Step {row.step}
                        {row.items.length > 1 && (
                          <span className={`ml-1.5 normal-case font-normal ${paper ? "text-ink-soft" : ""}`} style={paper ? undefined : { color: C.muted }}>
                            · same time
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={rowIdx === 0}
                          onClick={() => {
                            updateFrame({ actions: moveTimingStep(frame.actions, rowIdx, -1) });
                            setMsg("Moved step earlier");
                          }}
                          className={`px-1.5 py-0.5 text-xs ${paper ? "text-ink-soft disabled:opacity-30" : ""}`}
                          style={paper ? undefined : { color: C.muted }}
                          title="Move step earlier"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={rowIdx === timingRows.length - 1}
                          onClick={() => {
                            updateFrame({ actions: moveTimingStep(frame.actions, rowIdx, 1) });
                            setMsg("Moved step later");
                          }}
                          className={`px-1.5 py-0.5 text-xs ${paper ? "text-ink-soft disabled:opacity-30" : ""}`}
                          style={paper ? undefined : { color: C.muted }}
                          title="Move step later"
                        >
                          ↓
                        </button>
                        {rowIdx < timingRows.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              updateFrame({ actions: mergeStepWithNext(frame.actions, rowIdx) });
                              setMsg("Merged with next step — same time");
                            }}
                            className={`px-1.5 py-0.5 text-[10px] ${paper ? "text-chalk font-semibold" : ""}`}
                            style={paper ? undefined : { color: C.ball }}
                            title="Run with next step at the same time"
                          >
                            + next
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {row.items.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className={`flex-1 min-w-0 ${paper ? "text-ink font-data" : ""}`} style={paper ? undefined : { color: C.text }}>
                            {actionLabel(a)}
                            {a.uncertain && (
                              <span className="ml-1 text-flag font-semibold" title={a.reason ?? "AI uncertain — verify this line"}>
                                ?
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {row.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateFrame({ actions: splitActionToNewStep(frame.actions, a.id) });
                                  setMsg("Split to own step");
                                }}
                                className={`px-1 text-[10px] ${paper ? "text-ink-soft" : ""}`}
                                style={paper ? undefined : { color: C.dim }}
                                title="Own step"
                              >
                                split
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeAction(a.id)}
                              className={`text-xs px-1 ${paper ? "text-ink-soft" : ""}`}
                              style={paper ? undefined : { color: C.dim }}
                              aria-label="Remove movement"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] mt-2 ${paper ? "text-ink-soft font-data" : ""}`} style={paper ? undefined : { color: C.dim }}>
                Each step runs in order. Use <strong>+ next</strong> to put moves on the same row (same time).
              </p>
              </>
            )}
            {safeIdx > 0 && prev && (
              <div className={`mt-3 pt-3 border-t ${paper ? "border-rule" : ""}`} style={paper ? undefined : { borderColor: C.line }}>
                <p className={`text-[10px] mb-1.5 uppercase tracking-widest ${paper ? "font-data text-ink-soft" : ""}`} style={paper ? undefined : { color: C.dim }}>
                  End spots
                </p>
                <ul className="space-y-0.5">
                  {IDS.map((id) => {
                    const from = startPos[id];
                    const to = endPos[id];
                    const moved = from && to && distPt(from, to) >= 8;
                    return (
                      <li key={id} className={`font-data text-[11px] ${moved ? (paper ? "text-jersey" : "") : (paper ? "text-ink-soft" : "")}`} style={paper ? undefined : { color: moved ? C.ball : C.dim }}>
                        #{id} {moved ? `→ (${Math.round(to.x)}, ${Math.round(to.y)})` : "holds"}
                        {frame.ball === id && (paper ? " · ball" : "")}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { buildSequentialTimeline, sequentialTimelineDuration } from "@/lib/sequentialPlayback";
