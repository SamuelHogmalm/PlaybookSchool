"use client";

import type { ValidationResult } from "@/lib/play/types";

type Props = {
  result: ValidationResult;
};

export function ValidationBanner({ result }: Props) {
  if (result.valid) {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-700/40 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200"
      >
        Ready — play passes all validation rules.
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-red-800/50 bg-red-950/40 px-4 py-2 text-sm text-red-200"
    >
      <p className="font-medium">Fix before saving:</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {result.errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
