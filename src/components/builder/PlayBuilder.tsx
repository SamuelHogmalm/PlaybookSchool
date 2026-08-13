"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Play, PlayerId, Vec } from "@/lib/play/types";
import {
  confirmAction,
  confirmPlayActions,
  type DrawnActionInput,
  isValidDraw,
  nextActionId,
  removeAction,
  upsertDrawnAction,
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
  checkpoint,
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

/**
 * How long a run of live edits coalesces before it becomes one undo step.
 *
 * Long enough that an ordinary stroke or token drag is a single Ctrl+Z, short enough
 * that a slow deliberate drag still leaves intermediate states to go back to.
 */
const LIVE_CHECKPOINT_MS = 400;

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; version: number }
  | {
      status: "error";
      title: string;
      detail: string;
      errors: string[];
      tone: "warn" | "error";
    };

/**
 * Save failures a coach can actually act on. Each status means something different
 * about what to do next, so none of them share copy.
 */
function describeSaveFailure(
  status: number,
  body: { error?: string; validationErrors?: string[] },
): Extract<SaveState, { status: "error" }> {
  if (status === 401) {
    return {
      status: "error",
      tone: "warn",
      title: "Not signed in — this play is local only",
      detail:
        "Your work is safe in this tab, but nothing has been sent to the cloud. Sign in and press Save again to keep it.",
      errors: [],
    };
  }
  if (status === 409) {
    return {
      status: "error",
      tone: "warn",
      title: "Create your team before saving plays",
      detail:
        "Plays belong to a team, and your account isn't on one yet. Create a team, then press Save again — nothing here is lost.",
      errors: [],
    };
  }
  if (status === 403) {
    return {
      status: "error",
      tone: "warn",
      title: "Coach account required",
      detail: "Only coaches can add plays to a team's playbook.",
      errors: [],
    };
  }
  if (status === 422) {
    return {
      status: "error",
      tone: "error",
      title: "This play isn't ready to save",
      detail:
        "Every play has to hold together as basketball before players can drill it. Fix these, then save:",
      errors: body.validationErrors ?? [],
    };
  }
  if (status === 503) {
    return {
      status: "error",
      tone: "warn",
      title: "Cloud saving isn't set up",
      detail:
        "The app has no database configured, so plays can't be stored yet. Keep this tab open — your play is still here.",
      errors: [],
    };
  }
  return {
    status: "error",
    tone: "error",
    title: `Save failed (${status})`,
    detail: body.error ?? "Something went wrong on the way to the server. Try again.",
    errors: [],
  };
}

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

  /** State from before the drag in progress, and the id the drag is writing to. */
  const liveBaseRef = useRef<Play | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftActionIdRef = useRef<string | null>(null);

  /** Close the current run of live edits into one undo step. */
  const flushLive = useCallback(() => {
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    const base = liveBaseRef.current;
    liveBaseRef.current = null;
    if (base) setHistory((h) => checkpoint(h, base));
  }, []);

  /**
   * A live edit: the play changes now, but the undo step is deferred.
   *
   * A drag fires this on every pointer move. Each frame going onto the undo stack would
   * make Ctrl+Z walk back through a stroke a few pixels at a time, so the frames replace
   * the present and a checkpoint lands on the debounce — a long drag leaves a handful of
   * coarse steps, a quick one leaves a single step.
   */
  const mutateLive = useCallback(
    (fn: (current: Play) => Play) => {
      if (liveBaseRef.current === null) liveBaseRef.current = play;
      setHistory((h) => replacePresent(h, fn(h.present)));
      setSaveState({ status: "idle" });
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(flushLive, LIVE_CHECKPOINT_MS);
    },
    [play, flushLive],
  );

  /**
   * The one mutation path for discrete edits. Everything that changes the play goes
   * through here or `mutateLive` so a step can never bypass history — including the
   * "confirm whole play" button.
   */
  const mutate = useCallback(
    (fn: (current: Play) => Play) => {
      flushLive();
      setHistory((h) => commitHistory(h, fn(h.present)));
      setSaveState({ status: "idle" });
    },
    [flushLive],
  );

  const updateBeats = useCallback(
    (beats: Play["beats"]) => mutate((p) => setPlayBeats(p, beats)),
    [mutate],
  );

  const updateBeatsLive = useCallback(
    (beats: Play["beats"]) => mutateLive((p) => setPlayBeats(p, beats)),
    [mutateLive],
  );

  useEffect(
    () => () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    },
    [],
  );

  const onUndo = useCallback(() => {
    flushLive();
    setHistory((h) => undoHistory(h));
    setSelectedActionId(null);
    setPendingScreen(null);
  }, [flushLive]);

  const onRedo = useCallback(() => {
    flushLive();
    setHistory((h) => redoHistory(h));
    setSelectedActionId(null);
    setPendingScreen(null);
  }, [flushLive]);

  const onSave = async () => {
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...play, valid: true, validationErrors: [] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveState(describeSaveFailure(res.status, body));
        return;
      }
      // Save echo is not an edit — it must not become an undo step.
      setHistory((h) =>
        replacePresent(h, { ...h.present, version: body.play.version }),
      );
      setSaveState({ status: "saved", version: body.play.version });
    } catch {
      setSaveState({
        status: "error",
        tone: "warn",
        title: "Couldn't reach the server",
        detail:
          "Your play is still here in this tab. Check your connection and press Save again.",
        errors: [],
      });
    }
  };

  // Dragging a token is one gesture, not one edit per pixel of it.
  const onMovePlayer = (playerId: PlayerId, pos: Vec) => {
    updateBeatsLive(updateBeatPlayerPos(play.beats, beatIndex, playerId, pos));
  };

  const onPreset = (name: AlignmentPresetName) => {
    updateBeats(applyPresetToBeat(play.beats, beatIndex, name));
  };

  /** The id this stroke owns, claimed once so every frame rewrites the same action. */
  const draftId = (): string => {
    if (!draftActionIdRef.current) {
      draftActionIdRef.current = nextActionId(play.beats[beatIndex].actions);
    }
    return draftActionIdRef.current;
  };

  const onDrawProgress = (input: DrawnActionInput) => {
    if (!isValidDraw(input)) return;
    const id = draftId();
    updateBeatsLive(upsertDrawnAction(play.beats, beatIndex, input, id));
    setSelectedActionId(id);
  };

  const commitDraw = (input: DrawnActionInput) => {
    if (!isValidDraw(input)) {
      onDrawCancel();
      return;
    }
    const id = draftId();
    draftActionIdRef.current = null;
    mutateLive((p) => setPlayBeats(p, upsertDrawnAction(p.beats, beatIndex, input, id)));
    flushLive();
    setSelectedActionId(id);
  };

  const onDrawComplete = (input: DrawnActionInput) => {
    commitDraw(input);
  };

  /**
   * The stroke produced nothing usable — take back whatever it wrote on the way.
   *
   * Removal is itself a live edit, so an abandoned scribble leaves no undo step at all.
   * (If the debounce happened to fire mid-stroke, one coarse step survives holding a
   * partly-drawn action. It is a state the coach really passed through, and a stroke
   * short enough to be abandoned is normally over before the timer runs.)
   */
  const onDrawCancel = () => {
    const id = draftActionIdRef.current;
    draftActionIdRef.current = null;
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    liveBaseRef.current = null;
    if (!id) return;
    setHistory((h) =>
      replacePresent(
        h,
        setPlayBeats(h.present, removeAction(h.present.beats, beatIndex, id)),
      ),
    );
    setSelectedActionId(null);
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

  // A draft id is only meaningful for the beat it was allocated against.
  useEffect(() => {
    draftActionIdRef.current = null;
  }, [beatIndex]);

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
          onMoveEnd={flushLive}
          onDrawProgress={onDrawProgress}
          onDrawComplete={onDrawComplete}
          onDrawCancel={onDrawCancel}
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
        <section
          role="alert"
          className={
            saveState.tone === "warn"
              ? "rounded-md border border-amber-700 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
              : "rounded-md border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-100"
          }
        >
          <p className="font-medium">{saveState.title}</p>
          <p
            className={
              saveState.tone === "warn"
                ? "mt-1 text-amber-200/90"
                : "mt-1 text-red-200/90"
            }
          >
            {saveState.detail}
          </p>
          {saveState.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-200">
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
