"use client";

import { CourtRenderer } from "@/components/court";
import type { Beat } from "@/lib/play/types";

type Props = {
  beats: Beat[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  canDelete: boolean;
};

export function BeatStrip({
  beats,
  selectedIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMoveLeft,
  onMoveRight,
  canDelete,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
        >
          + Add beat
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-40"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={selectedIndex === 0}
          className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-40"
        >
          ← Move
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={selectedIndex >= beats.length - 1}
          className="rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-40"
        >
          Move →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {beats.map((beat, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={beat.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`shrink-0 rounded border p-1 text-left transition ${
                selected
                  ? "border-amber-500 ring-1 ring-amber-500/50"
                  : "border-stone-700 hover:border-stone-500"
              }`}
            >
              <CourtRenderer
                beat={beat}
                framed={false}
                width={120}
                markerSuffix={`-strip-${beat.id}`}
              />
              <span className="mt-1 block px-1 text-xs text-stone-400">
                Beat {index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
