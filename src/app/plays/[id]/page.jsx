"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { C } from "@/app/court/Court";
import PlayLab from "@/app/PlayLab";
import { loadPlayFromSession } from "@/lib/playModel";

export default function SavedPlayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [play, setPlay] = useState(null);

  useEffect(() => {
    if (!id) return;
    const loaded = loadPlayFromSession(id);
    setPlay(loaded);
  }, [id]);

  if (play === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>
        Loading…
      </div>
    );
  }

  if (!play) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: C.bg, color: C.text }}>
        <p>Play not found — it may have been cleared from this session.</p>
        <a href="/plays/new" className="text-sm px-4 py-2 rounded" style={{ color: C.ball, border: `1px solid ${C.line}` }}>
          Create a new play
        </a>
        <a href="/" className="text-sm" style={{ color: C.muted }}>
          ← Home
        </a>
      </div>
    );
  }

  return (
    <PlayLab
      initialPlay={play}
      onBack={() => router.push("/plays/new")}
    />
  );
}
