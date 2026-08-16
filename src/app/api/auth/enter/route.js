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

  // Land somewhere you can actually do your job. This used to send everyone to "/"
  // because the coach and player routes were quarantined in _legacy/ — which made a
  // successful login look exactly like a failed one.
  const home = role === "coach" ? "/coach/review" : "/player/quiz";
  return NextResponse.redirect(new URL(home, request.url));
}
