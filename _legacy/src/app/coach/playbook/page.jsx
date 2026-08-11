"use client";

import PlaybookWorkbench from "@/components/coach/PlaybookWorkbench";
import { allPlays, heroPlay } from "@/lib/plays";

export default function CoachPlaybookPage() {
  return <PlaybookWorkbench plays={allPlays} initialPlay={heroPlay} />;
}
