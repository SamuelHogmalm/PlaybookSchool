import { FORGOTTEN_PLAYS, TEAM_READINESS } from "@/data/mockTeam";

export default function CoachProgressPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2">
        <h1 className="font-display text-xl font-bold">Progress</h1>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-6 max-w-3xl">
        <section>
          <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">
            Team readiness
          </p>
          <p className="font-display text-5xl font-bold">{TEAM_READINESS}%</p>
          <p className="text-xs text-ink-soft mt-1">
            Assignments completed, weighted by mastery per play.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold mb-3">Most forgotten plays</h2>
          <div className="border border-rule">
            <table className="ps-table mb-0">
              <thead>
                <tr>
                  <th scope="col">Play</th>
                  <th scope="col">Miss rate</th>
                </tr>
              </thead>
              <tbody>
                {FORGOTTEN_PLAYS.map((p) => (
                  <tr key={p.name}>
                    <td className="font-display font-semibold">{p.name}</td>
                    <td className="font-data text-flag">{p.missRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
