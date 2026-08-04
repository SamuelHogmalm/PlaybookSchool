import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/config";

let client;
let clientPromise;

/** Sync client — local dev when NEXT_PUBLIC is in .env.local at dev start. */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;
  if (!client) {
    client = createBrowserClient(url, anonKey);
  }
  return client;
}

/** Prefer this in the browser — loads config from /api/supabase-config at runtime. */
export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") return Promise.resolve(createClient());

  if (!clientPromise) {
    clientPromise = fetch("/api/supabase-config")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !data.url || !data.anonKey) {
          throw new Error(data.status ?? "Supabase not configured on server");
        }
        if (!client) {
          client = createBrowserClient(data.url, data.anonKey);
        }
        return client;
      });
  }

  return clientPromise;
}

export function resetSupabaseClient() {
  client = null;
  clientPromise = null;
}
