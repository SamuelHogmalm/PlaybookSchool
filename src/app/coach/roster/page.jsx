import { ROSTER, TEAM } from "@/data/mockTeam";

export default function CoachRosterPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">Roster</h1>
          <p className="text-xs text-ink-soft mt-0.5">{ROSTER.length} players</p>
        </div>
        <div className="text-right">
          <p className="font-data text-lg font-medium">{TEAM.joinCode}</p>
          <button type="button" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs mt-1">
            Copy invite
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="border border-rule overflow-x-auto">
          <table className="ps-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Pos</th>
                <th scope="col">Last active</th>
                <th scope="col">Mastered</th>
                <th scope="col">Streak</th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map((p) => (
                <tr key={p.id}>
                  <td className="font-data">{p.jersey}</td>
                  <td>{p.name}</td>
                  <td className="font-data">{p.position}</td>
                  <td className="text-ink-soft">{p.lastActive}</td>
                  <td className="font-data">
                    {p.mastered}/{p.total}
                  </td>
                  <td className={`font-data ${p.streak > 0 ? "text-go" : "text-ink-soft"}`}>
                    {p.streak > 0 ? `${p.streak}d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
