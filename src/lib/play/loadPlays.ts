import { normalizeSeedPlay } from "./normalize";
import { validatePlay } from "./validation";
import type { Play, SeedPlay } from "./types";
import seedPlays from "@/data/plays-interpreted.json";

export type PlaySource = "team" | "seed";

export type LoadedPlays = {
  plays: Play[];
  source: PlaySource;
  /** Why the team's playbook was not used, when it wasn't. */
  note?: string;
};

/** Validate on the way in. Nothing downstream should have to wonder. */
function withValidity(play: Play): Play {
  const result = validatePlay(play);
  return { ...play, valid: result.valid, validationErrors: result.errors };
}

/** The imported book, normalized and validated. Always available, never empty. */
export function seedLibrary(): Play[] {
  return (seedPlays as SeedPlay[]).map((raw) => withValidity(normalizeSeedPlay(raw)));
}

/**
 * The team's saved plays, falling back to the imported seed.
 *
 * A coach who draws a play, saves it, and then finds the quiz still asking about the
 * import would reasonably conclude saving did nothing. The fallback exists so the app is
 * usable before anything has been saved — not to quietly replace a team's own playbook,
 * which is why the source comes back with the plays and every screen says which it is.
 */
export async function loadPlays(): Promise<LoadedPlays> {
  try {
    const res = await fetch("/api/plays");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        plays: seedLibrary(),
        source: "seed",
        note:
          res.status === 401
            ? "Not signed in — showing the imported playbook."
            : (body.error as string) ?? "Could not load your team's playbook.",
      };
    }
    const body = (await res.json()) as { plays?: Play[] };
    const saved = (body.plays ?? []).map(withValidity);
    if (!saved.length) {
      return {
        plays: seedLibrary(),
        source: "seed",
        note: "Your team has no saved plays yet — showing the imported playbook.",
      };
    }
    return { plays: saved, source: "team" };
  } catch {
    return {
      plays: seedLibrary(),
      source: "seed",
      note: "Couldn't reach the server — showing the imported playbook.",
    };
  }
}
