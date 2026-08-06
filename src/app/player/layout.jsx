import { Suspense } from "react";
import PlayerShell from "@/components/shell/PlayerShell";
import PlayerCoachRedirect from "@/components/auth/PlayerCoachRedirect";

export default function PlayerLayout({ children }) {
  return (
    <>
      <Suspense fallback={null}>
        <PlayerCoachRedirect />
      </Suspense>
      <Suspense
        fallback={
          <div className="ps-app min-h-screen flex items-center justify-center">
            <p className="text-sm text-ink-soft">Loading…</p>
          </div>
        }
      >
        <PlayerShell>{children}</PlayerShell>
      </Suspense>
    </>
  );
}
