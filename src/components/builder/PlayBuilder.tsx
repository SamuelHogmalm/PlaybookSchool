"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Play, PlayerId, Vec } from "@/lib/play/types";
import {
  addDrawnAction,
  confirmAction,
  confirmPlayActions,
  type DrawnActionInput,
  isValidDraw,
  removeAction,
} from "@/lib/play/actionOps";
import {
  addBeat,
  applyPresetToBeat,
  createEmptyPlay,
  deleteBeat,
  duplicateBeat,
  reorderBeat,
  setPlayBeats,
  updateBeatPlayerPos,
} from "@/lib/play/beatOps";
import { PRESET_NAMES, type AlignmentPresetName } from "@/lib/play/editor";
import { validatePlay } from "@/lib/play/validation";

import type { BuilderTool } from "./ActionPalette";
import { ActionPalette } from "./ActionPalette";
import { BeatStrip } from "./BeatStrip";
import { EditableCourt } from "./EditableCourt";
import { ScreenForPicker } from "./ScreenForPicker";
import { ValidationBanner } from "./ValidationBanner";

export function PlayBuilder() {
  const [play, setPlay] = useState<Play>(() => createEmptyPlay());
  const [beatIndex, setBeatIndex] = useState(0);
  const [tool, setTool] = useState<BuilderTool>("move");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>("1");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingScreen, setPendingScreen] = useState<{
    by: PlayerId;
    path: Vec[];
  } | null>(null);

  const beat = play.beats[beatIndex];
  const validation = useMemo(() => validatePlay(play), [play]);

  const selectedAction = beat?.actions.find((a) => a.id === selectedActionId);

  const updateBeats = useCallback((beats: Play["beats"]) => {
    setPlay((p) => setPlayBeats(p, beats));
  }, []);

  const onMovePlayer = (playerId: PlayerId, pos: Vec) => {
    updateBeats(updateBeatPlayerPos(play.beats, beatIndex, playerId, pos));
  };

  const onPreset = (name: AlignmentPresetName) => {
    updateBeats(applyPresetToBeat(play.beats, beatIndex, name));
  };

  const commitDraw = (input: DrawnActionInput) => {
    if (!isValidDraw(input)) return;
    const next = addDrawnAction(play.beats, beatIndex, input);
    const added = next[beatIndex].actions[next[beatIndex].actions.length - 1];
    updateBeats(next);
    setSelectedActionId(added.id);
  };

  const onDrawComplete = (input: DrawnActionInput) => {
    commitDraw(input);
  };

  const onScreenForPick = (forPlayer: PlayerId) => {
    if (!pendingScreen) return;
    commitDraw({
      type: "screen",
      by: pendingScreen.by,
      for: forPlayer,
      path: pendingScreen.path,
    });
    setPendingScreen(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedActionId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      updateBeats(removeAction(play.beats, beatIndex, selectedActionId));
      setSelectedActionId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beatIndex, play.beats, selectedActionId, updateBeats]);

  if (!beat) return null;

  const hasReviewFlags = play.beats.some((b) =>
    b.actions.some((a) => a.needsReview || a.derived),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 text-stone-100">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{play.name}</h1>
        <p className="text-sm text-stone-400">
          Select a tool, click a player to select them, drag from their token to draw.
          Move mode drags destination ghosts. Pass sets possession automatically.
        </p>
      </header>

      <ValidationBanner result={validation} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-stone-400">Tools</h2>
        <ActionPalette
          beat={beat}
          tool={tool}
          onToolChange={(t) => {
            setTool(t);
            setSelectedActionId(null);
          }}
          selectedPlayer={selectedPlayerId}
        />
        {selectedPlayerId && (
          <p className="text-xs text-stone-500">
            Selected player {selectedPlayerId}
            {beat.startBall === selectedPlayerId ? " (has ball)" : ""}
          </p>
        )}
      </section>

      {pendingScreen && (
        <ScreenForPicker
          screener={pendingScreen.by}
          onPick={onScreenForPick}
          onCancel={() => setPendingScreen(null)}
        />
      )}

      <EditableCourt
        beat={beat}
        tool={tool}
        selectedPlayerId={selectedPlayerId}
        selectedActionId={selectedActionId}
        onSelectPlayer={setSelectedPlayerId}
        onSelectAction={setSelectedActionId}
        onMovePlayer={onMovePlayer}
        onDrawComplete={onDrawComplete}
        onScreenNeedsFor={setPendingScreen}
      />

      {selectedAction && (
        <section className="rounded-md border border-stone-700 bg-stone-900/50 px-4 py-3 text-sm">
          <p>
            Selected: {selectedAction.type} by {selectedAction.by}
            {selectedAction.for ? ` for ${selectedAction.for}` : ""}
            {selectedAction.needsReview || selectedAction.derived
              ? " (needs review)"
              : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                updateBeats(
                  removeAction(play.beats, beatIndex, selectedAction.id),
                );
                setSelectedActionId(null);
              }}
              className="rounded border border-red-800 px-3 py-1 text-red-200 hover:bg-red-950/40"
            >
              Delete action
            </button>
            {(selectedAction.needsReview || selectedAction.derived) && (
              <button
                type="button"
                onClick={() => {
                  updateBeats(
                    confirmAction(play.beats, beatIndex, selectedAction.id),
                  );
                }}
                className="rounded border border-emerald-700 px-3 py-1 text-emerald-200 hover:bg-emerald-950/40"
              >
                Looks right
              </button>
            )}
          </div>
        </section>
      )}

      {hasReviewFlags && (
        <button
          type="button"
          onClick={() => setPlay(confirmPlayActions(play))}
          className="self-start rounded border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40"
        >
          Looks right — confirm whole play
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-stone-400">Alignment preset</h2>
        <div className="flex flex-wrap gap-2">
          {PRESET_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onPreset(name)}
              className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <BeatStrip
        beats={play.beats}
        selectedIndex={beatIndex}
        onSelect={(i) => {
          setBeatIndex(i);
          setSelectedActionId(null);
          setPendingScreen(null);
        }}
        onAdd={() => {
          updateBeats(addBeat(play.beats));
          setBeatIndex(play.beats.length);
        }}
        onDuplicate={() => {
          updateBeats(duplicateBeat(play.beats, beatIndex));
          setBeatIndex(beatIndex + 1);
        }}
        onDelete={() => {
          if (play.beats.length <= 2) return;
          updateBeats(deleteBeat(play.beats, beatIndex));
          setBeatIndex(Math.min(beatIndex, play.beats.length - 2));
        }}
        onMoveLeft={() => {
          if (beatIndex === 0) return;
          updateBeats(reorderBeat(play.beats, beatIndex, beatIndex - 1));
          setBeatIndex(beatIndex - 1);
        }}
        onMoveRight={() => {
          if (beatIndex >= play.beats.length - 1) return;
          updateBeats(reorderBeat(play.beats, beatIndex, beatIndex + 1));
          setBeatIndex(beatIndex + 1);
        }}
        canDelete={play.beats.length > 2}
      />
    </div>
  );
}
