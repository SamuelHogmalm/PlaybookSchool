"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { isCoachUser } from "@/lib/teams";

/** Send logged-in coaches to the coach app unless they opened player preview (?preview=1). */
export default function PlayerCoachRedirect() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "1";

  useEffect(() => {
    if (loading || !user || preview) return;
    if (isCoachUser(profile, user) && pathname.startsWith("/player")) {
      router.replace("/coach/playbook");
    }
  }, [loading, user, profile, preview, pathname, router]);

  return null;
}
