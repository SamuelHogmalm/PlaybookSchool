import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/config";

const PRODUCTION_HOST = "playlab-omega.vercel.app";

export async function middleware(request) {
  const host = request.nextUrl.hostname;

  // Preview deploy URLs (playlab-xxxx-....vercel.app) lack auth env — send users to production
  if (
    host.endsWith(".vercel.app") &&
    host !== PRODUCTION_HOST &&
    host.startsWith("playlab-")
  ) {
    const url = request.nextUrl.clone();
    url.hostname = PRODUCTION_HOST;
    url.protocol = "https";
    return NextResponse.redirect(url);
  }

  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session — required so auth cookies work across page loads on Vercel
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
