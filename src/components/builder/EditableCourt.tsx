"use client";

import { useCallback, useRef, useState } from "react";

import { CourtRenderer } from "@/components/court";
import { polylineToSvgD } from "@/lib/court";
import type { ActionType, Beat, PlayerId, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import type { DrawnActionInput } from "@/lib/play/actionOps";
import {
  actionHitPaths,
  canDrawAction,
  hitTestPath,
  MIN_DRAW_LENGTH,
  nearestPlayerAt,
  targetPositions,
  pathLength,
} from "@/lib/play/drawing";
import { clientToCourt, snapClampPoint } from "@/lib/play/editor";
import { dist } from "@/lib/play/geometry";

import type { BuilderTool } from "./ActionPalette";
import { DrawPreview } from "./DrawPreview";

type Props = {
  beat: Beat;
  tool: BuilderTool;
  selectedPlayerId: PlayerId | null;
  selectedActionId: string | null;
  onSelectPlayer: (id: PlayerId | null) => void;
  onSelectAction: (id: string | null) => void;
  onMovePlayer: (playerId: PlayerId, pos: Vec) => void;
  /** A player drag finished — close the live run into one undo step. */
  onMoveEnd: () => void;
  /** Fires on every pointer move of a draw, so the play updates while the coach draws. */
  onDrawProgress: (input: DrawnActionInput) => void;
  onDrawComplete: (input: DrawnActionInput) => void;
  /** A draw that ended without producing an action — anything live must be rolled back. */
  onDrawCancel: () => void;
  onScreenNeedsFor: (draft: { by: PlayerId; path: Vec[] }) => void;
  /** Draw only these actions, so a long sequence stays readable. */
  onlyActionIds?: ReadonlySet<string>;
};

type DrawState = {
  type: ActionType;
  by: PlayerId;
  path: Vec[];
};

export function EditableCourt({
  beat,
  tool,
  selectedPlayerId,
  selectedActionId,
  onSelectPlayer,
  onSelectAction,
  onMovePlayer,
  onMoveEnd,
  onDrawProgress,
  onDrawComplete,
  onDrawCancel,
  onScreenNeedsFor,
  onlyActionIds,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPlayer, setDraggingPlayer] = useState<PlayerId | null>(null);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Vec | null>(null);
  /**
   * Authoritative draw state. Several pointer moves can fire between renders, and each
   * handler would otherwise close over the same stale path and drop points.
   */
  const drawingRef = useRef<DrawState | null>(null);
  /** True once this stroke has written anything into the play. */
  const wroteLiveRef = useRef(false);

  const courtPoint = useCallback((clientX: number, clientY: number): Vec | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    return snapClampPoint(
      clientToCourt(clientX, clientY, svg.getBoundingClientRect()),
    );
  }, []);

  /** Where a pass can land: players sit at the end of any movement already drawn. */
  const targets = targetPositions(beat);

  const canDrawFrom = useCallback(
    (playerId: PlayerId): boolean =>
      canDrawAction(beat, playerId, tool).allowed,
    [beat, tool],
  );

  /**
   * Where a new stroke begins: the end of this player's existing movements, or their
   * start position if they have none. A second stroke continues from where the first
   * left them, which is what `chainPlayerMovements` stores anyway — anchoring here too
   * just means the preview matches what gets committed.
   */
  const drawAnchorFor = (playerId: PlayerId): Vec | undefined => {
    const movements = beat.actions.filter(
      (a) =>
        a.by === playerId &&
        (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
    );
    if (!movements.length) return beat.startPos[playerId];
    return beat.pos[playerId] ?? beat.startPos[playerId];
  };

  const startDraw = (playerId: PlayerId, pt: Vec) => {
    if (tool === "move") return;
    const start = drawAnchorFor(playerId);
    if (!start) return;
    const state: DrawState = { type: tool, by: playerId, path: [start, pt] };
    drawingRef.current = state;
    wroteLiveRef.current = false;
    setDrawing(state);
    onSelectAction(null);
  };

  /** Grow the stroke. Returns the new path, or null if the move was too small to keep. */
  const appendDrawPoint = (pt: Vec): Vec[] | null => {
    const d = drawingRef.current;
    if (!d) return null;
    const last = d.path[d.path.length - 1];
    if (dist(last, pt) < 8) return null;
    const path = [...d.path, pt];
    drawingRef.current = { ...d, path };
    setDrawing(drawingRef.current);
    return path;
  };

  /**
   * Push the in-progress stroke into the play.
   *
   * Screens are held back: a screen needs the player it is set for, and the coach picks
   * that after the stroke, so there is no valid action to write yet. Passes and handoffs
   * wait for the cursor to find a receiver, for the same reason.
   */
  const emitProgress = (path: Vec[]) => {
    const d = drawingRef.current;
    if (!d || d.type === "screen") return;

    if (d.type === "pass" || d.type === "handoff") {
      const receiver = nearestPlayerAt(
        targets,
        path[path.length - 1],
        36,
        d.by,
      );
      if (!receiver) return;
      wroteLiveRef.current = true;
      onDrawProgress({
        type: d.type,
        by: d.by,
        for: receiver,
        path: [...path.slice(0, -1), { ...targets[receiver] }],
      });
      return;
    }

    wroteLiveRef.current = true;
    onDrawProgress({ type: d.type, by: d.by, path });
  };

  const endDraw = () => {
    drawingRef.current = null;
    setDrawing(null);
    setPreviewTarget(null);
  };

  /** Nothing usable came of the stroke — drop whatever it wrote along the way. */
  const abandonDraw = () => {
    if (wroteLiveRef.current) onDrawCancel();
    wroteLiveRef.current = false;
    endDraw();
  };

  const finishDraw = (end: Vec) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    let path = [...drawing.path];
    const last = path[path.length - 1];
    if (dist(last, end) >= 8) path.push(end);
    path = path.map((p) => snapClampPoint(p));

    if (pathLength(path) < MIN_DRAW_LENGTH) {
      abandonDraw();
      return;
    }

    if (drawing.type === "pass" || drawing.type === "handoff") {
      const receiver = nearestPlayerAt(targets, end, 36, drawing.by);
      if (!receiver) {
        abandonDraw();
        return;
      }
      path[path.length - 1] = { ...targets[receiver] };
      onDrawComplete({
        type: drawing.type,
        by: drawing.by,
        for: receiver,
        path,
      });
    } else if (drawing.type === "screen") {
      onScreenNeedsFor({ by: drawing.by, path });
    } else {
      onDrawComplete({
        type: drawing.type,
        by: drawing.by,
        path,
      });
    }

    wroteLiveRef.current = false;
    endDraw();
  };

  const onStartPointerDown = (playerId: PlayerId) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectPlayer(playerId);

    if (tool === "move") return;

    const gate = canDrawAction(beat, playerId, tool);
    if (!gate.allowed) return;

    const pt = courtPoint(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    startDraw(playerId, pt);
  };

  const onDestPointerDown = (playerId: PlayerId) => (e: React.PointerEvent) => {
    if (tool !== "move") return;
    e.preventDefault();
    onSelectPlayer(playerId);
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggingPlayer(playerId);
    onSelectAction(null);
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    const pt = courtPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (draggingPlayer) {
      onMovePlayer(draggingPlayer, pt);
      return;
    }

    const active = drawingRef.current;
    if (active) {
      const path = appendDrawPoint(pt);
      if (path) emitProgress(path);

      if (active.type === "pass" || active.type === "handoff") {
        const recv = nearestPlayerAt(targets, pt, 36, active.by);
        setPreviewTarget(recv ? targets[recv] : pt);
      } else if (active.type === "screen") {
        const cutter = nearestPlayerAt(targets, pt, 80, active.by);
        setPreviewTarget(cutter ? targets[cutter] : pt);
      } else {
        setPreviewTarget(null);
      }
    }
  };

  const onOverlayPointerUp = (e: React.PointerEvent) => {
    const pt = courtPoint(e.clientX, e.clientY);
    if (draggingPlayer) {
      setDraggingPlayer(null);
      onMoveEnd();
      return;
    }
    if (!drawingRef.current) return;
    if (pt) finishDraw(pt);
    else abandonDraw();
  };

  /**
   * The browser took the gesture away — touch scroll, a system gesture, a lost device.
   * There is no end point to finish on, so drop whatever the stroke wrote.
   */
  const onOverlayPointerCancel = () => {
    if (draggingPlayer) {
      setDraggingPlayer(null);
      onMoveEnd();
      return;
    }
    if (drawingRef.current) abandonDraw();
  };

  const onBackgroundClick = (e: React.PointerEvent) => {
    if (drawing || draggingPlayer) return;
    const pt = courtPoint(e.clientX, e.clientY);
    if (!pt) return;

    for (const { id, points } of actionHitPaths(beat)) {
      if (hitTestPath(pt, points)) {
        onSelectAction(id);
        return;
      }
    }
    onSelectAction(null);
  };

  const previewPath = drawing?.path ?? null;
  const screenPreviewTarget =
    drawing?.type === "screen" && previewTarget
      ? previewTarget
      : drawing?.type === "pass" || drawing?.type === "handoff"
        ? previewTarget ?? undefined
        : undefined;

  return (
    <div className="relative w-full max-w-[400px]">
      <CourtRenderer
        beat={beat}
        tokensAt="end"
        onlyActionIds={onlyActionIds}
        showDestinations
        showDestinationHandles={tool === "move"}
        draggingPlayer={draggingPlayer}
        svgRef={svgRef}
        highlightActionId={selectedActionId ?? undefined}
        highlightPlayerId={selectedPlayerId ?? undefined}
      />
      <svg
        viewBox="0 0 500 470"
        role="group"
        aria-label={`Beat ${beat.id} — editing surface. Tool: ${tool}.`}
        className="absolute inset-0 h-full w-full touch-none select-none"
      >
        {previewPath && drawing && (
          <DrawPreview
            type={drawing.type}
            path={
              drawing.type === "pass" || drawing.type === "handoff"
                ? previewTarget
                  ? [...previewPath.slice(0, -1), previewTarget]
                  : previewPath
                : previewPath
            }
            target={screenPreviewTarget ?? undefined}
          />
        )}

        {/*
          No onPointerLeave: both gestures call setPointerCapture on pointerdown, so
          pointerup is delivered here even when the pointer is released off the court.
          Treating "left the court" as "finished" ended a stroke early whenever a coach
          drew through the sideline and back.
        */}
        <g
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerCancel={onOverlayPointerCancel}
        >
          <rect
            x={0}
            y={0}
            width={500}
            height={470}
            fill="transparent"
            style={{ pointerEvents: drawing ? "none" : "all" }}
            onPointerDown={onBackgroundClick}
          />

          {!drawing &&
            actionHitPaths(beat)
              .filter(({ id }) => !onlyActionIds || onlyActionIds.has(id))
              .map(({ id, points }) => (
              <path
                key={`hit-${id}`}
                // Hit testing follows the stored polyline, not the rendered curve — the
                // 16-unit stroke is wider than the curve ever strays from its chords.
                d={polylineToSvgD(points)}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectAction(id);
                }}
              />
            ))}

          {tool === "move" &&
            PLAYER_IDS.map((id) => {
              const p = beat.pos[id];
              if (!p) return null;
              return (
                <circle
                  key={`dest-${id}`}
                  cx={p.x}
                  cy={p.y}
                  r="18"
                  fill="transparent"
                  style={{
                    pointerEvents: "all",
                    cursor: draggingPlayer === id ? "grabbing" : "grab",
                  }}
                  onPointerDown={onDestPointerDown(id)}
                />
              );
            })}

          {/*
            Hit targets follow the tokens, which now stand at their end positions. In
            move mode they are skipped entirely: the drag handle is in the same place,
            and a draw target on top of it would swallow the pointer.
          */}
          {tool !== "move" && PLAYER_IDS.map((id) => {
            const p = targets[id];
            if (!p) return null;
            const drawOk = canDrawFrom(id);
            const holdsBall = beat.startBall === id;
            const isSelected = selectedPlayerId === id;
            return (
              <circle
                key={`start-${id}`}
                cx={p.x}
                cy={p.y}
                r="16"
                fill="transparent"
                // Focusable so a player can be selected without a pointer. Drawing
                // itself is still pointer-only — see PROPOSALS.md.
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`Player ${id}${holdsBall ? ", has the ball" : ""}${
                  isSelected ? ", selected" : ""
                }`}
                className="focus-visible:outline-none focus-visible:[stroke:#fbbf24] focus-visible:[stroke-width:3]"
                style={{
                  pointerEvents: "all",
                  cursor: drawOk ? "crosshair" : "not-allowed",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPlayer(id);
                  }
                }}
                onPointerDown={onStartPointerDown(id)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
