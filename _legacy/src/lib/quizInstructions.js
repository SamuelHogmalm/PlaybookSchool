/** One-sentence quiz copy — read fast, then watch. */

export const QUESTION_HEADLINE = {
  formation: "Where should you be?",
  draw: "Draw your next cut.",
  watch: "What do you do next?",
  mc: "Pick the answer.",
  identify: "What's this play called?",
  category: "What type of set is this?",
  look: "What's the main look?",
  beats: "How many beats?",
};

export function questionHeadline(q) {
  if (!q) return "";
  if (q.kind === "formation") return QUESTION_HEADLINE.formation;
  if (q.kind === "draw") return QUESTION_HEADLINE.draw;
  if (q.kind === "watch") return QUESTION_HEADLINE.watch;
  if (q.category === "identify") return QUESTION_HEADLINE.identify;
  if (q.category === "category") return QUESTION_HEADLINE.category;
  if (q.category === "look") return QUESTION_HEADLINE.look;
  if (q.category === "beats") return QUESTION_HEADLINE.beats;
  if (q.kind === "mc") return QUESTION_HEADLINE.mc;
  const short = q.prompt?.split(/[.?!]/)[0]?.trim();
  return short && short.length <= 60 ? short : QUESTION_HEADLINE.mc;
}

/** No sub-text during watch — keep the card clean */
export function questionContext() {
  return null;
}

export function needsManualWatchStart(headline) {
  return (headline?.length ?? 0) > 58;
}

export const QUESTION_READ_MS = 2800;
export const CONTEXT_READ_MS = 2800;
export const CORRECTION_READ_MS = 2400;

export function needsContextPhase() {
  return false;
}

/** Beat context shown before the question — where you are on the play. */
export function contextHeadline(q) {
  if (!q) return "You're here.";
  if (q.sub) {
    return q.sub
      .replace(/\s*Tap the floor\.?\s*$/i, "")
      .replace(/\s*Draw your route\.?\s*$/i, "")
      .trim();
  }
  return "You're here.";
}

export function watchHeadline(q) {
  if (q?.kind === "draw") return "Watch how we get here.";
  return "Watch the play first.";
}

export function prefaceTitle(q) {
  return questionHeadline(q);
}

export function prefaceHint() {
  return null;
}
