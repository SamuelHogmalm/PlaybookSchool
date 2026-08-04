import { CURRENT_PLAYER, PLAYER_MASTERY } from "@/data/mockTeam";

export default function PlayerMePage() {
  const weakest = [...PLAYER_MASTERY].sort((a, b) => a.pct - b.pct).slice(0, 3);

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">{CURRENT_PLAYER.name}</h1>
      <p className="font-data text-sm text-ink-soft mb-6">
        #{CURRENT_PLAYER.jersey} · {CURRENT_PLAYER.position}
      </p>

      <section className="mb-6">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">Mastery</p>
        <div className="space-y-2">
          {PLAYER_MASTERY.map((m) => (
            <div key={m.play}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="font-display font-semibold">{m.play}</span>
                <span className="font-data text-ink-soft">{m.pct}%</span>
              </div>
              <div className="h-1.5 bg-rule">
                <div
                  className={`h-full ${m.status === "mastered" ? "bg-go" : "bg-chalk"}`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-soft mt-0.5">
                {m.status === "mastered" ? "Mastered" : "Still learning"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">
          Focus next
        </p>
        <ul className="border border-rule divide-y divide-rule">
          {weakest.map((m) => (
            <li key={m.play} className="px-3 py-2 text-sm flex justify-between">
              <span>{m.play}</span>
              <span className="font-data text-ink-soft">{m.pct}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-2">Streak</p>
        <p className="font-display text-3xl font-bold">{CURRENT_PLAYER.streak} days</p>
      </section>
    </div>
  );
}
