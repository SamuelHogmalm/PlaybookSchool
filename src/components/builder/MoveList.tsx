"use client";

import { moveActionInSequence, removeAction, setActionStep } from "@/lib/play/actionOps";
import { splitBeatAtStep, suggestedSplits } from "@/lib/play/splitBeats";
import type { Action, Beat, Play } from "@/lib/play/types";

type Props = {
  play: Play;
  beat: Beat;
  beatIndex: number;
  selectedActionId: string | null;
  onSelectAction: (id: string | null) => void;
  updateBeats: (beats: Play["beats"]) => void;
};

function describe(action: Action): string {
  switch (action.type) {
    case "screen":
      return `${action.by} screens for ${action.for}`;
    case "pass":
      return `${action.by} passes to ${action.for}`;
    case "handoff":
      return `${action.by} hands off to ${action.for}`;
    case "dribble":
      return `${action.by} dribbles`;
    default:
      return `${action.by} cuts`;
  }
}

/**
 * The play as a list of moves, in the order they happen.
 *
 * A coach drawing in one pass needs to see the sequence they have built and fix its
 * order without hunting for arrows on the court. Grouping two moves into one step is how
 * you say "these happen together"; the arrows say where, this says when.
 */
export function MoveList({
  play,
  beat,
  beatIndex,
  selectedActionId,
  onSelectAction,
  updateBeats,
}: Props) {
  const steps = [
    ...new Set(
      beat.actions
        .map((a) => a.step)
        .filter((s): s is number => typeof s === "number"),
    ),
  ].sort((a, b) => a - b);

  if (!beat.actions.length) {
    return (
      <p className="text-sm text-stone-500">
        No moves yet. Drag from a player&rsquo;s token to draw the first one.
      </p>
    );
  }

  const splits = new Set(suggestedSplits(beat));

  return (
    <ol className="space-y-1">
      {steps.map((step, position) => {
        const inStep = beat.actions.filter((a) => (a.step ?? steps[0]) === step);
        const together = inStep.length > 1;

        return (
          <li key={step} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 rounded border border-stone-800 px-3 py-2 text-sm">
              <span className="w-6 shrink-0 text-stone-500">{position + 1}.</span>

              <span className="flex-1">
                {inStep.map((action, i) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() =>
                      onSelectAction(
                        selectedActionId === action.id ? null : action.id,
                      )
                    }
                    className={`rounded px-1.5 py-0.5 text-left ${
                      selectedActionId === action.id
                        ? "bg-amber-500/20 text-amber-100"
                        : "hover:bg-stone-800"
                    }`}
                  >
                    {i > 0 && <span className="text-stone-500"> + </span>}
                    {describe(action)}
                  </button>
                ))}
                {together && (
                  <span className="ml-1 text-xs text-stone-500">(together)</span>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move step ${position + 1} earlier`}
                  disabled={position === 0}
                  onClick={() =>
                    updateBeats(
                      moveActionInSequence(play.beats, beatIndex, inStep[0].id, -1),
                    )
                  }
                  className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move step ${position + 1} later`}
                  disabled={position === steps.length - 1}
                  onClick={() =>
                    updateBeats(
                      moveActionInSequence(play.beats, beatIndex, inStep[0].id, 1),
                    )
                  }
                  className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800 disabled:opacity-30"
                >
                  ↓
                </button>
                {position > 0 && !together && (
                  <button
                    type="button"
                    title="Happens at the same time as the move above"
                    onClick={() =>
                      updateBeats(
                        setActionStep(
                          play.beats,
                          beatIndex,
                          inStep[0].id,
                          steps[position - 1],
                        ),
                      )
                    }
                    className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800"
                  >
                    ⇈ together
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${describe(inStep[0])}`}
                  onClick={() => {
                    updateBeats(removeAction(play.beats, beatIndex, inStep[0].id));
                    if (selectedActionId === inStep[0].id) onSelectAction(null);
                  }}
                  className="rounded border border-stone-700 px-2 py-0.5 text-xs text-stone-400 hover:bg-stone-800 hover:text-red-200"
                >
                  ✕
                </button>
              </span>
            </div>

            {position < steps.length - 1 && (
              <div className="flex items-center gap-2 pl-8">
                <button
                  type="button"
                  onClick={() =>
                    updateBeats(splitBeatAtStep(play.beats, beatIndex, step))
                  }
                  className={`rounded border px-2 py-0.5 text-xs ${
                    splits.has(step)
                      ? "border-amber-700/60 text-amber-200 hover:bg-amber-500/10"
                      : "border-stone-800 text-stone-500 hover:bg-stone-800"
                  }`}
                >
                  {splits.has(step) ? "break here — the ball changes hands" : "break here"}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
