"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { AUTH_ENTER } from "@/lib/auth";

function LoginForm() {
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

    const { error: err } = await signIn(email, password);
    if (err) {
      setWorking(false);
      setError(err.message ?? String(err));
      return;
    }

    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    window.location.assign(`${AUTH_ENTER}${q}`);
  };

  return (
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
            Coaches → playbook. Players → today&apos;s quiz.
          </p>

          <Suspense fallback={<p className="text-sm text-ink-soft">Loading…</p>}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 pt-4 border-t border-rule">
            <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">
              Test accounts
            </p>
            <p className="text-xs text-ink-soft leading-relaxed">
              Coach: <span className="font-data">coach@test.playbookschool.dev</span> /{" "}
              <span className="font-data">TestCoach123!</span>
            </p>
          </div>

          <p className="text-xs text-ink-soft mt-4 text-center">
            No account? <Link href="/signup" className="text-chalk">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
