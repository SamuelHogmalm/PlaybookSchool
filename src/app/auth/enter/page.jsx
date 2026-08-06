"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";
import { homeForUser, COACH_HOME } from "@/lib/auth";

/** After login/signup — wait for session + profile, then route to coach or player home. */
function AuthEnterInner() {
  const { user, profile, loading, configError } = useAuth();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      window.location.replace("/login");
      return;
    }

    const dest =
      next && next.startsWith("/") && !next.startsWith("/auth/")
        ? next
        : homeForUser(profile, user);

    window.location.replace(dest);
  }, [loading, user, profile, next]);

  const hint = user && homeForUser(profile, user) === COACH_HOME ? "coach playbook" : "player app";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="font-display text-lg font-bold mb-2">Signing you in…</p>
        <p className="text-sm text-ink-soft">
          {loading ? "Loading your account…" : `Opening ${hint}…`}
        </p>
        {configError && <p className="text-sm text-flag mt-4">{configError}</p>}
        {!loading && !user && (
          <Link href="/login" className="text-sm text-chalk mt-4 inline-block">
            Back to login
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AuthEnterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <p className="text-sm text-ink-soft">Loading…</p>
        </div>
      }
    >
      <AuthEnterInner />
    </Suspense>
  );
}
