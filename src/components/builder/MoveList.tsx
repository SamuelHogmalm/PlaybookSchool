"use client";

import {
  moveActionInSequence,
  removeAction,
  setActionStep,
} from "@/lib/play/actionOps";
import {
  mergeBeatWithPrevious,
  splitBeatAtStep,
  suggestedSplits,
} from "@/lib/play/splitBeats";
import type { Action, Beat, Play } from "@/lib/play/types";

type Props = {
  play: Play;
  beatIndex: number;
  onSelectBeat: (index: number) => void;
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

function stepsOf(beat: Beat): number[] {
  return [
    ...new Set(
      beat.actions
        .map((a) => a.step)
        .filter((s): s is number => typeof s === "number"),
    ),
  ].sort((a, b) => a - b);
}

/**
 * The whole play as one list of moves, with the beat boundaries drawn in.
 *
 * Showing only the beat being edited was the mistake. After the first break the rest of
 * the sequence vanished from view, so every further break looked like it was shovelling
 * moves into the next beat rather than making a new one.
 *
 * A coach who drew three plays in one pass needs to see all of it and cut it where they
 * like — and un-cut it, which is why a boundary is a control rather than a line.
 */
export function MoveList({
  play,
  beatIndex,
  onSelectBeat,
  selectedActionId,
  onSelectAction,
  updateBeats,
}: Props) {
  if (!play.beats.some((b) => b.actions.length)) {
    return (
      <p className="text-sm text-stone-500">
        No moves yet. Drag from a player&rsquo;s token to draw the first one.
      </p>
    );
  }

  // Numbered up front rather than counted during render: the list spans every beat, and
  // a counter incremented while rendering is a variable outliving its own render pass.
  const numbering = new Map<string, number>();
  play.beats.forEach((beat, bIndex) => {
    for (const step of stepsOf(beat)) {
      numbering.set(`${bIndex}:${step}`, numbering.size + 1);
    }
  });

  return (
    <div className="space-y-1">
      {play.beats.map((beat, bIndex) => {
        const steps = stepsOf(beat);
        const splits = new Set(suggestedSplits(beat));
        const active = bIndex === beatIndex;

        return (
          <div key={beat.id}>
            {bIndex > 0 && (
              <div className="flex items-center gap-2 py-2">
                <span className="h-px flex-1 bg-stone-700" />
                <span className="text-xs uppercase tracking-wide text-stone-500">
                  beat {bIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateBeats(mergeBeatWithPrevious(play.beats, bIndex));
                    onSelectBeat(Math.max(0, bIndex - 1));
                  }}
                  className="rounded border border-stone-700 px-2 py-0.5 text-xs text-stone-400 hover:bg-stone-800"
                >
                  combine with the one above
                </button>
                <span className="h-px flex-1 bg-stone-700" />
              </div>
            )}

            {!beat.actions.length && (
              <p className="px-3 py-1 text-xs text-stone-600">
                Nothing happens in this beat.
              </p>
            )}

            {steps.map((step, position) => {
              const inStep = beat.actions.filter(
                (a) => (a.step ?? steps[0]) === step,
              );
              const together = inStep.length > 1;
              const number = numbering.get(`${bIndex}:${step}`) ?? 0;

              return (
                <div key={`${beat.id}-${step}`} className="space-y-1">
                  <div
                    className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm ${
                      active ? "border-stone-700" : "border-stone-800/60"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-stone-500">{number}.</span>

                    <span className="flex-1">
                      {inStep.map((action, i) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => {
                            onSelectBeat(bIndex);
                            onSelectAction(
                              selectedActionId === action.id ? null : action.id,
                            );
                          }}
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
                        aria-label={`Move ${describe(inStep[0])} earlier`}
                        disabled={position === 0}
                        onClick={() =>
                          updateBeats(
                            moveActionInSequence(play.beats, bIndex, inStep[0].id, -1),
                          )
                        }
                        className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800 disabled:opacity-30"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${describe(inStep[0])} later`}
                        disabled={position === steps.length - 1}
                        onClick={() =>
                          updateBeats(
                            moveActionInSequence(play.beats, bIndex, inStep[0].id, 1),
                          )
                        }
                        className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800 disabled:opacity-30"
                      >
                        &darr;
                      </button>
                      {position > 0 && !together && (
                        <button
                          type="button"
                          title="Happens at the same time as the move above"
                          onClick={() =>
                            updateBeats(
                              setActionStep(
                                play.beats,
                                bIndex,
                                inStep[0].id,
                                steps[position - 1],
                              ),
                            )
                          }
                          className="rounded border border-stone-700 px-2 py-0.5 text-xs hover:bg-stone-800"
                        >
                          together
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${describe(inStep[0])}`}
                        onClick={() => {
                          updateBeats(removeAction(play.beats, bIndex, inStep[0].id));
                          if (selectedActionId === inStep[0].id) onSelectAction(null);
                        }}
                        className="rounded border border-stone-700 px-2 py-0.5 text-xs text-stone-400 hover:bg-stone-800 hover:text-red-200"
                      >
                        &times;
                      </button>
                    </span>
                  </div>

                  {position < steps.length - 1 && (
                    <div className="flex items-center gap-2 pl-8">
                      <button
                        type="button"
                        onClick={() => {
                          updateBeats(splitBeatAtStep(play.beats, bIndex, step));
                          onSelectBeat(bIndex);
                        }}
                        className={`rounded border px-2 py-0.5 text-xs ${
                          splits.has(step)
                            ? "border-amber-700/60 text-amber-200 hover:bg-amber-500/10"
                            : "border-stone-800 text-stone-500 hover:bg-stone-800"
                        }`}
                      >
                        {splits.has(step)
                          ? "start a new beat here — the ball changes hands"
                          : "start a new beat here"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
