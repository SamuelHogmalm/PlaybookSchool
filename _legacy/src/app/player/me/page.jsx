"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";
import { fetchUserMastery } from "@/lib/quizProgress";
import { joinTeamByCode } from "@/lib/teams";
import { CURRENT_PLAYER, PLAYER_MASTERY } from "@/data/mockTeam";

export default function PlayerMePage() {
  const { user, profile, team, signOut, configured, refreshProfile } = useAuth();
  const [mastery, setMastery] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user) {
      setMastery(null);
      return;
    }
    fetchUserMastery(user.id).then((rows) => {
      setMastery(rows.length ? rows : []);
    });
  }, [user]);

  const displayName = profile?.full_name ?? CURRENT_PLAYER.name;
  const jersey = profile?.jersey ?? CURRENT_PLAYER.jersey;
  const position = profile?.position ?? CURRENT_PLAYER.position;
  const useDemo = !user || (mastery !== null && mastery.length === 0 && !configured);
  const rows = user && mastery !== null && mastery.length > 0 ? mastery : useDemo ? PLAYER_MASTERY : [];
  const weakest = rows.length ? [...rows].sort((a, b) => a.pct - b.pct).slice(0, 3) : [];

  const onJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    setJoinError("");
    try {
      await joinTeamByCode(joinCode);
      await refreshProfile();
    } catch (err) {
      setJoinError(err.message ?? "Invalid code");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">{displayName}</h1>
      <p className="font-data text-sm text-ink-soft mb-2">
        #{jersey} · {position}
        {team?.name ? ` · ${team.name}` : null}
      </p>
      {user ? (
        <button type="button" onClick={() => signOut()} className="text-xs text-chalk mb-6">
          Sign out
        </button>
      ) : (
        <p className="text-xs text-ink-soft mb-6">
          <Link href="/login" className="text-chalk">
            Log in
          </Link>{" "}
          {configured ? "to sync progress across devices" : "(Supabase not configured — demo data below)"}
        </p>
      )}

      {user && profile?.role === "player" && !team && configured && (
        <section className="mb-6 border border-rule p-4 bg-paper-2">
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">
            Join your team
          </p>
          <form className="flex gap-2 flex-wrap" onSubmit={onJoin}>
            <input
              className="ps-input flex-1 min-w-[140px] font-data uppercase"
              placeholder="EAG-4829"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <button type="submit" disabled={joining} className="ps-btn ps-btn-primary disabled:opacity-50">
              {joining ? "…" : "Join"}
            </button>
          </form>
          {joinError && <p className="text-xs text-flag mt-2">{joinError}</p>}
          <p className="text-xs text-ink-soft mt-2">
            Or open{" "}
            <Link href="/player/join" className="text-chalk">
              join page
            </Link>
          </p>
        </section>
      )}

      <section className="mb-6">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">Mastery</p>
        {user && mastery !== null && mastery.length === 0 ? (
          <p className="text-sm text-ink-soft">Take a quiz to start building mastery.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft">Take a quiz to start building mastery.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((m) => (
              <div key={m.play}>
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="font-display font-semibold">{m.play}</span>
                  <span className="font-data text-ink-soft">{m.pct}%</span>
                </div>
                <div className="h-1.5 bg-rule">
                  <div
                    className={`h-full ${m.status === "mastered" ? "bg-go" : "bg-chalk"}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-ink-soft mt-0.5">
                  {m.status === "mastered" ? "Mastered" : "Still learning"}
                </p>
              </div>
            ))}
          </div>
        )}
        {user && configured && (
          <p className="text-[10px] text-ink-soft mt-2">Progress saved to your account.</p>
        )}
      </section>

      {weakest.length > 0 && (
        <section className="mb-6">
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">Focus next</p>
          <ul className="border border-rule divide-y divide-rule">
            {weakest.map((m) => (
              <li key={m.play} className="px-3 py-2 text-sm flex justify-between">
                <span>{m.play}</span>
                <span className="font-data text-ink-soft">{m.pct}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!user && (
        <section>
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">Streak</p>
          <p className="font-display text-3xl font-bold">{CURRENT_PLAYER.streak} days</p>
        </section>
      )}
    </div>
  );
}
