"use client";

import { useMemo, useState } from "react";

import { CourtRenderer } from "@/components/court";
import { PlayEditorSurface, usePlayEditor } from "@/components/builder";
import { confirmPlayActions } from "@/lib/play/actionOps";
import {
  describeSaveFailure,
  OFFLINE_FAILURE,
  type SaveFailure,
} from "@/lib/play/saveErrors";
import type { Play } from "@/lib/play/types";
import { cropUrl, reviewPlaybook, type PlayReview } from "@/lib/review";

type Props = { plays: Play[] };

type Status = "pending" | "saving" | "confirmed";

export function ReviewFlow({ plays }: Props) {
  // The queue is scored from the plays as imported, so it does not reshuffle underneath
  // the coach as they fix things. Re-scoring on every keystroke would move the play
  // they are working on.
  const queue = useMemo(() => reviewPlaybook(plays), [plays]);
  const byId = useMemo(() => new Map(plays.map((p) => [p.id, p])), [plays]);

  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cropMissing, setCropMissing] = useState(false);

  const review: PlayReview | undefined = queue[index];
  const source = review ? byId.get(review.playId) : undefined;

  // The same editor the builder uses — not a copy of it. Resets when the play changes.
  const editor = usePlayEditor(source ?? plays[0]);
  const play = editor.play;
  const beatIndex = editor.beatIndex;
  const setBeatIndex = editor.setBeatIndex;
  const status = review ? (statuses[review.playId] ?? "pending") : "pending";
  const confirmedCount = Object.values(statuses).filter(
    (s) => s === "confirmed",
  ).length;

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(next, queue.length - 1)));
    setBeatIndex(0);
    setSelectedFlag(null);
    setFailure(null);
    setEditing(false);
    setCropMissing(false);
  };

  const confirm = async () => {
    if (!play || !review) return;
    setFailure(null);
    setStatuses((s) => ({ ...s, [review.playId]: "saving" }));

    // Confirming clears the review flags — that is what makes it a coach's play
    // rather than the importer's guess. Whatever they edited goes with it.
    const cleared = confirmPlayActions(play);

    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cleared, valid: true, validationErrors: [] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFailure(describeSaveFailure(res.status, body));
        setStatuses((s) => ({ ...s, [review.playId]: "pending" }));
        return;
      }
      setStatuses((s) => ({ ...s, [review.playId]: "confirmed" }));
      if (index < queue.length - 1) goTo(index + 1);
    } catch {
      setFailure(OFFLINE_FAILURE);
      setStatuses((s) => ({ ...s, [review.playId]: "pending" }));
    }
  };

  if (!review || !source || !play) {
    return <p className="text-sm text-stone-400">No plays to review.</p>;
  }

  const beat = play.beats[Math.min(beatIndex, play.beats.length - 1)];
  const flagsThisBeat = review.flagged.filter((f) => f.beatIndex === beatIndex);
  const edited = play !== source;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {review.name}
            {status === "confirmed" && (
              <span className="ml-2 text-sm font-normal text-emerald-300">
                confirmed
              </span>
            )}
          </h2>
          <p className="text-sm text-stone-400">
            Play {index + 1} of {queue.length} · {confirmedCount} confirmed
          </p>
        </div>

        <div className="h-1 w-full overflow-hidden rounded bg-stone-800">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(confirmedCount / queue.length) * 100}%` }}
          />
        </div>

        <p className="text-sm text-stone-400">
          {review.flagged.length === 0
            ? "Nothing flagged — check it reads right and confirm."
            : `${review.flagged.length} thing${
                review.flagged.length === 1 ? "" : "s"
              } to check across ${play.beats.length} beats.`}
        </p>
      </header>

      {!review.valid && (
        <div role="alert" className="rounded-md border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <p className="font-medium">This play can&rsquo;t be confirmed yet</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {review.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {play.beats.map((b, i) => {
          const flags = review.flagged.filter((f) => f.beatIndex === i).length;
          const active = i === beatIndex;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBeatIndex(i);
                setSelectedFlag(null);
              }}
              aria-pressed={active}
              className={`rounded border px-3 py-1.5 text-sm ${
                active
                  ? "border-amber-500 bg-amber-500/20 text-amber-100"
                  : "border-stone-600 text-stone-300 hover:bg-stone-800"
              }`}
            >
              Beat {i + 1}
              {flags > 0 && (
                <span className="ml-1.5 text-amber-400" aria-label={`${flags} flagged`}>
                  ●
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <figure className="space-y-1">
          <figcaption className="text-xs uppercase tracking-wide text-stone-500">
            From the playbook
          </figcaption>
          {/*
            A play drawn in the builder has no source diagram, and one that came from
            the import may have lost its crop. A broken image icon would read as a bug;
            saying there is nothing to compare against is the truth.
          */}
          {cropMissing ? (
            <div className="flex h-[280px] w-full max-w-[400px] items-center justify-center rounded border border-dashed border-stone-700 px-6 text-center text-sm text-stone-500">
              No source diagram — this play wasn&rsquo;t imported from a PDF.
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cropUrl(play.name, beatIndex)}
              alt={`Source diagram, ${play.name} beat ${beatIndex + 1}`}
              onError={() => setCropMissing(true)}
              className="w-full max-w-[400px] rounded border border-stone-700 bg-white"
            />
          )}
        </figure>

        <figure className="space-y-1">
          <figcaption className="text-xs uppercase tracking-wide text-stone-500">
            What we read
          </figcaption>
          <CourtRenderer
            beat={beat}
            showDestinations
            highlightActionId={selectedFlag ?? undefined}
            markerSuffix={`review-${play.id}-${beat.id}`}
          />
        </figure>
      </div>

      {/*
        Full width and below the comparison, not tucked beside it. Editing needs the
        palette, the court and the selected-action panel all visible at once, and the
        coach has just decided what is wrong by looking at the two images above.
      */}
      <section className="space-y-3 rounded-md border border-stone-700 bg-stone-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">
            {editing
              ? `Editing beat ${beatIndex + 1}`
              : "Doesn't match the diagram?"}
          </h3>
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setSelectedFlag(null);
            }}
            className={`rounded border px-4 py-2 text-sm ${
              editing
                ? "border-stone-500 hover:bg-stone-800"
                : "border-amber-600 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
            }`}
          >
            {editing ? "Done editing" : "Fix this play"}
          </button>
        </div>

        {editing ? (
          <PlayEditorSurface editor={editor} />
        ) : (
          <p className="text-sm text-stone-400">
            Redraw a route, delete an action the importer invented, or change the order
            things happen in — the same tools as the builder.
          </p>
        )}
      </section>

      {edited && (
        <p role="status" className="text-sm text-amber-300">
          You&rsquo;ve changed this play. Confirming saves your version, not the import&rsquo;s.
        </p>
      )}

      {flagsThisBeat.length > 0 && (
        <ul className="space-y-2">
          {flagsThisBeat.map((flag) => {
            const active = selectedFlag === flag.actionId;
            return (
              <li key={`${flag.beatIndex}-${flag.actionId}`}>
                <button
                  type="button"
                  onMouseEnter={() => setSelectedFlag(flag.actionId)}
                  onFocus={() => setSelectedFlag(flag.actionId)}
                  onClick={() => setSelectedFlag(active ? null : flag.actionId)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    active
                      ? "border-amber-500 bg-amber-500/10 text-amber-100"
                      : "border-stone-700 text-stone-300 hover:bg-stone-800"
                  }`}
                >
                  {flag.why}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {failure && (
        <div
          role="alert"
          className={`rounded-md border px-4 py-3 text-sm ${
            failure.tone === "warn"
              ? "border-amber-700 bg-amber-950/30 text-amber-100"
              : "border-red-800 bg-red-950/30 text-red-100"
          }`}
        >
          <p className="font-medium">{failure.title}</p>
          <p className="mt-1 opacity-90">{failure.detail}</p>
          {failure.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {failure.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-800 pt-4">
        <button
          type="button"
          onClick={confirm}
          disabled={!review.valid || status === "saving"}
          className="rounded border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "saving"
            ? "Saving…"
            : status === "confirmed"
              ? "Confirmed — save again"
              : "Looks right"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index >= queue.length - 1}
          className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
      </div>

      <details className="text-sm text-stone-400">
        <summary className="cursor-pointer">The whole queue, worst first</summary>
        <ol className="mt-2 space-y-1">
          {queue.map((r, i) => (
            <li key={r.playId}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`text-left underline-offset-4 hover:underline ${
                  i === index ? "text-amber-300" : ""
                }`}
              >
                {i + 1}. {r.name} — {r.flagged.length} to check
                {statuses[r.playId] === "confirmed" ? " ✓" : ""}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
