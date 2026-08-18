"use client";

import {
  addDrawnAction,
  confirmAction,
  removeAction,
  setActionStep,
} from "@/lib/play/actionOps";
import { handoffCandidates } from "@/lib/play/handoff";
import { recentActionIds } from "@/lib/play/splitBeats";
import { beatSteps } from "@/lib/timing";
import { currentHolder } from "@/lib/play/possession";

import { ActionPalette } from "./ActionPalette";
import { EditableCourt } from "./EditableCourt";
import { ScreenForPicker } from "./ScreenForPicker";
import type { PlayEditor } from "./usePlayEditor";

type Props = {
  editor: PlayEditor;
  /**
   * Thin the court down to the last few steps.
   *
   * Not tied to which mode the builder is in: a beat with six moves is cluttered
   * whether it was just drawn or is being edited, and the coach is the one who knows
   * whether they want context or the whole picture.
   */
  recentOnly?: boolean;
  /** Supplied to show a control for it. */
  onToggleRecentOnly?: () => void;
  /** Undo/redo buttons sit next to the tools, where the editing happens. */
  showHistoryControls?: boolean;
};

/**
 * The editing surface: tools, the court, and whatever is selected on it.
 *
 * One component for the builder and for review, so a coach who learns to fix a play in
 * one place already knows how in the other.
 */
export function PlayEditorSurface({
  editor,
  showHistoryControls = true,
  recentOnly = false,
  onToggleRecentOnly,
}: Props) {
  const {
    play,
    beat,
    beatIndex,
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
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    updateBeats,
    courtHandlers,
  } = editor;

  if (!beat) return null;

  const historyButton =
    "rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 " +
    "disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ActionPalette
          beat={beat}
          tool={tool}
          onToolChange={(t) => {
            setTool(t);
            setSelectedActionId(null);
          }}
          selectedPlayer={selectedPlayerId}
        />

        {showHistoryControls && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo (Control+Z)"
              aria-keyshortcuts="Control+Z"
              className={historyButton}
            >
              <span aria-hidden="true">↶ </span>Undo
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo (Control+Shift+Z)"
              aria-keyshortcuts="Control+Shift+Z"
              className={historyButton}
            >
              <span aria-hidden="true">↷ </span>Redo
            </button>
          </div>
        )}
      </div>

      {onToggleRecentOnly && (
        <button
          type="button"
          onClick={onToggleRecentOnly}
          aria-pressed={recentOnly}
          className="self-start rounded border border-stone-600 px-3 py-1 text-xs text-stone-300 hover:bg-stone-800"
        >
          {recentOnly
            ? "Showing the last 2 moves — show all"
            : "Showing every move — show just the last 2"}
        </button>
      )}

      {selectedPlayerId && (
        <p className="text-xs text-stone-500">
          Selected player {selectedPlayerId}
          {/* Who holds it now, after anything already drawn on this beat. */}
          {currentHolder(beat) === selectedPlayerId ? " (has ball)" : ""}
        </p>
      )}

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
        onlyActionIds={
          recentOnly
            ? recentActionIds(beat, { keep: selectedActionId })
            : undefined
        }
        {...courtHandlers}
      />

      {/*
        A dribble handoff is already drawn by the time there is anything to click: the
        handler has stopped somewhere and a cutter runs past them. The exchange itself is
        the part that gets forgotten, so the builder offers it rather than waiting to be
        asked.
      */}
      {handoffCandidates(beat).map((candidate) => (
        <button
          key={`handoff-${candidate.to}`}
          type="button"
          onClick={() => {
            const to = beat.pos[candidate.to] ?? beat.startPos[candidate.to];
            const added = addDrawnAction(play.beats, beatIndex, {
              type: "handoff",
              by: candidate.from,
              for: candidate.to,
              path: [candidate.at, to],
            });

            // The exchange belongs in the runner's step, not after it. On its own step
            // both players finish running, separate, and only then does the ball move —
            // which reads as a late pass rather than a handoff.
            const runnerStep = added[beatIndex].actions.find(
              (a) =>
                a.by === candidate.to &&
                (a.type === "cut" || a.type === "dribble" || a.type === "screen"),
            )?.step;
            const handoffId =
              added[beatIndex].actions[added[beatIndex].actions.length - 1].id;

            updateBeats(
              runnerStep === undefined
                ? added
                : setActionStep(added, beatIndex, handoffId, runnerStep),
            );
          }}
          className="w-full rounded border border-amber-700/60 bg-amber-500/10 px-4 py-2 text-left text-sm text-amber-100 hover:bg-amber-500/20"
        >
          Player {candidate.to} runs past {candidate.from} — hand it off?
        </button>
      ))}

      {selectedAction && (
        <section className="rounded-md border border-stone-700 bg-stone-900/50 px-4 py-3 text-sm">
          <p>
            Selected: {selectedAction.type} by {selectedAction.by}
            {selectedAction.for ? ` for ${selectedAction.for}` : ""}
            {selectedAction.needsReview || selectedAction.derived
              ? " (needs review)"
              : ""}
          </p>

          {(() => {
            const steps = beatSteps(beat);
            const step = selectedAction.step ?? steps[0];
            const position = steps.indexOf(step) + 1;
            const withThem = beat.actions.filter(
              (a) => a.id !== selectedAction.id && (a.step ?? steps[0]) === step,
            );

            return (
              <div className="mt-2 space-y-2">
                <p className="text-stone-400">
                  Step {position} of {steps.length}
                  {withThem.length
                    ? ` — at the same time as ${withThem
                        .map((a) => `${a.type} by ${a.by}`)
                        .join(", ")}`
                    : " — on its own"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateBeats(
                        setActionStep(
                          play.beats,
                          beatIndex,
                          selectedAction.id,
                          steps[position - 2],
                        ),
                      )
                    }
                    disabled={position <= 1}
                    className="rounded border border-stone-600 px-3 py-1 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Same time as step {Math.max(1, position - 1)}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateBeats(
                        setActionStep(play.beats, beatIndex, selectedAction.id, null),
                      )
                    }
                    disabled={withThem.length === 0 && position === steps.length}
                    className="rounded border border-stone-600 px-3 py-1 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Give it its own step
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                updateBeats(removeAction(play.beats, beatIndex, selectedAction.id));
                setSelectedActionId(null);
              }}
              className="rounded border border-red-800 px-3 py-1 text-red-200 hover:bg-red-950/40"
            >
              Delete action
            </button>
            {(selectedAction.needsReview || selectedAction.derived) && (
              <button
                type="button"
                onClick={() =>
                  updateBeats(confirmAction(play.beats, beatIndex, selectedAction.id))
                }
                className="rounded border border-emerald-700 px-3 py-1 text-emerald-200 hover:bg-emerald-950/40"
              >
                Looks right
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
