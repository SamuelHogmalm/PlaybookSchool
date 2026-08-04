"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { fetchCoachRoster, formatJoinInvite } from "@/lib/teams";
import { ROSTER, TEAM } from "@/data/mockTeam";

function formatLastActive(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function CoachRosterPage() {
  const { user, profile, team, configured } = useAuth();
  const [roster, setRoster] = useState(null);
  const [copied, setCopied] = useState(false);

  const live = configured && user && profile?.role === "coach" && profile?.team_id;

  useEffect(() => {
    if (!live) {
      setRoster(null);
      return;
    }
    fetchCoachRoster().then(setRoster).catch(() => setRoster([]));
  }, [live, team?.id]);

  const joinCode = team?.join_code ?? TEAM.joinCode;
  const players = live && roster ? roster : ROSTER.map((p) => ({
    id: p.id,
    full_name: p.name,
    jersey: p.jersey,
    position: p.position,
    last_quiz_at: null,
    quiz_attempts: p.mastered + (p.total - p.mastered),
    quiz_correct: p.mastered,
    streak: p.streak,
    lastActive: p.lastActive,
    mastered: p.mastered,
    total: p.total,
  }));

  const copyInvite = useCallback(async () => {
    const text = formatJoinInvite(joinCode);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [joinCode]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">Roster</h1>
          <p className="text-xs text-ink-soft mt-0.5">
            {players.length} player{players.length === 1 ? "" : "s"}
            {!live && configured && user && " · demo data until team is ready"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-data text-lg font-medium">{joinCode}</p>
          <button
            type="button"
            onClick={copyInvite}
            className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs mt-1"
          >
            {copied ? "Copied!" : "Copy invite"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {live && roster?.length === 0 && (
          <p className="text-sm text-ink-soft mb-4">
            No players yet. Share the join code above — players enter it on the Me tab after signing up.
          </p>
        )}
        <div className="border border-rule overflow-x-auto">
          <table className="ps-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Pos</th>
                <th scope="col">Last active</th>
                <th scope="col">Quiz stats</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="font-data">{p.jersey ?? "—"}</td>
                  <td>{p.full_name ?? p.name}</td>
                  <td className="font-data">{p.position ?? "—"}</td>
                  <td className="text-ink-soft">
                    {p.lastActive ?? formatLastActive(p.last_quiz_at)}
                  </td>
                  <td className="font-data">
                    {live
                      ? `${p.quiz_correct ?? 0}/${p.quiz_attempts ?? 0} correct`
                      : `${p.mastered}/${p.total}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
