"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { allPlays } from "@/lib/plays";
import { breakdownStats } from "@/lib/playData";
import { generateFlashcardDeck } from "@/lib/quiz";
import { generateDailyQuizDeck } from "@/lib/dailyQuiz";

function formatQuestion(q, n) {
  const lines = [
    `${n}. [${q.category?.toUpperCase()}] ${q.playName ?? ""}`.trim(),
    `   STEM: ${q.prompt}`,
    `   SUB:  ${q.sub ?? ""}`,
  ];
  if (q.correct && (q.kind === "mc" || q.kind === "watch")) {
    lines.push(`   OPTIONS:`);
    const opts = q.options ?? [];
    for (const o of opts) {
      const mark = o === q.correct ? " *" : "";
      lines.push(`     - ${o}${mark}`);
    }
  } else if (q.kind === "formation" || q.kind === "draw") {
    lines.push(`   (tap/draw — no MC options)`);
  }
  return lines.join("\n");
}

export default function SampleQuestionsPage() {
  const [myId, setMyId] = useState("2");
  const stats = useMemo(() => breakdownStats(allPlays), []);

  const text = useMemo(() => {
    const lines = [
      `Sample questions — player #${myId}`,
      `Source: plays-interpreted.json + plays-breakdowns.json`,
      `Breakdowns: ${stats.withBreakdown}/${stats.total} plays`,
      "",
    ];

    const withBd = allPlays.filter((p) => p.breakdown && !p.breakdownStale);
    const withoutBd = allPlays.filter((p) => !p.breakdown || p.breakdownStale);

    let n = 0;

    for (const play of withBd) {
      lines.push(`--- ${play.name} (breakdown) ---`);
      const { deck } = generateFlashcardDeck(play, myId, { maxCards: 6 });
      for (const q of deck) {
        if (n >= 30) break;
        n += 1;
        lines.push(formatQuestion({ ...q, playName: play.name }, n));
        lines.push("");
      }
      if (n >= 30) break;
    }

    if (n < 30 && withoutBd.length) {
      lines.push(`--- plays without breakdown (beat notes only) ---`);
      for (const play of withoutBd.slice(0, 3)) {
        const { deck } = generateFlashcardDeck(play, myId, { maxCards: 4 });
        for (const q of deck) {
          if (n >= 30) break;
          n += 1;
          lines.push(formatQuestion({ ...q, playName: play.name }, n));
          lines.push("");
        }
        if (n >= 30) break;
      }
    }

    if (n < 30) {
      const { deck } = generateDailyQuizDeck(allPlays, myId, { maxCards: 30 - n });
      for (const q of deck) {
        if (n >= 30) break;
        n += 1;
        lines.push(formatQuestion(q, n));
        lines.push("");
      }
    }

    if (stats.withBreakdown === 0) {
      lines.push("");
      lines.push(
        "No breakdowns yet. Run: cd services/importer && python run_breakdown_all.py"
      );
    }

    return lines.join("\n");
  }, [myId, stats.withBreakdown, stats.total]);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Link href="/dev/verify" className="text-sm text-chalk font-semibold">
        ← Verify plays
      </Link>
      <h1 className="font-display text-xl font-bold mt-2 mb-1">Sample quiz questions</h1>
      <p className="text-sm text-ink-soft mb-2">
        Breakdown-driven main-look questions when{" "}
        <code className="text-xs">plays-breakdowns.json</code> has data. Formation, draw, and
        next-spot MC from beat actions.
      </p>
      <p className="text-sm text-ink-soft mb-4">
        Breakdowns loaded: <strong>{stats.withBreakdown}</strong> / {stats.total} plays
      </p>

      <label className="block text-sm mb-4">
        Player role{" "}
        <select
          className="ps-input ml-2 w-16"
          value={myId}
          onChange={(e) => setMyId(e.target.value)}
        >
          {["1", "2", "3", "4", "5"].map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <pre className="text-xs border border-rule bg-paper p-4 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
