"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { joinTeamByCode } from "@/lib/teams";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, team, refreshProfile, configured, loading } = useAuth();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl) setCode(fromUrl);
  }, [searchParams]);

  if (!configured) {
    return (
      <p className="text-sm text-ink-soft">
        Supabase not configured.{" "}
        <Link href="/player/today" className="text-chalk">
          Continue in demo mode
        </Link>
      </p>
    );
  }

  if (!loading && !user) {
    return (
      <p className="text-sm text-ink-soft">
        <Link href={`/login?next=/player/join${code ? `?code=${encodeURIComponent(code)}` : ""}`} className="text-chalk">
          Log in
        </Link>{" "}
        to join a team.
      </p>
    );
  }

  if (profile?.role === "coach") {
    return (
      <p className="text-sm text-ink-soft">
        Coach accounts manage teams from the{" "}
        <Link href="/coach/roster" className="text-chalk">
          roster page
        </Link>
        .
      </p>
    );
  }

  if (team?.name) {
    return (
      <div>
        <p className="text-sm text-go mb-2">You&apos;re on {team.name}.</p>
        <Link href="/player/today" className="ps-btn ps-btn-primary inline-block">
          Go to today&apos;s quiz
        </Link>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setWorking(true);
    setError("");
    try {
      await joinTeamByCode(code);
      await refreshProfile();
      router.push("/player/today");
    } catch (err) {
      setError(err.message ?? "Could not join team");
    } finally {
      setWorking(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="ps-label" htmlFor="code">
          Team join code
        </label>
        <input
          id="code"
          className="ps-input font-data uppercase"
          placeholder="EAG-4829"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-flag">{error}</p>}
      <button
        type="submit"
        disabled={working || loading}
        className="ps-btn ps-btn-primary w-full disabled:opacity-50"
      >
        {working ? "Joining…" : "Join team"}
      </button>
    </form>
  );
}

export default function PlayerJoinPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Join your team</h1>
      <p className="text-sm text-ink-soft mb-6">
        Enter the code your coach shared. Progress syncs once you&apos;re on the roster.
      </p>
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
        <JoinForm />
      </Suspense>
    </div>
  );
}
