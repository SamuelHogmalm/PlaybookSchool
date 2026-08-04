import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="ps-app-bar">
        <Link href="/" className="font-display font-bold">Playbook School</Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-rule p-6 bg-paper">
          <h1 className="font-display text-2xl font-bold mb-1">Log in</h1>
          <p className="text-sm text-ink-soft mb-6">Auth coming soon — use demo links for now.</p>
          <form className="space-y-4" action="/coach/playbook">
            <div>
              <label className="ps-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="ps-input" />
            </div>
            <div>
              <label className="ps-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="ps-input" />
            </div>
            <button type="submit" className="ps-btn ps-btn-primary w-full">
              Log in
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-rule space-y-2">
            <Link href="/coach/playbook" className="ps-btn ps-btn-secondary w-full block text-center">
              Open coach demo
            </Link>
            <Link href="/player/today" className="ps-btn ps-btn-ghost w-full block text-center">
              Open player demo
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
