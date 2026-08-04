"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/app/court/Court";
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
    <div className="min-h-screen p-6 flex flex-col items-center justify-center" style={{ background: C.bg, color: C.text }}>
      <div className="w-full max-w-lg">
        <p className="text-xs font-mono mb-2 text-center" style={{ color: C.dim, letterSpacing: "0.12em" }}>IMPORT PLAYBOOK</p>
        <h1 className="text-2xl font-bold text-center mb-2">Upload FastDraw PDF</h1>
        <p className="text-sm text-center mb-6" style={{ color: C.muted }}>
          Stage 1 extracts positions · Stage 2 reads arrows (optional)
        </p>

        {importerOk?.status !== "ok" && (
          <p className="text-sm text-center mb-4 px-3 py-2 rounded" style={{ color: C.bad, border: `1px solid ${C.bad}`, background: "#2a1515" }}>
            Importer not running. Start it: <code className="text-xs">uvicorn main:app --port 8000</code> in <code className="text-xs">services/importer</code>
          </p>
        )}

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors"
          style={{
            borderColor: dragOver ? C.ball : C.line,
            background: dragOver ? C.panel : C.panel2,
            opacity: working ? 0.6 : 1,
            pointerEvents: working ? "none" : "auto",
          }}
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
          <span className="text-4xl mb-3">📄</span>
          <span className="font-medium">Drop PDF here or click to browse</span>
          <span className="text-xs mt-2" style={{ color: C.muted }}>Max 25MB · FastDraw export</span>
        </label>

        <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer" style={{ color: C.muted }}>
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={working} />
          Read arrows with AI (uses API credits)
          {importerOk && !importerOk.anthropic_configured && useAi && (
            <span style={{ color: C.bad }}> — key missing</span>
          )}
        </label>

        {status && (
          <p className="text-sm mt-4 text-center animate-pulse" style={{ color: C.ball }}>{status}</p>
        )}
        {error && (
          <p className="text-sm mt-4 text-center px-3 py-2 rounded" style={{ color: C.bad, background: "#2a1515" }}>{error}</p>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-8 text-xs">
          <a href="/dev/review-demo" style={{ color: C.ball }}>Review demo (no AI)</a>
          <a href="/dev/import-preview" style={{ color: C.muted }}>Preview sample plays</a>
          <a href="/dev/ai-preview" style={{ color: C.muted }}>AI preview</a>
          <a href="/" style={{ color: C.muted }}>Horns Down demo</a>
        </div>
      </div>
    </div>
  );
}
