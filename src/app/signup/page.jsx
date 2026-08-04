import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="ps-app-bar">
        <Link href="/" className="font-display font-bold">Playbook School</Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-rule p-6 bg-paper">
          <h1 className="font-display text-2xl font-bold mb-1">Create account</h1>
          <p className="text-sm text-ink-soft mb-6">
            Send us your playbook PDF — free pilot for this season. Auth coming soon.
          </p>
          <form className="space-y-4" action="/coach/playbook">
            <div>
              <label className="ps-label" htmlFor="team">Team name</label>
              <input id="team" className="ps-input" placeholder="West Valley Eagles" />
            </div>
            <div>
              <label className="ps-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="ps-input" placeholder="coach@school.edu" />
            </div>
            <div>
              <label className="ps-label" htmlFor="role">I am a</label>
              <select id="role" className="ps-input">
                <option>Coach</option>
                <option>Player</option>
              </select>
            </div>
            <button type="submit" className="ps-btn ps-btn-primary w-full">
              Continue to app
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
