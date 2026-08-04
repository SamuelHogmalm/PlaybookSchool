"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PlayPlayback from "@/app/play/PlayPlayback";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";
import { CourtFrameView } from "@/app/court/Court";
import { groupPlaysByCategory } from "@/lib/plays";

function PlayCard({ play, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(play)}
      className={`ps-play-card ${selected ? "ring-2 ring-jersey ring-inset" : ""}`}
    >
      <div className="ps-court-frame">
        <CourtFrameView
          frame={play.frames[0]}
          prev={null}
          suffix={`-card-${play.name}`}
          maxWidthClass="max-w-full"
          showGhost={false}
          showActions={false}
        />
      </div>
      <div className="px-1.5 py-1 border-t border-rule">
        <p className="font-display text-xs font-semibold truncate">{play.name}</p>
        <p className="font-data text-[10px] text-ink-soft">{play.frames.length}b</p>
      </div>
    </button>
  );
}

export default function PlaybookWorkbench({ plays: initialPlays, initialPlay }) {
  const [plays, setPlays] = useState(initialPlays);
  const [selected, setSelected] = useState(initialPlay ?? initialPlays[0]);
  const [idx, setIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [showRun, setShowRun] = useState(false);
  const [editing, setEditing] = useState(false);

  const frames = selected.frames;

  const selectPlay = (play) => {
    if (editing) return;
    setSelected(play);
    setIdx(0);
    setShowRun(false);
  };

  const startEdit = () => {
    setEditing(true);
    setShowRun(false);
  };

  const doneEdit = () => {
    setEditing(false);
  };

  const handlePlayChange = useCallback((next) => {
    const updated = typeof next === "function" ? next(selected) : next;
    setSelected(updated);
    setPlays((list) => list.map((p) => (p.name === updated.name ? updated : p)));
  }, [selected]);

  const filtered = plays.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const groups = groupPlaysByCategory(filtered);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`border-b border-rule bg-paper shrink-0 ${editing ? "flex-1 flex flex-col min-h-0" : ""}`}>
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-rule bg-paper-2 flex-wrap">
          <div className="flex items-baseline gap-3 min-w-0">
            {editing && (
              <span className="font-data text-[10px] uppercase tracking-widest text-jersey shrink-0">Editing</span>
            )}
            <h1 className="font-display text-xl font-bold truncate">{selected.name}</h1>
            <span className="font-data text-xs text-ink-soft shrink-0">
              {selected.category} · {selected.frames.length} beats
            </span>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {editing ? (
              <button type="button" onClick={doneEdit} className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
                Done editing
              </button>
            ) : (
              <>
                <button type="button" onClick={startEdit} className="ps-btn ps-btn-secondary py-0 min-h-[36px] text-xs">
                  Edit
                </button>
                <button type="button" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
                  Assign
                </button>
                <button type="button" className="ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs">
                  Print
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex-1 overflow-auto p-4">
            <p className="text-sm text-ink-soft mb-3 max-w-3xl">
              Drag players, pick a line tool, draw on the court. Changes stay on this beat and cascade forward.
            </p>
            <PlayDrawEditor play={selected} setPlay={handlePlayChange} theme="paper" />
          </div>
        ) : (
          <div className="p-4 max-w-3xl mx-auto w-full">
            {showRun ? (
              <div className="ps-court-frame border border-rule p-2">
                <PlayPlayback play={selected} />
              </div>
            ) : (
              <div className="ps-court-frame border border-rule">
                <CourtFrameView
                  frame={frames[idx]}
                  prev={idx > 0 ? frames[idx - 1] : null}
                  suffix={`-wb-${selected.name}`}
                  maxWidthClass="max-w-full"
                  showGhost={idx > 0}
                  showActions
                />
              </div>
            )}

            {!showRun && (
              <div className="flex items-center gap-3 mt-3 flex-wrap text-sm">
                <button
                  type="button"
                  className="ps-btn ps-btn-ghost py-0 min-h-[36px] px-2 text-xs"
                  disabled={idx === 0}
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                >
                  ◀
                </button>
                <div className="flex gap-1">
                  {frames.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Beat ${i + 1}`}
                      className={`w-2 h-2 rounded-full ${i === idx ? "bg-jersey" : "bg-rule"}`}
                      onClick={() => setIdx(i)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="ps-btn ps-btn-ghost py-0 min-h-[36px] px-2 text-xs"
                  disabled={idx >= frames.length - 1}
                  onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}
                >
                  ▶
                </button>
                <span className="font-data text-xs text-ink-soft">
                  beat {idx + 1} of {frames.length}
                </span>
                <button
                  type="button"
                  className="ps-btn ps-btn-secondary py-0 min-h-[36px] text-xs"
                  onClick={() => setShowRun(true)}
                >
                  Run play
                </button>
              </div>
            )}

            {showRun && (
              <button
                type="button"
                className="ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs mt-3"
                onClick={() => setShowRun(false)}
              >
                ← Beat stepper
              </button>
            )}

            {!showRun && frames[idx]?.note && (
              <p className="mt-2 text-sm text-ink-soft italic">&ldquo;{frames[idx].note}&rdquo;</p>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="font-data text-[10px] uppercase tracking-widest text-ink-soft">All plays</span>
            <input
              type="search"
              placeholder="Search…"
              className="ps-input max-w-[180px] min-h-[36px] text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="flex-1" />
            <Link href="/import" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
              + Import
            </Link>
            <Link href="/plays/new" className="ps-btn ps-btn-secondary py-0 min-h-[36px] text-xs">
              + New
            </Link>
          </div>

          {groups.length === 0 ? (
            <div className="border border-rule p-8 text-center">
              <p className="text-ink-soft mb-4">No plays yet. Import your playbook or build one from scratch.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link href="/import" className="ps-btn ps-btn-primary">Import playbook</Link>
                <Link href="/plays/new" className="ps-btn ps-btn-secondary">Build from scratch</Link>
              </div>
            </div>
          ) : (
            groups.map(([category, catPlays]) => (
              <div key={category} className="mb-6">
                <h2 className="font-display text-sm font-bold text-ink-soft mb-2">{category}</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {catPlays.map((play) => (
                    <PlayCard
                      key={play.name}
                      play={play}
                      selected={selected.name === play.name}
                      onSelect={selectPlay}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
