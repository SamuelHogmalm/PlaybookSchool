"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkImporterHealth, interpretPlays, parsePdf } from "@/lib/importerApi";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { useImportSession } from "./ImportContext";

export default function ImportPage() {
  const router = useRouter();
  const { setSession } = useImportSession();
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [importerOk, setImporterOk] = useState(null);

  useEffect(() => {
    checkImporterHealth()
      .then((h) => setImporterOk(h))
      .catch(() => setImporterOk({ status: "down", anthropic_configured: false }));
  }, []);

  const runImport = useCallback(
    async (file) => {
      if (!file?.name?.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a FastDraw PDF.");
        return;
      }
      setWorking(true);
      setError("");
      try {
        const parsed = await parsePdf(file, setStatus);
        let plays = parsed.plays;
        let crops = parsed.crops ?? {};
        let usage = null;
        let needsReview = [];

        if (useAi) {
          if (!importerOk?.anthropic_configured) {
            setError("AI not configured on importer — uncheck “Read arrows” or add ANTHROPIC_API_KEY to services/importer/.env");
            setWorking(false);
            return;
          }
          const interpreted = await interpretPlays(plays, crops, setStatus);
          plays = interpreted.plays;
          usage = interpreted.usage;
          needsReview = interpreted.needs_review ?? [];
        }

        const normalized = plays.map(normalizeImportedPlay);
        setSession({
          filename: file.name,
          plays: normalized,
          crops,
          meta: parsed.meta,
          usage,
          needsReview,
          aiUsed: useAi,
        });
        router.push("/import/review");
      } catch (e) {
        setError(e.message ?? "Import failed");
        setStatus("");
      } finally {
        setWorking(false);
      }
    },
    [useAi, importerOk, router, setSession]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runImport(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-0.5">Import</p>
        <h1 className="font-display text-xl font-bold">Upload FastDraw PDF</h1>
        <p className="text-sm text-ink-soft mt-1">
          Stage 1 extracts positions · Stage 2 reads arrows (optional)
        </p>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {importerOk?.status !== "ok" && (
            <p className="text-sm text-center mb-4 px-3 py-2 border border-flag text-flag bg-paper">
              Importer not running. Start:{" "}
              <code className="font-data text-xs">uvicorn main:app --port 8000</code> in{" "}
              <code className="font-data text-xs">services/importer</code>
            </p>
          )}

          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed px-6 py-14 cursor-pointer transition-colors ${
              dragOver ? "border-jersey bg-paper-2" : "border-rule bg-paper"
            } ${working ? "opacity-60 pointer-events-none" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={working}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runImport(f);
              }}
            />
            <span className="font-display text-2xl font-bold mb-2">PDF</span>
            <span className="font-semibold text-sm">Drop PDF here or click to browse</span>
            <span className="font-data text-xs mt-2 text-ink-soft">Max 25MB · FastDraw export</span>
          </label>

          <label className="flex items-center gap-2 mt-4 text-sm text-ink-soft cursor-pointer">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={working} />
            Read arrows with AI (uses API credits)
            {importerOk && !importerOk.anthropic_configured && useAi && (
              <span className="text-flag"> — key missing</span>
            )}
          </label>

          {status && <p className="text-sm mt-4 text-center text-jersey animate-pulse">{status}</p>}
          {error && (
            <p className="text-sm mt-4 text-center px-3 py-2 border border-flag text-flag">{error}</p>
          )}

          <div className="flex flex-wrap justify-center gap-4 mt-8 text-xs text-ink-soft">
            <Link href="/dev/review-demo" className="text-chalk hover:underline">Review demo</Link>
            <Link href="/coach/playbook" className="hover:text-ink">Playbook</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
