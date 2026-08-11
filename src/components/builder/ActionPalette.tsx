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

  return (
    <div className="flex flex-wrap gap-2">
      {tools.map((t) => {
        const selected = tool === t;
        if (t === "move") {
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToolChange(t)}
              className={`rounded border px-3 py-1.5 text-sm ${
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
            disabled={!allowed}
            title={!allowed ? tooltip : undefined}
            onClick={() => allowed && onToolChange(t)}
            className={`rounded border px-3 py-1.5 text-sm ${
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
