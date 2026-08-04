import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

/** Server Supabase client for App Router route handlers / server components. */
export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* set from Server Component — middleware will refresh session */
        }
      },
    },
  });
}
