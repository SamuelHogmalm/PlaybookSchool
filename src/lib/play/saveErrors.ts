/**
 * Save failures a coach can act on.
 *
 * Each status means something different about what to do next, so none of them share
 * copy. Extracted from the builder so the review flow says the same things — a coach
 * who learns what "create your team first" means in one screen should not meet
 * different wording for the same problem in another.
 */
export type SaveFailure = {
  title: string;
  detail: string;
  errors: string[];
  tone: "warn" | "error";
};

export function describeSaveFailure(
  status: number,
  body: { error?: string; validationErrors?: string[] } = {},
): SaveFailure {
  if (status === 401) {
    return {
      tone: "warn",
      title: "Not signed in — this play is local only",
      detail:
        "Your work is safe in this tab, but nothing has been sent to the cloud. Sign in and press Save again to keep it.",
      errors: [],
    };
  }
  if (status === 409) {
    return {
      tone: "warn",
      title: "Create your team before saving plays",
      detail:
        "Plays belong to a team, and your account isn't on one yet. Create a team, then press Save again — nothing here is lost.",
      errors: [],
    };
  }
  if (status === 403) {
    return {
      tone: "warn",
      title: "Coach account required",
      detail:
        body.error ??
        "Only coaches can add plays to a team's playbook. Check the role on the account you are signed in as — it must be exactly \"coach\".",
      errors: [],
    };
  }
  if (status === 422) {
    return {
      tone: "error",
      title: "This play isn't ready to save",
      detail:
        "Every play has to hold together as basketball before players can drill it. Fix these, then save:",
      errors: body.validationErrors ?? [],
    };
  }
  if (status === 503) {
    return {
      tone: "warn",
      title: "Cloud saving isn't set up",
      detail:
        "The app has no database configured, so plays can't be stored yet. Keep this tab open — your play is still here.",
      errors: [],
    };
  }
  return {
    tone: "error",
    title: `Save failed (${status})`,
    detail: body.error ?? "Something went wrong on the way to the server. Try again.",
    errors: [],
  };
}

/** Thrown request, not a rejected one — no status to interpret. */
export const OFFLINE_FAILURE: SaveFailure = {
  tone: "warn",
  title: "Couldn't reach the server",
  detail:
    "Your play is still here in this tab. Check your connection and press Save again.",
  errors: [],
};
