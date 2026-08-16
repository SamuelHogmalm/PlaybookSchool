"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Play, PlayerId, Vec } from "@/lib/play/types";
import {
  type DrawnActionInput,
  isValidDraw,
  nextActionId,
  removeAction,
  upsertDrawnAction,
} from "@/lib/play/actionOps";
import { setPlayBeats, updateBeatPlayerPos } from "@/lib/play/beatOps";
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
import { validatePlay } from "@/lib/play/validation";

import type { BuilderTool } from "./ActionPalette";

/**
 * How long a run of live edits coalesces before it becomes one undo step.
 *
 * Long enough that an ordinary stroke or token drag is a single Ctrl+Z, short enough
 * that a slow deliberate drag still leaves intermediate states to go back to.
 */
const LIVE_CHECKPOINT_MS = 400;

/**
 * Everything needed to edit one play: history, selection, and the court's handlers.
 *
 * Extracted from `PlayBuilder` so the review flow can edit an imported play with the
 * same machinery rather than a second implementation of it. MASTER-BUILD-PLAN.md is
 * explicit that review edits "using the Phase 2 builder tools. Same components, no
 * second editor" — and undo coalescing, beat-index clamping and draft-id handling are
 * exactly the things that would drift if they existed twice.
 */
export function usePlayEditor(initialPlay: Play) {
  const [history, setHistory] = useState<History<Play>>(() =>
    initHistory(initialPlay),
  );
  const play = history.present;

  // Editing a different play resets everything. Done during render rather than in an
  // effect so no frame is ever drawn with one play's history over another's beats.
  const [loadedId, setLoadedId] = useState(initialPlay.id);
  if (loadedId !== initialPlay.id) {
    setLoadedId(initialPlay.id);
    setHistory(initHistory(initialPlay));
  }

  const [rawBeatIndex, setBeatIndex] = useState(0);
  const [tool, setTool] = useState<BuilderTool>("move");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>("1");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingScreen, setPendingScreen] = useState<{
    by: PlayerId;
    path: Vec[];
  } | null>(null);

  /**
   * Clamped, because the play can shrink under a stale index.
   *
   * Undo after "add beat" restores a shorter play while the selection still points at
   * a beat that no longer exists, and reading past the end unmounted the whole editor.
   */
  const beatIndex = Math.min(
    Math.max(0, rawBeatIndex),
    Math.max(0, play.beats.length - 1),
  );
  if (rawBeatIndex !== beatIndex) setBeatIndex(beatIndex);

  const beat = play.beats[beatIndex];
  const validation = useMemo(() => validatePlay(play), [play]);
  const selectedAction = beat?.actions.find((a) => a.id === selectedActionId);

  /** State from before the drag in progress, and the id the drag is writing to. */
  const liveBaseRef = useRef<Play | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftActionIdRef = useRef<string | null>(null);

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
   * make Ctrl+Z walk back through a stroke a few pixels at a time.
   */
  const mutateLive = useCallback(
    (fn: (current: Play) => Play) => {
      if (liveBaseRef.current === null) liveBaseRef.current = play;
      setHistory((h) => replacePresent(h, fn(h.present)));
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(flushLive, LIVE_CHECKPOINT_MS);
    },
    [play, flushLive],
  );

  /** The one path for discrete edits. Nothing changes the play except this or mutateLive. */
  const mutate = useCallback(
    (fn: (current: Play) => Play) => {
      flushLive();
      setHistory((h) => commitHistory(h, fn(h.present)));
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

  /** Write a play in without adding an undo step — a save echo, not an edit. */
  const replacePlay = useCallback((next: Play) => {
    setHistory((h) => replacePresent(h, next));
  }, []);

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

  // Dragging a token is one gesture, not one edit per pixel of it.
  const onMovePlayer = (playerId: PlayerId, pos: Vec) => {
    updateBeatsLive(updateBeatPlayerPos(play.beats, beatIndex, playerId, pos));
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

  const commitDraw = (input: DrawnActionInput) => {
    if (!isValidDraw(input)) {
      onDrawCancel();
      return;
    }
    const id = draftId();
    draftActionIdRef.current = null;
    mutateLive((p) =>
      setPlayBeats(p, upsertDrawnAction(p.beats, beatIndex, input, id)),
    );
    flushLive();
    setSelectedActionId(id);
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
  }, [beatIndex, play.beats, selectedActionId, updateBeats, onRedo, onUndo]);

  return {
    play,
    beat,
    beatIndex,
    setBeatIndex,
    validation,

    tool,
    setTool,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedActionId,
    setSelectedActionId,
    selectedAction,
    pendingScreen,
    setPendingScreen,
    onScreenForPick,

    canUndo: canUndo(history),
    canRedo: canRedo(history),
    onUndo,
    onRedo,

    mutate,
    updateBeats,
    replacePlay,
    flushLive,

    /** Spread straight onto <EditableCourt>. */
    courtHandlers: {
      onMovePlayer,
      onMoveEnd: flushLive,
      onDrawProgress,
      onDrawComplete: commitDraw,
      onDrawCancel,
      onScreenNeedsFor: setPendingScreen,
    },
  };
}

export type PlayEditor = ReturnType<typeof usePlayEditor>;
