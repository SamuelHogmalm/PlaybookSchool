"use client";

import { createContext, useContext, useMemo, useState } from "react";

const ImportContext = createContext(null);

export function ImportProvider({ children }) {
  const [session, setSession] = useState(null);

  const value = useMemo(
    () => ({
      session,
      setSession,
      clearSession: () => setSession(null),
    }),
    [session]
  );

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

export function useImportSession() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImportSession must be used within ImportProvider");
  return ctx;
}
