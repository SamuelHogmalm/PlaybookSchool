"use client";

import { CourtFrameView } from "@/app/court/Court";
import { IDS } from "@/lib/playModel";
import { ACTION_TYPES } from "@/lib/verifyPlays";

const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

function ActionRow({ action, onChange, onRemove }) {
  const needsFor = action.type === "pass" || action.type === "handoff" || action.type === "screen";

  return (
    <div className="flex flex-wrap items-center gap-2 border border-rule px-2 py-2 bg-paper">
      <select
        className="ps-input text-xs py-1 min-w-[5.5rem]"
        value={action.type}
        onChange={(e) => onChange({ ...action, type: e.target.value })}
      >
        {ACTION_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <label className="text-xs text-ink-soft flex items-center gap-1">
        by
        <select
          className="ps-input text-xs py-1 w-14"
          value={action.by}
          onChange={(e) => onChange({ ...action, by: e.target.value })}
        >
          {IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {needsFor && (
        <label className="text-xs text-ink-soft flex items-center gap-1">
          for
          <select
            className="ps-input text-xs py-1 w-14"
            value={action.for ?? "2"}
            onChange={(e) => onChange({ ...action, for: e.target.value })}
          >
            {IDS.filter((id) => id !== action.by).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" onClick={onRemove} className="text-xs text-flag ml-auto">
        Remove
      </button>
    </div>
  );
}

export default function VerifyBeatPanel({
  playName,
  beatIndex,
  frame,
  prev,
  verified,
  onVerifiedChange,
  onFrameChange,
}) {
  const actions = frame.actions ?? [];

  const updateAction = (idx, next) => {
    const list = actions.map((a, i) => (i === idx ? next : a));
    onFrameChange({ actions: list });
  };

  const removeAction = (idx) => {
    onFrameChange({ actions: actions.filter((_, i) => i !== idx) });
  };

  const addAction = () => {
    onFrameChange({
      actions: [
        ...actions,
        { id: `a${Date.now()}`, type: "cut", by: "1" },
      ],
    });
  };

  return (
    <article
      className={`border bg-paper ${verified ? "border-go" : "border-rule"}`}
      id={`beat-${playName}-${frame.id}`}
    >
      <header className="px-3 py-2 border-b border-rule bg-paper-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-data text-[10px] uppercase tracking-widest text-ink-soft">
            Beat {beatIndex + 1}
          </span>
          <span className="font-mono text-xs text-ink-soft ml-2">{frame.id}</span>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => onVerifiedChange(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-go,#16a34a)]"
          />
          <span className={verified ? "text-go font-semibold" : "text-ink-soft"}>
            Verified against PDF
          </span>
        </label>
      </header>

      <div className="p-3 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">
            Diagram {beatIndex > 0 ? "(movement from previous beat)" : "(initial set)"}
          </p>
          <CourtFrameView
            frame={frame}
            prev={prev}
            suffix={`-verify-${playName}-${beatIndex}`}
            maxWidthClass="max-w-full"
            showGhost={beatIndex > 0}
            showActions={beatIndex > 0}
            showMovementLines={beatIndex > 0 && !(frame.actions?.length > 0)}
          />
          <div className="mt-2 font-data text-[10px] text-ink-soft grid grid-cols-5 gap-1">
            {IDS.map((id) => {
              const p = frame.pos?.[id];
              return (
                <div key={id} className="border border-rule px-1 py-0.5 text-center">
                  <span className="font-semibold">{id}</span>
                  <br />
                  {p ? `${Math.round(p.x)},${Math.round(p.y)}` : "—"}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <label className="ps-label" htmlFor={`ball-${frame.id}`}>
              Ball handler
            </label>
            <select
              id={`ball-${frame.id}`}
              className="ps-input"
              value={frame.ball ?? "1"}
              onChange={(e) => onFrameChange({ ball: e.target.value })}
            >
              {IDS.map((id) => (
                <option key={id} value={id}>
                  #{id} ({POS_NAME[id]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="ps-label mb-0">Actions ({actions.length})</p>
              <button type="button" onClick={addAction} className="text-xs text-chalk font-semibold">
                + Add action
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {actions.length === 0 && (
                <p className="text-xs text-ink-soft border border-dashed border-rule px-2 py-3">
                  No actions — movement inferred from position changes only.
                </p>
              )}
              {actions.map((a, i) => (
                <ActionRow
                  key={a.id ?? i}
                  action={a}
                  onChange={(next) => updateAction(i, next)}
                  onRemove={() => removeAction(i)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="ps-label" htmlFor={`note-${frame.id}`}>
              Coach note
            </label>
            <textarea
              id={`note-${frame.id}`}
              className="ps-input min-h-[88px] text-sm"
              value={frame.note ?? ""}
              onChange={(e) => onFrameChange({ note: e.target.value })}
              placeholder="One sentence — what happens on this beat?"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
