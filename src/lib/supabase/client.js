import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/config";

let client;

/** Browser Supabase client (singleton). */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;

  if (!client) {
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
