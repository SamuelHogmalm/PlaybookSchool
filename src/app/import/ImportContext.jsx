"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ImportContext = createContext(null);
const SESSION_STORAGE_KEY = "ps-import-session";

function readStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (typeof window === "undefined") return;
  try {
    if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* quota — in-memory session still works */
  }
}

export function ImportProvider({ children }) {
  const [session, setSessionState] = useState(null);

  const setSession = useCallback((next) => {
    setSessionState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      writeStoredSession(resolved);
      return resolved;
    });
  }, []);

  const clearSession = useCallback(() => {
    writeStoredSession(null);
    setSessionState(null);
  }, []);

  // Restore PDF crops + plays after refresh during review.
  useEffect(() => {
    const stored = readStoredSession();
    if (stored?.plays?.length) setSessionState(stored);
  }, []);

  const value = useMemo(
    () => ({
      session,
      setSession,
      clearSession,
    }),
    [session, setSession, clearSession]
  );

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

export function useImportSession() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImportSession must be used within ImportProvider");
  return ctx;
}
