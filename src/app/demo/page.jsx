"use client";

import Link from "next/link";
import PlayLab from "@/app/PlayLab";
import { heroPlay } from "@/lib/plays";

export default function DemoPage() {
  return (
    <>
      <div className="fixed top-2 left-2 z-[100] flex gap-2">
        <Link
          href="/"
          className="font-body text-xs font-semibold px-2 py-1.5 min-h-[36px] inline-flex items-center bg-paper text-ink border border-rule hover:bg-paper-2"
        >
          ← Home
        </Link>
        <Link
          href="/coach/playbook"
          className="font-body text-xs font-semibold px-2 py-1.5 min-h-[36px] inline-flex items-center bg-paper text-chalk border border-rule hover:bg-paper-2"
        >
          Coach app
        </Link>
        <Link
          href="/player/today"
          className="font-body text-xs font-semibold px-2 py-1.5 min-h-[36px] inline-flex items-center bg-paper text-ink-soft border border-rule hover:bg-paper-2"
        >
          Player app
        </Link>
      </div>
      <PlayLab initialPlay={heroPlay} />
    </>
  );
}
