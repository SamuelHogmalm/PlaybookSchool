import { createClient } from "@/lib/supabase/server";

/**
 * Who the server thinks you are.
 *
 * Exists because "coach account required" is unactionable on its own: the commonest
 * causes are being signed in as a second test account or a role that is not exactly
 * "coach", and neither is visible from inside the app. Never errors — not being signed
 * in is an answer, not a failure.
 */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ configured: false, signedIn: false });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ configured: true, signedIn: false });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  return Response.json({
    configured: true,
    signedIn: true,
    email: user.email ?? null,
    role: profile?.role ?? null,
    teamId: profile?.team_id ?? null,
    canSavePlays: profile?.role === "coach" && Boolean(profile?.team_id),
  });
}
