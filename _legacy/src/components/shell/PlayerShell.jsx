"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { isCoach, COACH_HOME } from "@/lib/auth";

const TABS = [
  { path: "/player/today", label: "Today" },
  { path: "/player/plays", label: "Plays" },
  { path: "/player/practice", label: "Practice" },
  { path: "/player/me", label: "Me" },
];

export default function PlayerShell({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "1";
  const { user, profile, configured } = useAuth();
  const coachPreview = preview && user && isCoach(profile, user);

  const tabHref = (path) => (preview ? `${path}?preview=1` : path);

  return (
    <div className="ps-app min-h-screen pb-[calc(56px+env(safe-area-inset-bottom))]">
      {coachPreview && (
        <div className="bg-jersey/10 border-b border-jersey/30 px-4 py-2 text-center text-xs">
          Coach preview mode.{" "}
          <Link href={COACH_HOME} className="text-chalk font-semibold">
            Back to coach dashboard
          </Link>
        </div>
      )}

      <header className="ps-app-bar shrink-0 sticky top-0 z-10">
        <Link href="/" className="font-display text-base font-bold tracking-tight text-ink">
          Playbook School
        </Link>
        <span className="flex-1" />
        {user ? (
          <Link href={tabHref("/player/me")} className="text-xs text-chalk">
            Account
          </Link>
        ) : configured ? (
          <Link href="/login" className="text-xs text-chalk font-semibold">
            Log in
          </Link>
        ) : (
          <Link href="/demo" className="text-xs text-chalk">
            Demo
          </Link>
        )}
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4">{children}</main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-rule bg-paper-2 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ path, label }) => {
          const href = tabHref(path);
          const active = pathname === path;
          return (
            <Link
              key={path}
              href={href}
              className={`flex-1 flex items-center justify-center min-h-[56px] text-xs font-semibold transition-colors duration-[120ms] ease-out ${
                active ? "text-jersey" : "text-ink-soft"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
