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

import {
  canRedo,
  canUndo,
  commit as commitHistory,
  type History,
  initHistory,
  redo as redoHistory,
  replacePresent,
  undo as undoHistory,
} from "@/lib/play/history";
import { PlayAnimator } from "@/components/animator";

import type { BuilderTool } from "./ActionPalette";
import { ActionPalette } from "./ActionPalette";
import { BeatStrip } from "./BeatStrip";
import { EditableCourt } from "./EditableCourt";
import { ScreenForPicker } from "./ScreenForPicker";
import { ValidationBanner } from "./ValidationBanner";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; version: number }
  | { status: "error"; message: string; errors: string[] };

export function PlayBuilder() {
  const [history, setHistory] = useState<History<Play>>(() =>
    initHistory(createEmptyPlay()),
  );
  const play = history.present;
  const [beatIndex, setBeatIndex] = useState(0);
  const [tool, setTool] = useState<BuilderTool>("move");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>("1");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingScreen, setPendingScreen] = useState<{
    by: PlayerId;
    path: Vec[];
  } | null>(null);
  // Bumping the nonce remounts PlayAnimator, which is how it resets (key={play.id}).
  const [preview, setPreview] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const beat = play.beats[beatIndex];
  const validation = useMemo(() => validatePlay(play), [play]);

  const selectedAction = beat?.actions.find((a) => a.id === selectedActionId);

  /**
   * The one mutation path. Everything that changes the play goes through here so
   * a step can never bypass history — including the "confirm whole play" button.
   */
  const mutate = useCallback((fn: (current: Play) => Play) => {
    setHistory((h) => commitHistory(h, fn(h.present)));
    setSaveState({ status: "idle" });
  }, []);

  const updateBeats = useCallback(
    (beats: Play["beats"]) => mutate((p) => setPlayBeats(p, beats)),
    [mutate],
  );

  const onUndo = useCallback(() => {
    setHistory((h) => undoHistory(h));
    setSelectedActionId(null);
    setPendingScreen(null);
  }, []);

  const onRedo = useCallback(() => {
    setHistory((h) => redoHistory(h));
    setSelectedActionId(null);
    setPendingScreen(null);
  }, []);

  const onSave = async () => {
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...play, valid: true, validationErrors: [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveState({
          status: "error",
          message: body.error ?? `Save failed (${res.status})`,
          errors: body.validationErrors ?? [],
        });
        return;
      }
      // Save echo is not an edit — it must not become an undo step.
      setHistory((h) =>
        replacePresent(h, { ...h.present, version: body.play.version }),
      );
      setSaveState({ status: "saved", version: body.play.version });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
        errors: [],
      });
    }
  };

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
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedActionId) return;
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
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{play.name}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo(history)}
              title="Undo (Ctrl+Z)"
              className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo(history)}
              title="Redo (Ctrl+Shift+Z)"
              className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↷ Redo
            </button>
          </div>
        </div>
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

      {preview === null ? (
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
      ) : (
        <section className="space-y-3">
          <PlayAnimator
            key={`${play.id}-${preview}`}
            play={play}
            from={0}
            playing
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreview((n) => (n ?? 0) + 1)}
              className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
            >
              Close preview
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPreview((n) => (n ?? 0) + 1)}
          disabled={!validation.valid}
          title={
            validation.valid ? undefined : "Fix validation errors before previewing"
          }
          className="rounded border border-amber-700 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!validation.valid || saveState.status === "saving"}
          title={validation.valid ? undefined : "Fix validation errors before saving"}
          className="rounded border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveState.status === "saving" ? "Saving…" : "Save play"}
        </button>
        {saveState.status === "saved" && (
          <span className="text-sm text-emerald-300">
            Saved — version {saveState.version}
          </span>
        )}
      </section>

      {saveState.status === "error" && (
        <section className="rounded-md border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">{saveState.message}</p>
          {saveState.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-300">
              {saveState.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

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
          onClick={() => mutate((p) => confirmPlayActions(p))}
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
