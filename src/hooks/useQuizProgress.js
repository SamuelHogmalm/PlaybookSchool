"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  emptyProgress,
  loadQuizProgressForUser,
  progressMode,
  progressModeLabel,
  recordQuizAttempt,
} from "@/lib/quizProgress";

export function useQuizProgress(playerRole) {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState(emptyProgress());
  const [ready, setReady] = useState(false);

  const mode = progressMode(user?.id ?? null);
  const modeLabel = progressModeLabel(mode);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      const p = await loadQuizProgressForUser(user?.id ?? null, playerRole);
      if (!cancelled) {
        setProgress(p);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, playerRole]);

  const recordAttempt = useCallback(
    async (payload) => {
      const next = await recordQuizAttempt(
        { userId: user?.id ?? null, playerRole, progress },
        payload
      );
      setProgress(next);
      return next;
    },
    [user?.id, playerRole, progress]
  );

  return {
    progress,
    ready,
    mode,
    modeLabel,
    isDemo: mode !== "cloud",
    recordAttempt,
  };
}
