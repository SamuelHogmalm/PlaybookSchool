"use client";

import { useState } from "react";

import type { Play } from "@/lib/play/types";
import { confirmPlayActions } from "@/lib/play/actionOps";
import {
  addBeat,
  applyPresetToBeat,
  createEmptyPlay,
  deleteBeat,
  duplicateBeat,
  reorderBeat,
} from "@/lib/play/beatOps";
import { PRESET_NAMES, type AlignmentPresetName } from "@/lib/play/editor";
import { splitBeatAtStep, suggestedSplits } from "@/lib/play/splitBeats";
import { describeSaveFailure, OFFLINE_FAILURE } from "@/lib/play/saveErrors";
import { PlayAnimator } from "@/components/animator";

import { BeatStrip } from "./BeatStrip";
import { MoveList } from "./MoveList";
import { PlayEditorSurface } from "./PlayEditorSurface";
import { usePlayEditor } from "./usePlayEditor";
import { ValidationBanner } from "./ValidationBanner";

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

/** Wraps the shared copy in this component's state shape. */
function saveError(
  status: number,
  body: { error?: string; validationErrors?: string[] },
): Extract<SaveState, { status: "error" }> {
  return { status: "error", ...describeSaveFailure(status, body) };
}

export function PlayBuilder() {
  // Created once: a fresh play each render would reset the editor every frame.
  const [blank] = useState<Play>(() => createEmptyPlay());
  const editor = usePlayEditor(blank);
  const {
    play,
    beat,
    beatIndex,
    setBeatIndex,
    validation,
    mutate,
    updateBeats,
    replacePlay,
    setSelectedActionId,
    setPendingScreen,
  } = editor;

  // Bumping the nonce remounts PlayAnimator, which is how it resets (key={play.id}).
  const [preview, setPreview] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  /**
   * Coaches draw a play in one pass, not frame by frame — and how many moves belong on
   * a page is their habit, not our data model. So drawing is continuous, and beats are
   * cut afterwards, which is a question about quizzing rather than about basketball.
   */
  const [mode, setMode] = useState<"draw" | "beats">("draw");

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
        setSaveState(saveError(res.status, body));
        return;
      }
      // Save echo is not an edit — it must not become an undo step.
      replacePlay({ ...play, version: body.play.version });
      setSaveState({ status: "saved", version: body.play.version });
    } catch {
      setSaveState({ status: "error", ...OFFLINE_FAILURE });
    }
  };

  const onPreset = (name: AlignmentPresetName) => {
    updateBeats(applyPresetToBeat(play.beats, beatIndex, name));
    setSaveState({ status: "idle" });
  };

  if (!beat) return null;

  const hasReviewFlags = play.beats.some((b) =>
    b.actions.some((a) => a.needsReview || a.derived),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 text-stone-100">
      <header className="space-y-2">
        {/*
          Plays are unique per team by name, so a second "New Play" collides on save.
          Naming it is part of drawing it, not a detail to chase afterwards.
        */}
        <label className="block">
          <span className="sr-only">Play name</span>
          <input
            type="text"
            value={play.name}
            onChange={(e) => mutate((p) => ({ ...p, name: e.target.value }))}
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              if (trimmed !== play.name) {
                mutate((p) => ({ ...p, name: trimmed || "Untitled play" }));
              }
            }}
            placeholder="Name this play"
            aria-label="Play name"
            className="w-full max-w-md rounded border border-transparent bg-transparent text-2xl font-semibold text-stone-100 placeholder:text-stone-600 hover:border-stone-700 focus:border-stone-600 focus:outline-none"
          />
        </label>
        <p className="text-sm text-stone-400">
          Select a tool, click a player to select them, drag from their token to draw —
          the play updates as you go. Move mode drags the ring at the end of a player&rsquo;s
          route to set where they finish. Pass sets possession automatically.
        </p>
      </header>

      <div role="group" aria-label="Builder mode" className="flex gap-2 text-sm">
        {(
          [
            ["draw", "Draw the play"],
            ["beats", "Edit beat by beat"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded border px-3 py-1.5 ${
              mode === value
                ? "border-amber-500 bg-amber-500/20 text-amber-100"
                : "border-stone-600 text-stone-300 hover:bg-stone-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ValidationBanner result={validation} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-stone-400">Alignment</h2>
        <div className="flex flex-wrap gap-2">
          {PRESET_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onPreset(name)}
              className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {preview === null ? (
        <PlayEditorSurface editor={editor} recentOnly={mode === "draw"} />
      ) : (
        <section className="space-y-3">
          <PlayAnimator key={`${play.id}-${preview}`} play={play} from={0} playing />
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
          title={validation.valid ? undefined : "Fix validation errors before previewing"}
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
        {hasReviewFlags && (
          <button
            type="button"
            onClick={() => mutate((p) => confirmPlayActions(p))}
            className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-800"
          >
            Confirm every flagged action
          </button>
        )}
      </section>

      {saveState.status === "saved" && (
        <section
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-700 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
        >
          <p className="font-medium">
            Saved to your team&rsquo;s playbook — version {saveState.version}
          </p>
          <p className="mt-1 text-emerald-200/90">
            {saveState.version === 1
              ? "This play is now stored, not just open in this tab."
              : "Players who already learned an earlier version will be asked to re-learn this one."}
          </p>
          {/* Drawing a playbook means drawing several. Don't make them find the way back. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/plays/new"
              className="rounded border border-stone-500 px-3 py-1.5 hover:bg-stone-800"
            >
              Draw another
            </a>
            <a
              href="/coach/playbook"
              className="rounded border border-stone-500 px-3 py-1.5 hover:bg-stone-800"
            >
              See your playbook
            </a>
          </div>
        </section>
      )}

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

      {mode === "draw" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-stone-400">
              The play, in order
            </h2>
            {suggestedSplits(beat).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  // Applied back to front so earlier cuts do not shift later ones.
                  let beats = play.beats;
                  for (const step of [...suggestedSplits(beat)].reverse()) {
                    beats = splitBeatAtStep(beats, beatIndex, step);
                  }
                  updateBeats(beats);
                  setMode("beats");
                }}
                className="rounded border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950/40"
              >
                Break into beats
              </button>
            )}
          </div>
          <MoveList
            play={play}
            beatIndex={beatIndex}
            onSelectBeat={setBeatIndex}
            selectedActionId={editor.selectedActionId}
            onSelectAction={setSelectedActionId}
            updateBeats={updateBeats}
          />
          <p className="text-xs text-stone-600">
            Draw the whole thing first. Breaking it into beats decides where a quiz can
            stop and ask a question — it changes nothing about the play.
          </p>
        </section>
      ) : (
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
      )}
    </div>
  );
}
