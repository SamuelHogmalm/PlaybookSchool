"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { isCoach } from "@/lib/auth";

export default function CoachGuard({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.replace("/login?next=/coach/playbook");
      return;
    }
    if (!isCoach(profile, user)) {
      window.location.replace("/player/today");
    }
  }, [loading, user, profile, router]);

  if (loading || !user) {
    return <div className="p-6 text-sm text-ink-soft">Loading coach dashboard…</div>;
  }

  if (!isCoach(profile, user)) {
    return <div className="p-6 text-sm text-ink-soft">Loading coach dashboard…</div>;
  }

  return children;
}
