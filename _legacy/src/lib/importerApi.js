const BASE = process.env.NEXT_PUBLIC_IMPORTER_URL ?? "http://localhost:8000";

export async function checkImporterHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error("Importer service unavailable");
  return res.json();
}

export async function parsePdf(file, onStatus) {
  onStatus?.("Reading PDF — extracting player positions…");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/parse`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail?.message ?? data?.detail ?? "Parse failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  if (data.meta?.crop_warning) onStatus?.(data.meta.crop_warning);
  return data;
}

export async function interpretPlays(plays, crops, onStatus) {
  onStatus?.("Reading arrows and writing beat notes with AI…");
  const res = await fetch(`${BASE}/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plays, crops }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail?.message ?? data?.detail ?? "Interpret failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  onStatus?.(`Done — ${data.needs_review?.length ?? 0} beats flagged for review`);
  return data;
}

export async function breakdownPlays(plays, crops, playNames, onStatus) {
  onStatus?.("Building play-level breakdown with AI…");
  const res = await fetch(`${BASE}/breakdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plays, crops, play_names: playNames ?? null }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail?.message ?? data?.detail ?? "Breakdown failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  onStatus?.(`Breakdown done — ${Object.keys(data.breakdowns ?? {}).length} plays`);
  return data;
}
