"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { homePathForUser } from "@/lib/teams";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setWorking(true);
    setError("");

    const { error: err, profile, user } = await signIn(email, password);
    setWorking(false);

    if (err) {
      setError(err.message ?? String(err));
      return;
    }

    const dest = next && next.startsWith("/") ? next : homePathForUser(profile, user);
    // Full navigation avoids race with auth state + client router
    window.location.assign(dest);
  };

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="ps-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="ps-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="ps-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="ps-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-flag">{error}</p>}
        <button
          type="submit"
          disabled={working || loading}
          className="ps-btn ps-btn-primary w-full disabled:opacity-50"
        >
          {working ? "Signing in…" : "Log in"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="ps-app-bar">
        <Link href="/" className="font-display font-bold">
          Playbook School
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-rule p-6 bg-paper">
          <h1 className="font-display text-2xl font-bold mb-1">Log in</h1>
          <p className="text-sm text-ink-soft mb-6">
            Coaches go to the playbook. Players go to today&apos;s quiz.
          </p>

          <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
            <LoginForm />
          </Suspense>

          <p className="text-xs text-ink-soft mt-4 text-center">
            No account? <Link href="/signup" className="text-chalk">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
