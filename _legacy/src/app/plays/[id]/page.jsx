"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PlayDrawEditor from "@/app/play/PlayDrawEditor";
import { loadPlayFromSession, savePlayToSession } from "@/lib/playModel";

export default function SavedPlayPage() {
  const params = useParams();
  const id = params?.id;
  const [play, setPlay] = useState(null);

  useEffect(() => {
    if (!id) return;
    setPlay(loadPlayFromSession(id));
  }, [id]);

  const handleSave = () => {
    if (play) savePlayToSession(play);
  };

  if (play === null) {
    return <div className="flex-1 flex items-center justify-center text-ink-soft">Loading…</div>;
  }

  if (!play) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-ink-soft">Play not found — session may have cleared.</p>
        <Link href="/plays/new" className="ps-btn ps-btn-primary">Create a new play</Link>
        <Link href="/coach/playbook" className="text-sm text-chalk">← Playbook</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-rule bg-paper-2 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/coach/playbook" className="ps-btn ps-btn-ghost py-0 min-h-[36px] text-xs shrink-0">
            ← Playbook
          </Link>
          <h1 className="font-display text-xl font-bold truncate">{play.name}</h1>
        </div>
        <button type="button" onClick={handleSave} className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
          Save
        </button>
      </header>
      <div className="flex-1 overflow-auto p-4 max-w-6xl mx-auto w-full">
        <PlayDrawEditor play={play} setPlay={setPlay} theme="paper" />
      </div>
    </div>
  );
}
