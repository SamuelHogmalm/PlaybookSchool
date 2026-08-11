"use client";

import Link from "next/link";
import PlayerQuizSession from "@/components/player/PlayerQuizSession";
import { allPlays } from "@/lib/plays";
import { CURRENT_PLAYER } from "@/data/mockTeam";
import { getTodayQuizLabel } from "@/lib/dailyQuiz";

const POS_MAP = { PG: "1", SG: "2", SF: "3", PF: "4", C: "5" };

export default function TodayQuizPage() {
  const myId = POS_MAP[CURRENT_PLAYER.position] ?? "4";

  return (
    <div>
      <Link href="/player/today" className="text-sm text-chalk font-semibold mb-3 inline-block">
        ← Today
      </Link>
      <p className="font-data text-xs uppercase tracking-widest text-ink-soft mb-1">
        {getTodayQuizLabel()}
      </p>
      <h1 className="font-display text-xl font-bold mb-1">Team quiz</h1>
      <p className="text-sm text-ink-soft mb-4">
        Pick your position — starting spots, draw your routes, and remember where to go on each beat.
      </p>

      <PlayerQuizSession
        plays={allPlays}
        variant="daily"
        myId={myId}
        maxQuestions={15}
      />
    </div>
  );
}
