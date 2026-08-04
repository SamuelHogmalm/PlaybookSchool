import { COACH_ASSIGNMENTS } from "@/data/mockTeam";

export default function CoachAssignmentsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-rule bg-paper-2 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Assignments</h1>
        <button type="button" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
          New assignment
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {COACH_ASSIGNMENTS.map((a) => (
          <article key={a.id} className="border border-rule p-4 bg-paper">
            <div className="flex justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display text-lg font-semibold">{a.title}</h2>
                <p className="text-sm text-ink-soft mt-0.5">
                  {a.target} · Due {a.due}
                </p>
              </div>
              <div className="text-right">
                <p className="font-data text-lg font-medium">
                  {a.done}/{a.total}
                </p>
                <div className="w-24 h-1.5 bg-rule mt-1 ml-auto">
                  <div
                    className="h-full bg-jersey"
                    style={{ width: `${(a.done / a.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
