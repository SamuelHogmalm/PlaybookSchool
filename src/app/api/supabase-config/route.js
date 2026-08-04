import { isSupabaseConfigured, supabaseConfigStatus, supabaseEnv } from "@/lib/supabase/config";

/** Runtime Supabase config — reads env on the server (always fresh after Vercel redeploy). */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: false,
      status: supabaseConfigStatus(),
    });
  }

  const { url, anonKey } = supabaseEnv();
  return Response.json({
    ok: true,
    url,
    anonKey,
    status: "ok",
  });
}
