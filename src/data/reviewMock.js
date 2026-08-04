/** Mock AI breakdown for review UX — replace with API output later. */
export const REVIEW_MOCKS = {
  Alabama: {
    summary:
      "Spread half-court set. 1 initiates from the top, action develops through the elbows and wings with ball movement to the perimeter.",
    purpose:
      "Open a catch-and-shoot or drive closeout by shifting the defense with ball movement and spacing.",
    beatNotes: [
      "Spread alignment — 1 on top with the ball, wings filled, bigs at the elbows.",
      "1 moves left. 5 and 4 adjust at the elbows — read the defense's help side.",
      "Ball swings through 5 at the elbow. Help shifts with the pass.",
      "Ball finds 3 on the left wing for the shot or drive.",
    ],
    counters: [
      { trigger: "Help rotates early on ball movement", answer: "Skip to the open man on the weak side — don't force the first look." },
      { trigger: "Defender goes under on the ball handler", answer: "Rise up into the pull-up if they give you space." },
      { trigger: "Defense collapses on the elbow catch", answer: "Kick to the wing or corner for the open three." },
    ],
  },
};

export function enrichPlayForReview(play, mock) {
  if (!mock) return { ...play, summary: "", purpose: "", verified: false };
  return {
    ...play,
    summary: mock.summary,
    purpose: mock.purpose,
    verified: false,
    frames: play.frames.map((f, i) => ({
      ...f,
      note: mock.beatNotes?.[i] ?? f.note,
    })),
    counters: mock.counters ?? play.counters ?? [],
  };
}
