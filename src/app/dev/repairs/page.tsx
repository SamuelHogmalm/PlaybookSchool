import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties } from "react";

import { CourtRenderer } from "@/components/court";
import { normalizeSeedPlay } from "@/lib/play/normalize";
import type { SeedPlay } from "@/lib/play/types";

type RingInfo = {
  startBall?: string;
  ringsInCourt?: number;
  ringToDigitPx?: number | null;
  confidence?: string;
  flags?: string[];
  usedFallback?: boolean;
};

type Repair = {
  kind: "inserted_pass" | "derived_movement";
  play: string;
  beatId: string;
  beatIndex: number;
  actionId?: string;
  actionType?: string;
  by?: string;
  for?: string;
  reason?: string;
  trigger?: string;
  cropUrl?: string;
  ringThisBeat?: RingInfo;
  ringNextBeat?: RingInfo;
  ringNextBeatCropUrl?: string;
  ringConfidence?: string;
  ringRisk?: boolean;
  nextBeatId?: string;
  nextStartBall?: string;
  beatStartBall?: string;
  beatEndBall?: string;
  holderAtStart?: string;
};

type ReviewData = {
  repairCount: number;
  insertedPassCount: number;
  derivedMovementCount: number;
  repairs: Repair[];
  passRingFlags: Array<{
    play: string;
    beatId: string;
    confidence: string;
    flags: string[];
    observedStartBall?: string;
  }>;
};

function loadData(): ReviewData {
  const raw = readFileSync(join(process.cwd(), "src/data/repairs-review.json"), "utf8");
  return JSON.parse(raw) as ReviewData;
}

function loadPlays(): SeedPlay[] {
  const raw = readFileSync(join(process.cwd(), "src/data/plays-interpreted.json"), "utf8");
  return JSON.parse(raw) as SeedPlay[];
}

function ringBadge(conf?: string, risky?: boolean) {
  if (!conf) return "unknown";
  if (risky) return `${conf} — FLAG`;
  return conf;
}

export default function RepairsReviewPage() {
  const data = loadData();
  const plays = loadPlays().map((p) => normalizeSeedPlay(p));
  const playByName = Object.fromEntries(plays.map((p) => [p.name, p]));

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>/dev/repairs — import repair review</h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Read-only. {data.repairCount} repairs: {data.insertedPassCount} inserted passes,{" "}
        {data.derivedMovementCount} derived movements.
      </p>

      <section style={{ marginBottom: 24, padding: 12, background: "#f6f6f6", border: "1px solid #ddd" }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Ring detection — 11 inserted-pass mismatches</h2>
        <p style={{ fontSize: 14, color: "#333" }}>
          Each inserted pass is triggered when derived end ball ≠ next frame&apos;s circled possession. Confidence
          below is for the <strong>next beat&apos;s</strong> ring (the observation that forced the insert).
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Play</th>
              <th style={th}>Insert at</th>
              <th style={th}>Next frame</th>
              <th style={th}>Observed ring</th>
              <th style={th}>Confidence</th>
              <th style={th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.repairs
              .filter((r) => r.kind === "inserted_pass")
              .map((r) => (
                <tr key={`${r.play}-${r.actionId}`} style={{ background: r.ringRisk ? "#fff3f3" : undefined }}>
                  <td style={td}>{r.play}</td>
                  <td style={td}>
                    {r.beatId} pass {r.by}→{r.for}
                  </td>
                  <td style={td}>{r.nextBeatId} startBall={r.nextStartBall}</td>
                  <td style={td}>{r.ringNextBeat?.ringsInCourt ?? "—"} ring(s)</td>
                  <td style={td}>{ringBadge(r.ringConfidence, r.ringRisk)}</td>
                  <td style={td}>{(r.ringNextBeat?.flags ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {data.passRingFlags.length > 0 && (
          <p style={{ color: "#a00", fontSize: 13, marginBottom: 0 }}>
            {data.passRingFlags.length} frame(s) flagged: low/none ring or fallback to player 1 — may be false
            &quot;missing pass&quot;.
          </p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>All repairs (passes first)</h2>
        {data.repairs.map((repair) => {
          const play = playByName[repair.play];
          const beat = play?.beats[repair.beatIndex];
          if (!beat) return null;

          const label =
            repair.kind === "inserted_pass"
              ? `INSERTED PASS — ${repair.by}→${repair.for}`
              : `DERIVED ${repair.actionType?.toUpperCase()} — P${repair.by}`;

          return (
            <article
              key={`${repair.play}-${repair.beatId}-${repair.actionId}`}
              style={{ border: "1px solid #ccc", marginBottom: 16, padding: 12 }}
            >
              <header style={{ marginBottom: 8 }}>
                <strong>
                  {repair.play} · {repair.beatId}
                </strong>
                <span style={{ marginLeft: 8, color: repair.kind === "inserted_pass" ? "#a00" : "#066" }}>
                  {label}
                </span>
              </header>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                <strong>Type:</strong> {repair.kind === "inserted_pass" ? "Cross-frame ring mismatch" : "Rule 9 idle movement"}
              </p>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                <strong>Trigger:</strong> {repair.trigger ?? repair.reason}
              </p>
              {repair.kind === "inserted_pass" && (
                <p style={{ fontSize: 13, margin: "4px 0" }}>
                  <strong>Ring check:</strong> next frame {repair.nextBeatId} startBall={repair.nextStartBall}{" "}
                  (confidence: {repair.ringConfidence}
                  {repair.ringRisk ? ", FLAGGED" : ""})
                </p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginTop: 12 }}>
                <figure style={{ margin: 0 }}>
                  <figcaption style={{ fontSize: 12, marginBottom: 4 }}>PDF crop — {repair.beatId}</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={repair.cropUrl}
                    alt={`${repair.play} ${repair.beatId} PDF crop`}
                    width={320}
                    style={{ border: "1px solid #999", maxWidth: "100%" }}
                  />
                </figure>
                <figure style={{ margin: 0 }}>
                  <figcaption style={{ fontSize: 12, marginBottom: 4 }}>
                    Rendered beat (highlight = repair)
                  </figcaption>
                  <CourtRenderer
                    beat={beat}
                    highlightActionId={repair.actionId}
                    markerSuffix={`-${repair.play}-${repair.beatId}`}
                  />
                  <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
                    startBall={beat.startBall} · end ball={beat.ball}
                  </p>
                </figure>
                {repair.kind === "inserted_pass" && repair.ringNextBeatCropUrl && (
                  <figure style={{ margin: 0 }}>
                    <figcaption style={{ fontSize: 12, marginBottom: 4 }}>
                      Next frame crop — {repair.nextBeatId} (ring that triggered insert)
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={repair.ringNextBeatCropUrl}
                      alt={`${repair.play} ${repair.nextBeatId} PDF crop`}
                      width={320}
                      style={{ border: "1px solid #999", maxWidth: "100%" }}
                    />
                  </figure>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16 }}>
          All seed beats — 12 plays, 36 beats via CourtRenderer
        </h2>
        <p style={{ fontSize: 13, color: "#555" }}>
          Render checkpoint: every beat in plays-interpreted.json.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {plays.flatMap((play) =>
            play.beats.map((beat, beatIndex) => (
              <figure
                key={`${play.name}-${beat.id}`}
                style={{ margin: 0, border: "1px solid #ddd", padding: 8 }}
              >
                <figcaption style={{ fontSize: 11, marginBottom: 6 }}>
                  {play.name} · {beat.id} ({beat.actions.length} actions)
                </figcaption>
                <CourtRenderer
                  beat={beat}
                  markerSuffix={`-all-${play.name}-${beat.id}`}
                  width={180}
                />
              </figure>
            )),
          )}
        </div>
      </section>
    </main>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #bbb",
  padding: "6px 8px",
};

const td: CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "6px 8px",
  verticalAlign: "top",
};
