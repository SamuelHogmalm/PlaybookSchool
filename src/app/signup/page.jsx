"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import { supabaseConfigStatus } from "@/lib/supabase/config";

export default function SignupPage() {
  const router = useRouter();
  const { signUp, configured, loading } = useAuth();
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("player");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const configStatus = supabaseConfigStatus();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!configured) {
      router.push("/coach/playbook");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    const { error: err } = await signUp({
      email,
      password,
      fullName: team || email.split("@")[0],
      role,
    });
    setWorking(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage("Check your email to confirm, then log in.");
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="ps-app-bar">
        <Link href="/" className="font-display font-bold">
          Playbook School
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-rule p-6 bg-paper">
          <h1 className="font-display text-2xl font-bold mb-1">Create account</h1>
          <p className="text-sm text-ink-soft mb-6">
            {configured
              ? "Free pilot — quiz progress syncs when you sign in."
              : configStatus === "bad-url"
                ? "Supabase URL looks wrong in env vars — use https://hkvnzffvwqenuuyxjtnx.supabase.co"
                : configStatus === "bad-key"
                  ? "Supabase anon key looks wrong — use the JWT key from Dashboard → API."
                  : "Supabase not configured — add env vars and redeploy."}
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="ps-label" htmlFor="team">
                Name / team
              </label>
              <input
                id="team"
                className="ps-input"
                placeholder="West Valley Eagles"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>
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
                required={configured}
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={configured}
              />
            </div>
            <div>
              <label className="ps-label" htmlFor="role">
                I am a
              </label>
              <select
                id="role"
                className="ps-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="coach">Coach</option>
                <option value="player">Player</option>
              </select>
            </div>
            {error && <p className="text-sm text-flag">{error}</p>}
            {message && <p className="text-sm text-go">{message}</p>}
            <button
              type="submit"
              disabled={working || loading}
              className="ps-btn ps-btn-primary w-full disabled:opacity-50"
            >
              {working ? "Creating…" : configured ? "Create account" : "Continue demo"}
            </button>
          </form>

          <p className="text-xs text-ink-soft mt-4 text-center">
            Already have an account? <Link href="/login" className="text-chalk">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
