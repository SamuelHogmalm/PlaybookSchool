"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ASSIGNMENTS, CURRENT_PLAYER, REVIEW_QUEUE } from "@/data/mockTeam";
import { getPlayByName } from "@/lib/plays";

export default function PlayerTodayPage() {
  const router = useRouter();
  const pending = ASSIGNMENTS.filter((a) => !a.completed);
  const showReview = pending.length === 0;

  return (
    <div>
      <div className="mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">Streak</p>
        <p className="font-display text-5xl font-bold text-ink">{CURRENT_PLAYER.streak}d</p>
        <p className="text-sm text-ink-soft mt-1">Hey {CURRENT_PLAYER.name.split(" ")[0]} — keep it going.</p>
      </div>

      {showReview ? (
        <div className="border border-rule p-4 bg-paper-2 mb-4">
          <p className="font-data text-xs text-ink-soft mb-1">Spaced repetition</p>
          <p className="font-display text-xl font-bold">{REVIEW_QUEUE.count} plays due for review</p>
          <p className="text-sm text-ink-soft mt-2 mb-4">
            No new assignments — drill what you&apos;ve started.
          </p>
          <Link href="/player/practice" className="ps-btn ps-btn-primary w-full">
            Start review
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft">Assigned</p>
          {pending.map((a) => (
            <article key={a.id} className="border border-rule p-4 bg-paper">
              <div className="flex justify-between items-start gap-2 mb-2">
                <h2 className="font-display text-lg font-semibold leading-tight">{a.title}</h2>
                <span className="font-data text-xs text-ink-soft shrink-0">Due {a.due}</span>
              </div>
              {a.coachNote && (
                <p className="text-sm text-ink-soft mb-3 italic">&ldquo;{a.coachNote}&rdquo;</p>
              )}
              <p className="font-data text-xs text-ink-soft mb-3">
                {a.plays.join(" · ")} · {a.type}
              </p>
              <button
                type="button"
                className="ps-btn ps-btn-primary w-full"
                onClick={() => {
                  const play = getPlayByName(a.plays[0]);
                  if (play) {
                    sessionStorage.setItem("ps-practice-play", JSON.stringify({ name: play.name }));
                  }
                  router.push("/player/practice");
                }}
              >
                Start
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
