import { createClient } from "@/lib/supabase/server";

/**
 * Remove a play from the team's playbook.
 *
 * Coach-only, and RLS enforces the same rule again at the database — the check here is
 * for a useful error message, not for security.
 *
 * A hard delete rather than a flag: an unwanted import is clutter, not history. Player
 * progress lives in `attempts` and `mastery` keyed by play id, so those rows outlive the
 * play and a re-import under the same id picks its history back up.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.team_id) {
    return Response.json({ error: "No team yet." }, { status: 409 });
  }
  if (profile.role !== "coach") {
    return Response.json(
      { error: `Coach account required — this account's role is "${profile.role}".` },
      { status: 403 },
    );
  }

  const { error, count } = await supabase
    .from("plays")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("team_id", profile.team_id);

  if (error) {
    console.error("[api/plays] delete failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
      playId: id,
    });
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!count) {
    return Response.json(
      { error: "No such play in your team's playbook." },
      { status: 404 },
    );
  }

  return Response.json({ deleted: id });
}
