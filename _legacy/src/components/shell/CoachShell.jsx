"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { TEAM as DEMO_TEAM } from "@/data/mockTeam";

const NAV = [
  { href: "/coach/playbook", label: "Playbook" },
  { href: "/coach/roster", label: "Roster" },
  { href: "/coach/assignments", label: "Assignments" },
  { href: "/coach/progress", label: "Progress" },
  { href: "/import", label: "Import" },
];

export default function CoachShell({ children }) {
  const pathname = usePathname();
  const { user, profile, team, signOut, configured } = useAuth();

  const teamName = team?.name ?? (configured && user ? "Setting up team…" : DEMO_TEAM.name);
  const joinCode = team?.join_code ?? (configured && user ? "…" : DEMO_TEAM.joinCode);

  return (
    <div className="ps-app min-h-screen">
      <div className="flex flex-1 min-h-screen">
        <aside className="w-52 shrink-0 border-r border-rule bg-paper flex flex-col">
          <div className="px-3 py-3 border-b border-rule">
            <Link href="/" className="font-display text-lg font-bold tracking-tight text-ink hover:text-jersey">
              Playbook School
            </Link>
            <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mt-0.5">Coach</p>
          </div>

          <nav className="flex-1 py-2">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block px-3 py-2.5 text-sm font-semibold min-h-[44px] flex items-center border-l-2 transition-[background-color,border-color] duration-[120ms] ease-out ${
                    active
                      ? "border-jersey bg-paper-2 text-ink"
                      : "border-transparent text-ink-soft hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-3 border-t border-rule mt-auto">
            <p className="text-xs text-ink-soft truncate">{teamName}</p>
            <p className="font-data text-sm font-medium mt-1">{joinCode}</p>
            <p className="font-data text-[10px] text-ink-soft mt-0.5">Join code</p>
            {user ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="block mt-3 text-xs font-semibold text-ink-soft hover:text-ink"
              >
                Sign out
              </button>
            ) : null}
            <Link
              href="/player/today?preview=1"
              className="block mt-2 text-xs font-semibold text-chalk hover:underline"
            >
              Player preview →
            </Link>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
    </div>
  );
}
