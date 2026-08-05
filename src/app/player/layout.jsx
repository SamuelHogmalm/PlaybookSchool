import { Suspense } from "react";
import PlayerShell from "@/components/shell/PlayerShell";
import PlayerCoachRedirect from "@/components/auth/PlayerCoachRedirect";

export default function PlayerLayout({ children }) {
  return (
    <PlayerShell>
      <Suspense fallback={null}>
        <PlayerCoachRedirect />
      </Suspense>
      {children}
    </PlayerShell>
  );
}
