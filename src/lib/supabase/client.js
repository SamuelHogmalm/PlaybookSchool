import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

let client;

/** Browser Supabase client (singleton). */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
