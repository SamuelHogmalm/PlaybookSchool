"use client";

import type { PlayerId } from "@/lib/play/types";
import { PLAYER_IDS } from "@/lib/play/types";

type Props = {
  screener: PlayerId;
  onPick: (forPlayer: PlayerId) => void;
  onCancel: () => void;
};

export function ScreenForPicker({ screener, onPick, onCancel }: Props) {
  return (
    <div
      className="rounded-md border border-blue-800/50 bg-blue-950/40 px-4 py-3 text-sm text-blue-100"
      role="dialog"
      aria-label="Select screened player"
    >
      <p className="font-medium">Screen for who?</p>
      <p className="mt-1 text-xs text-blue-200/80">
        Player {screener} travels to the screen spot — pick the cutter they screen for.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PLAYER_IDS.filter((id) => id !== screener).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="rounded border border-blue-600 px-3 py-1 hover:bg-blue-900/50"
          >
            Player {id}
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-stone-600 px-3 py-1 text-stone-300 hover:bg-stone-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
