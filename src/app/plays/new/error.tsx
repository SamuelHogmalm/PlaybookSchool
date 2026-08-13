"use client";

import { useEffect } from "react";

/**
 * Route-level boundary for the builder.
 *
 * Without it, a throw from anywhere in the play engine unmounts the tree and leaves a
 * blank page with no indication anything went wrong.
 *
 * The copy is deliberate about what "Start a new play" costs. The builder holds the
 * play in component state and there is no draft persistence yet, so resetting really
 * does discard the work — promising recovery here would be a lie.
 */
export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Play builder crashed:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 p-6">
      <div className="w-full max-w-lg space-y-4 rounded border border-stone-700 bg-stone-900/60 p-6 text-stone-100">
        <h1 className="text-xl font-semibold">The play builder stopped</h1>

        <p className="text-sm text-stone-300">
          Something in the play engine threw an error, so the builder shut down rather
          than carry on with a play it could not read.
        </p>

        <p className="text-sm text-stone-400">
          This play was not saved, and starting again begins from an empty play — the
          builder keeps work in the page, so it is gone once this screen appears. If you
          can remember what you drew just before this, that is worth writing down: it is
          the most useful part of a bug report.
        </p>

        {error.digest && (
          <p className="font-mono text-xs text-stone-500">
            Error reference: {error.digest}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
          >
            Start a new play
          </button>
          <a
            href="/dev/animator"
            className="rounded border border-stone-600 px-3 py-1.5 text-sm hover:bg-stone-800"
          >
            Open the animator instead
          </a>
        </div>
      </div>
    </main>
  );
}
