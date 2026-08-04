import { createClient } from "@supabase/supabase-js";
import { seedTestUsers } from "@/lib/seedTestUsers";

/**
 * One-time POST to create test coach + player in production Supabase.
 * Requires Vercel env: SUPABASE_SERVICE_ROLE_KEY, SEED_SECRET (server-only).
 *
 * curl -X POST https://YOUR_APP.vercel.app/api/admin/seed-test-users \
 *   -H "Authorization: Bearer YOUR_SEED_SECRET"
 */
export async function POST(request) {
  const secret = process.env.SEED_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!secret || token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return Response.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const result = await seedTestUsers(admin);
    return Response.json(result);
  } catch (err) {
    console.error("seed-test-users:", err);
    return Response.json(
      { error: err.message ?? "Seed failed", hint: "Run team onboarding migration in Supabase SQL Editor" },
      { status: 500 }
    );
  }
}
