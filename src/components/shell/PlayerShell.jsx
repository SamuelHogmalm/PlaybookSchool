"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/player/today", label: "Today" },
  { href: "/player/plays", label: "Plays" },
  { href: "/player/practice", label: "Practice" },
  { href: "/player/me", label: "Me" },
];

export default function PlayerShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="ps-app min-h-screen pb-[calc(56px+env(safe-area-inset-bottom))]">
      <header className="ps-app-bar shrink-0 sticky top-0 z-10">
        <Link href="/" className="font-display text-base font-bold tracking-tight text-ink">
          Playbook School
        </Link>
        <span className="flex-1" />
        <Link href="/demo" className="text-xs text-chalk">
          Demo
        </Link>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4">{children}</main>

      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-rule bg-paper-2 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
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
