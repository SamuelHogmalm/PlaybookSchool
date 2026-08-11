import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Server-side post-login redirect — reads auth cookies, routes by role. */
export async function GET(request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let role = user.user_metadata?.role ?? "player";

  const { data: synced } = await supabase.rpc("sync_profile_from_auth");
  if (synced?.role) role = synced.role;
  else {
    const { data: prof } = await supabase.rpc("get_my_profile");
    if (prof?.role) role = prof.role;
  }

  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("/auth")) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Coach/player apps quarantined in _legacy/ during rebuild — land on home after login.
  return NextResponse.redirect(new URL("/", request.url));
}
