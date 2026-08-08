"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { isCoach, COACH_HOME } from "@/lib/auth";

export default function PlayerCoachRedirect() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "1";

  useEffect(() => {
    if (loading || !user || preview) return;
    if (isCoach(profile, user) && pathname.startsWith("/player")) {
      window.location.replace(COACH_HOME);
    }
  }, [loading, user, profile, preview, pathname]);

  return null;
}
