import type { Beat, PlayerId } from "@/lib/play/types";
import { canDrawAction } from "@/lib/play/drawing";

export type BuilderTool = import("@/lib/play/drawing").BuilderTool;

const TOOL_LABELS: Record<BuilderTool, string> = {
  move: "Move",
  cut: "Cut",
  dribble: "Dribble",
  pass: "Pass",
  screen: "Screen",
  handoff: "Handoff",
};

type Props = {
  beat: Beat;
  tool: BuilderTool;
  onToolChange: (tool: BuilderTool) => void;
  selectedPlayer: PlayerId | null;
};

export function ActionPalette({
  beat,
  tool,
  onToolChange,
  selectedPlayer,
}: Props) {
  const tools: BuilderTool[] = [
    "move",
    "cut",
    "dribble",
    "pass",
    "screen",
    "handoff",
  ];

  const focus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

  return (
    <div role="group" aria-label="Drawing tools" className="flex flex-wrap gap-2">
      {tools.map((t) => {
        const selected = tool === t;
        if (t === "move") {
          return (
            <button
              key={t}
              type="button"
              aria-pressed={selected}
              onClick={() => onToolChange(t)}
              className={`rounded border px-3 py-1.5 text-sm ${focus} ${
                selected
                  ? "border-amber-500 bg-amber-500/20 text-amber-100"
                  : "border-stone-600 text-stone-200 hover:bg-stone-800"
              }`}
            >
              {TOOL_LABELS[t]}
            </button>
          );
        }

        const { allowed, tooltip } = canDrawAction(beat, selectedPlayer, t);

        return (
          <button
            key={t}
            type="button"
            aria-pressed={selected}
            // aria-disabled rather than disabled: a disabled button is skipped by
            // screen readers, so the rule explaining *why* it is off — the whole
            // teaching point of the gate — becomes unreachable.
            aria-disabled={!allowed}
            aria-label={allowed ? undefined : `${TOOL_LABELS[t]} — ${tooltip}`}
            title={!allowed ? tooltip : undefined}
            onClick={() => allowed && onToolChange(t)}
            className={`rounded border px-3 py-1.5 text-sm ${focus} ${
              selected
                ? "border-amber-500 bg-amber-500/20 text-amber-100"
                : allowed
                  ? "border-stone-600 text-stone-200 hover:bg-stone-800"
                  : "cursor-not-allowed border-stone-700 text-stone-500 opacity-50"
            }`}
          >
            {TOOL_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
