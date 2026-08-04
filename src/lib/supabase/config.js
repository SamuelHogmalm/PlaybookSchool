/** Strip quotes / whitespace from env values pasted into Vercel or .env.local */

function cleanEnv(value) {
  if (value == null) return "";
  let v = String(value).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Accept full URL or bare project ref (hkvnzffvwqenuuyxjtnx). */
export function normalizeSupabaseUrl(raw) {
  let url = cleanEnv(raw);
  if (!url) return "";

  if (!url.includes(".") && /^[a-z0-9-]+$/i.test(url)) {
    url = `https://${url}.supabase.co`;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeAnonKey(raw) {
  const key = cleanEnv(raw);
  if (!key) return "";
  // Legacy JWT anon key or newer publishable key
  if (key.startsWith("eyJ") || key.startsWith("sb_publishable_")) return key;
  return "";
}

export function supabaseEnv() {
  return {
    url: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: normalizeAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = supabaseEnv();
  return !!(url && anonKey);
}

/** Safe hint for debugging misconfigured deploys (no secrets). */
export function supabaseConfigStatus() {
  const rawUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const rawKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { url, anonKey } = supabaseEnv();

  if (!rawUrl && !rawKey) return "missing";
  if (!url) return "bad-url";
  if (!anonKey) return "bad-key";
  return "ok";
}
