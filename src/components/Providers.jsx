"use client";

import { AuthProvider } from "@/contexts/AuthProvider";

export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
