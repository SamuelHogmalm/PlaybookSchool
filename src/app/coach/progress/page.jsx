"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { fetchTeamForgottenPlays } from "@/lib/quizProgress";
import { FORGOTTEN_PLAYS, TEAM_READINESS } from "@/data/mockTeam";

export default function CoachProgressPage() {
  const { profile, configured, user } = useAuth();
  const [forgotten, setForgotten] = useState(null);

  useEffect(() => {
    if (!user || !profile?.team_id || profile.role !== "coach") {
      setForgotten(null);
      return;
    }
    fetchTeamForgottenPlays(profile.team_id).then(setForgotten);
  }, [user, profile]);

  const showLive = configured && profile?.role === "coach" && profile?.team_id && forgotten?.length > 0;
  const rows = showLive ? forgotten : FORGOTTEN_PLAYS;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <h1 className="font-display text-xl font-bold">Progress</h1>
        {!showLive && configured && user && (
          <p className="text-xs text-ink-soft mt-1">
            Demo data — assign players to a team to see live analytics.
          </p>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-6 max-w-3xl">
        <section>
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">
            Team readiness
          </p>
          <p className="font-display text-5xl font-bold">{TEAM_READINESS}%</p>
          <p className="text-xs text-ink-soft mt-1">
            Assignments completed, weighted by mastery per play.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold mb-3">Most forgotten plays</h2>
          <div className="border border-rule">
            <table className="ps-table mb-0">
              <thead>
                <tr>
                  <th scope="col">Play</th>
                  <th scope="col">Miss rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.name}>
                    <td className="font-display font-semibold">{p.name}</td>
                    <td className="font-data text-flag">{p.missRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
