"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enrichPlayFromImport } from "@/lib/enrichReview";
import PlayReview from "@/app/play/PlayReview";
import { exportForPromotion, downloadJson } from "@/lib/verifyPlays";
import { useImportSession } from "../ImportContext";

export default function ImportReviewListPage() {
  const router = useRouter();
  const { session, setSession } = useImportSession();
  const [selected, setSelected] = useState(null);
  const [verified, setVerified] = useState({});
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.plays?.length) router.replace("/import");
  }, [session, router]);

  const plays = useMemo(() => {
    const enriched = (session?.plays ?? []).map(enrichPlayFromImport);
    const flagged = new Set(
      session?.needsReview?.map((r) => r.play ?? r.play_name ?? r.playName) ?? [],
    );
    return enriched.sort((a, b) => {
      const aFlag = flagged.has(a.name) ? 0 : 1;
      const bFlag = flagged.has(b.name) ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return a.name.localeCompare(b.name);
    });
  }, [session]);

  const allVerified = plays.length > 0 && plays.every((p) => verified[p.name]);

  async function savePlaybook() {
    setSaving(true);
    setSaveMsg("");
    try {
      const payload = exportForPromotion(plays);
      const breakdowns = {};
      for (const p of plays) {
        if (p.breakdown && !p.breakdownStale) {
          breakdowns[p.name] = p.breakdown;
        }
      }
      downloadJson("plays-interpreted.json", payload);
      if (Object.keys(breakdowns).length) {
        downloadJson("plays-breakdowns.json", breakdowns);
      }
      const res = await fetch("/api/playbook/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plays: payload, breakdowns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaveMsg(
        `Saved ${data.playCount} plays to src/data/plays-interpreted.json` +
          (breakdowns ? " + plays-breakdowns.json" : "") +
          ". Reload /coach/playbook to see updates.",
      );
    } catch (e) {
      setSaveMsg(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!session?.plays?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  if (selected != null) {
    const play = plays[selected];
    return (
      <PlayReview
        play={{ ...play, verified: !!verified[play.name] }}
        crops={session.crops}
        backLabel="← All plays"
        onBack={() => setSelected(null)}
        onPlayChange={(updated) => {
          setSession((s) => ({
            ...s,
            plays: s.plays.map((p) => (p.name === updated.name ? updated : p)),
          }));
        }}
        onVerified={() => setVerified((v) => ({ ...v, [play.name]: true }))}
        showCropCompare={Object.keys(session.crops ?? {}).length > 0}
        theme="paper"
      />
    );
  }

  const verifiedCount = Object.values(verified).filter(Boolean).length;
  const reviewCount = session.needsReview?.length ?? 0;
  const cropCount = Object.keys(session.crops ?? {}).length;
  const cropWarning = session.meta?.crop_warning;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-0.5">Review queue</p>
        <h1 className="font-display text-xl font-bold truncate">{session.filename}</h1>
        <p className="text-sm text-ink-soft mt-1">
          {plays.length} plays · {session.meta?.beat_count} beats
          {cropCount > 0 && <> · {cropCount} PDF crops</>}
          {session.aiUsed && session.usage && (
            <> · AI tokens {session.usage.input_tokens + session.usage.output_tokens}</>
          )}
          {reviewCount > 0 && <span className="text-flag"> · {reviewCount} beats flagged</span>}
        </p>
        {cropWarning && (
          <p className="text-sm text-flag mt-2 px-3 py-2 border border-flag bg-paper">
            {cropWarning} PDF comparison is disabled until Poppler (pdftoppm) is installed on the importer.
          </p>
        )}
        {!cropWarning && cropCount === 0 && (
          <p className="text-sm text-flag mt-2 px-3 py-2 border border-flag bg-paper">
            No PDF frame crops in this session — the side-by-side comparison will not appear.
          </p>
        )}
        <p className="font-data text-xs text-go mt-2">{verifiedCount} of {plays.length} verified</p>
        <Link href="/import" className="text-xs text-chalk mt-2 inline-block hover:underline">← Import another</Link>
      </header>

      <ul className="flex-1 overflow-auto p-4 max-w-3xl w-full mx-auto flex flex-col gap-2">
        {plays.map((p, i) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => setSelected(i)}
              className="w-full text-left border border-rule px-4 py-3 flex items-center justify-between gap-3 bg-paper hover:bg-paper-2 transition-colors duration-[120ms]"
            >
              <div>
                <span className="font-display font-semibold">{p.name}</span>
                <span className="font-data text-xs ml-2 text-ink-soft">{p.frames.length} beats</span>
              </div>
              <span className={`text-xs shrink-0 font-data ${verified[p.name] ? "text-go" : "text-ink-soft"}`}>
                {verified[p.name] ? "✓ verified" : "Review →"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-center max-w-md mx-auto p-4 text-ink-soft">
        Fix animation flags inline, verify each play, then save to the coach playbook JSON.
      </p>

      <div className="border-t border-rule px-4 py-4 max-w-3xl w-full mx-auto flex flex-col gap-2">
        <button
          type="button"
          disabled={!allVerified || saving}
          onClick={savePlaybook}
          className="ps-btn ps-btn-primary w-full disabled:opacity-50"
        >
          {saving ? "Saving…" : allVerified ? "Save to coach playbook" : `Verify all plays first (${Object.values(verified).filter(Boolean).length}/${plays.length})`}
        </button>
        {saveMsg && (
          <p className={`text-xs text-center ${saveMsg.startsWith("Saved") ? "text-go" : "text-flag"}`}>
            {saveMsg}
          </p>
        )}
        <p className="text-[10px] text-center text-ink-soft font-data">
          Writes src/data/plays-interpreted.json locally (dev). Also downloads a backup copy.
        </p>
      </div>
    </div>
  );
}
