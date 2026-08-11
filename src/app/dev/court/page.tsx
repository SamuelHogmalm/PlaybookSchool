import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CourtRenderer } from "@/components/court";
import { normalizeSeedPlay } from "@/lib/play/normalize";
import type { Play, SeedPlay } from "@/lib/play/types";

function loadPlays(): Play[] {
  const raw = readFileSync(
    join(process.cwd(), "src/data/plays-interpreted.json"),
    "utf8",
  );
  return (JSON.parse(raw) as SeedPlay[]).map((p) => normalizeSeedPlay(p));
}

function findPlay(plays: Play[], name: string): Play {
  const play = plays.find((p) => p.name === name);
  if (!play) throw new Error(`Play not found: ${name}`);
  return play;
}

const samples = [
  {
    title: "Alabama b1 — dribble, cut, derived cut (muted)",
    play: "Alabama",
    beatIndex: 0,
    showDestinations: false,
  },
  {
    title: "Alabama b4 — pass + screen",
    play: "Alabama",
    beatIndex: 3,
    showDestinations: false,
  },
  {
    title: "Alabama b3 — inserted pass (needsReview, muted)",
    play: "Alabama",
    beatIndex: 2,
    showDestinations: false,
    highlightActionId: "a8",
  },
  {
    title: "Horns b1 — builder mode with destination ghosts",
    play: "Horns",
    beatIndex: 0,
    showDestinations: true,
  },
] as const;

export default function CourtPreviewPage() {
  const plays = loadPlays();

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>/dev/court — CourtRenderer</h1>
      <p style={{ marginTop: 0, color: "#555", maxWidth: 640 }}>
        Pure presentation layer. Tokens at <code>startPos</code>; actions drawn{" "}
        <code>startPos → pos</code>. Destination ghosts (dashed) show{" "}
        <code>beat.pos</code> when enabled.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 24,
          marginTop: 24,
        }}
      >
        {samples.map((sample) => {
          const play = findPlay(plays, sample.play);
          const beat = play.beats[sample.beatIndex];
          const highlightActionId =
            "highlightActionId" in sample ? sample.highlightActionId : undefined;

          return (
            <figure key={sample.title} style={{ margin: 0 }}>
              <figcaption style={{ fontSize: 13, marginBottom: 8, fontWeight: 600 }}>
                {sample.title}
              </figcaption>
              <CourtRenderer
                beat={beat}
                showDestinations={sample.showDestinations}
                highlightActionId={highlightActionId}
                markerSuffix={`-${sample.play}-${beat.id}`}
              />
              <p style={{ fontSize: 11, color: "#666", margin: "6px 0 0" }}>
                startBall={beat.startBall} · ball={beat.ball} · {beat.actions.length}{" "}
                action(s)
              </p>
            </figure>
          );
        })}
      </section>
    </main>
  );
}
