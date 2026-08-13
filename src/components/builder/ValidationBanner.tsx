"use client";

import type { ValidationResult } from "@/lib/play/types";

type Props = {
  result: ValidationResult;
};

/**
 * One live region, always mounted.
 *
 * The three states used to be three separate elements, so going from "Ready" to an
 * error swapped the live region out for a different one. A live region that appears at
 * the same moment as its content is frequently not announced at all — the region has to
 * already exist for the change to register as a change.
 */
export function ValidationBanner({ result }: Props) {
  const hasErrors = !result.valid;
  const hasWarnings = result.valid && result.warnings.length > 0;

  const tone = hasErrors
    ? "border-red-800/50 bg-red-950/40 text-red-200"
    : hasWarnings
      ? "border-amber-700/40 bg-amber-950/40 text-amber-200"
      : "border-emerald-700/40 bg-emerald-950/40 text-emerald-200";

  return (
    <div
      // Errors interrupt; warnings and the ready state wait for a pause.
      role={hasErrors ? "alert" : "status"}
      aria-live={hasErrors ? "assertive" : "polite"}
      aria-atomic="true"
      className={`rounded-md border px-4 py-2 text-sm ${tone}`}
    >
      {hasErrors ? (
        <>
          <p className="font-medium">Fix before saving:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </>
      ) : hasWarnings ? (
        <>
          <p className="font-medium">Ready with review flags:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      ) : (
        <span>Ready — play passes all validation rules.</span>
      )}
    </div>
  );
}
