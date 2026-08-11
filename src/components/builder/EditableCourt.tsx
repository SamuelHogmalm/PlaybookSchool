"use client";

import { useCallback, useRef, useState } from "react";

import { CourtRenderer } from "@/components/court";
import type { ActionType, Beat, PlayerId, Vec } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";
import type { DrawnActionInput } from "@/lib/play/actionOps";
import {
  actionHitPaths,
  canDrawAction,
  hitTestPath,
  MIN_DRAW_LENGTH,
  nearestPlayerAt,
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
  onDrawComplete: (input: DrawnActionInput) => void;
  onScreenNeedsFor: (draft: { by: PlayerId; path: Vec[] }) => void;
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
  onDrawComplete,
  onScreenNeedsFor,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPlayer, setDraggingPlayer] = useState<PlayerId | null>(null);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Vec | null>(null);

  const courtPoint = useCallback((clientX: number, clientY: number): Vec | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    return snapClampPoint(
      clientToCourt(clientX, clientY, svg.getBoundingClientRect()),
    );
  }, []);

  const canDrawFrom = useCallback(
    (playerId: PlayerId): boolean =>
      canDrawAction(beat, playerId, tool).allowed,
    [beat, tool],
  );

  const startDraw = (playerId: PlayerId, pt: Vec) => {
    if (tool === "move") return;
    const start = beat.startPos[playerId];
    if (!start) return;
    setDrawing({
      type: tool,
      by: playerId,
      path: [start, pt],
    });
    onSelectAction(null);
  };

  const appendDrawPoint = (pt: Vec) => {
    setDrawing((d) => {
      if (!d) return d;
      const last = d.path[d.path.length - 1];
      if (dist(last, pt) < 8) return d;
      return { ...d, path: [...d.path, pt] };
    });
  };

  const finishDraw = (end: Vec) => {
    if (!drawing) return;
    let path = [...drawing.path];
    const last = path[path.length - 1];
    if (dist(last, end) >= 8) path.push(end);
    path = path.map((p) => snapClampPoint(p));

    if (pathLength(path) < MIN_DRAW_LENGTH) {
      setDrawing(null);
      setPreviewTarget(null);
      return;
    }

    if (drawing.type === "pass" || drawing.type === "handoff") {
      const receiver = nearestPlayerAt(beat.startPos, end, 36, drawing.by);
      if (!receiver) {
        setDrawing(null);
        setPreviewTarget(null);
        return;
      }
      path[path.length - 1] = { ...beat.startPos[receiver] };
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

    setDrawing(null);
    setPreviewTarget(null);
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

    if (drawing) {
      appendDrawPoint(pt);
      if (drawing.type === "pass" || drawing.type === "handoff") {
        const recv = nearestPlayerAt(beat.startPos, pt, 36, drawing.by);
        setPreviewTarget(recv ? beat.startPos[recv] : pt);
      } else if (drawing.type === "screen") {
        const cutter = nearestPlayerAt(beat.startPos, pt, 80, drawing.by);
        setPreviewTarget(cutter ? beat.startPos[cutter] : pt);
      } else {
        setPreviewTarget(null);
      }
    }
  };

  const onOverlayPointerUp = (e: React.PointerEvent) => {
    const pt = courtPoint(e.clientX, e.clientY);
    if (draggingPlayer) {
      setDraggingPlayer(null);
      return;
    }
    if (drawing && pt) {
      finishDraw(pt);
    }
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
        showDestinations
        svgRef={svgRef}
        highlightActionId={selectedActionId ?? undefined}
        highlightPlayerId={selectedPlayerId ?? undefined}
      />
      <svg
        viewBox="0 0 500 470"
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

        <g
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerLeave={onOverlayPointerUp}
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
            actionHitPaths(beat).map(({ id, points }) => (
              <path
                key={`hit-${id}`}
                d={points.reduce(
                  (d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
                  "",
                )}
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

          {PLAYER_IDS.map((id) => {
            const p = beat.startPos[id];
            if (!p) return null;
            const drawOk = tool !== "move" && canDrawFrom(id);
            return (
              <circle
                key={`start-${id}`}
                cx={p.x}
                cy={p.y}
                r="16"
                fill="transparent"
                style={{
                  pointerEvents: "all",
                  cursor: drawOk ? "crosshair" : tool === "move" ? "default" : "not-allowed",
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
