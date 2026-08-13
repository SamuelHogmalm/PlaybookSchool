import { createClient } from "@/lib/supabase/server";
import { validatePlay } from "@/lib/play/validation";
import type { Play } from "@/lib/play/types";

type PlayRow = {
  id: string;
  team_id: string;
  name: string;
  category: string;
  folder_id: string | null;
  beats: Play["beats"];
  version: number;
  valid: boolean;
  validation_errors: string[];
  created_at: string;
  updated_at: string;
};

function rowToPlay(row: PlayRow): Play {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    category: row.category,
    folderId: row.folder_id ?? undefined,
    beats: row.beats,
    version: row.version,
    valid: row.valid,
    validationErrors: row.validation_errors ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type Ctx =
  | { ok: false; response: Response }
  | {
      ok: true;
      supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
      teamId: string;
      role: string;
    };

/** Resolve the caller's team. Coach-only writes are enforced again by RLS. */
async function requireProfile(): Promise<Ctx> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false,
      response: Response.json({ error: "Supabase not configured" }, { status: 503 }),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.team_id) {
    return {
      ok: false,
      response: Response.json(
        { error: "No team yet — create or join a team first." },
        { status: 409 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    teamId: profile.team_id as string,
    role: (profile.role as string) ?? "player",
  };
}

export async function GET() {
  const ctx = await requireProfile();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.supabase
    .from("plays")
    .select("*")
    .eq("team_id", ctx.teamId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[api/plays] list failed", {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ plays: (data as PlayRow[]).map(rowToPlay) });
}

/**
 * Save a play. Validation runs here, server-side: MASTER-BUILD-PLAN.md says never
 * save an invalid play, and a check that only runs in the builder is not that
 * guarantee — the importer posts here too.
 */
export async function POST(request: Request) {
  const ctx = await requireProfile();
  if (!ctx.ok) return ctx.response;

  if (ctx.role !== "coach") {
    return Response.json({ error: "Coach account required" }, { status: 403 });
  }

  let incoming: Play;
  try {
    incoming = (await request.json()) as Play;
  } catch {
    return Response.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  if (!incoming?.id || !incoming?.name?.trim() || !Array.isArray(incoming.beats)) {
    return Response.json(
      { error: "Play needs an id, a name, and beats." },
      { status: 400 },
    );
  }

  const play: Play = { ...incoming, teamId: ctx.teamId };
  const result = validatePlay(play);

  if (!result.valid) {
    return Response.json(
      {
        error: "Play does not validate — fix these before saving.",
        validationErrors: result.errors,
        warnings: result.warnings,
      },
      { status: 422 },
    );
  }

  // Bump version on edit so Phase 8 can requeue players who mastered the old one.
  const { data: existing } = await ctx.supabase
    .from("plays")
    .select("version")
    .eq("id", play.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const row = {
    id: play.id,
    team_id: ctx.teamId,
    name: play.name.trim(),
    category: play.category || "Set",
    folder_id: play.folderId ?? null,
    beats: play.beats,
    version: existing ? existing.version + 1 : 1,
    valid: true,
    validation_errors: [],
    updated_at: now,
    ...(existing ? {} : { created_at: now }),
  };

  const { data, error } = await ctx.supabase
    .from("plays")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    // The response carries only `message`; code and hint are what actually distinguish
    // "migration never applied" from "RLS refused this row", so log the whole thing.
    console.error("[api/plays] upsert failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      teamId: ctx.teamId,
      playId: play.id,
    });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    { play: rowToPlay(data as PlayRow), warnings: result.warnings },
    { status: existing ? 200 : 201 },
  );
}
