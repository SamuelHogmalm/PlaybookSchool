"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { homePathForProfile } from "@/lib/teams";

/** Redirect non-coaches away from /coach/* */
export default function CoachGuard({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const isCoach = profile?.role === "coach" || user?.user_metadata?.role === "coach";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/coach/playbook");
      return;
    }
    if (profile && profile.role !== "coach" && user?.user_metadata?.role !== "coach") {
      router.replace("/player/today");
    }
  }, [loading, user, profile, router]);

  if (loading || !user || (!profile && !user?.user_metadata?.role)) {
    return (
      <div className="p-6 text-sm text-ink-soft">Loading coach dashboard…</div>
    );
  }

  if (!isCoach) {
    return (
      <div className="p-6 text-sm text-ink-soft">Loading coach dashboard…</div>
    );
  }

  return children;
}

export function useCoachHome() {
  return homePathForProfile({ role: "coach" });
}
