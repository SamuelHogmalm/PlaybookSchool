"use client";

import Link from "next/link";
import importedPlays from "@/data/plays.json";
import { normalizeImportedPlay } from "@/lib/normalizePlay";
import { CourtFrameView } from "@/app/court/Court";

const alabama = normalizeImportedPlay(importedPlays.find((p) => p.name === "Alabama"));
const samplePlays = [
  alabama,
  { name: "Horns", beats: 3 },
  { name: "Kickup", beats: 3 },
  { name: "Kentucky", beats: 3 },
  { name: "Flare", beats: 4 },
  { name: "Spain", beats: 3 },
];

function Swatch({ name, token, text = "dark" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="h-10 w-full border border-rule" style={{ background: `var(${token})` }} />
      <span className="font-data text-[10px] text-ink-soft">{name}</span>
    </div>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <section className={`mb-8 ${className}`}>
      <h2 className="font-display text-lg font-bold text-ink mb-2 tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <div className="ps-app">
      <header className="ps-app-bar shrink-0">
        <span className="font-display text-base font-bold tracking-tight">Playbook School</span>
        <span className="text-ink-soft">·</span>
        <span className="text-ink-soft">Design system</span>
        <span className="flex-1" />
        <Link href="/" className="text-chalk hover:underline underline-offset-2">
          App
        </Link>
        <Link href="/dev/review-demo" className="text-ink-soft hover:text-ink">
          Review demo
        </Link>
      </header>

      <main className="ps-app-main">
        {/* Workbench density preview — how the coach app should feel */}
        <Section title="Workbench density (target layout)">
          <div className="border border-rule bg-paper">
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-rule bg-paper-2">
              <div className="flex items-baseline gap-3 min-w-0">
                <h3 className="font-display text-xl font-bold truncate">{alabama.name}</h3>
                <span className="font-data text-xs text-ink-soft shrink-0">
                  Set · {alabama.frames.length} beats
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="ps-btn ps-btn-secondary py-0 min-h-[36px] text-xs">
                  Edit
                </button>
                <button type="button" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
                  Assign
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_280px] gap-0">
              <div className="border-b lg:border-b-0 lg:border-r border-rule p-3">
                <div className="ps-court-frame border border-rule max-w-2xl mx-auto">
                  <CourtFrameView
                    frame={alabama.frames[0]}
                    prev={null}
                    suffix="-sg-workbench"
                    maxWidthClass="max-w-full"
                    showGhost={false}
                    showActions={false}
                  />
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-ink-soft">
                  <span className="font-data">◀ ● ● ○ ▶</span>
                  <span className="font-data">beat 2 of 4</span>
                  <span className="font-data">1x</span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  5 steps up and sets the ball screen.
                </p>
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-data text-[10px] uppercase tracking-widest text-ink-soft">
                    All plays
                  </span>
                  <button type="button" className="ps-btn ps-btn-ghost py-0 min-h-[32px] text-xs px-2">
                    + New
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {samplePlays.slice(0, 6).map((p) => (
                    <button key={p.name} type="button" className="ps-play-card">
                      <div className="ps-court-frame">
                        {p.frames ? (
                          <CourtFrameView
                            frame={p.frames[0]}
                            prev={null}
                            suffix={`-wb-${p.name}`}
                            maxWidthClass="max-w-full"
                            showGhost={false}
                            showActions={false}
                          />
                        ) : (
                          <div className="aspect-[500/470] bg-court" />
                        )}
                      </div>
                      <div className="px-1 py-1 border-t border-rule">
                        <p className="font-display text-xs font-semibold leading-none truncate">{p.name}</p>
                        <p className="font-data text-[10px] text-ink-soft">
                          {p.frames?.length ?? p.beats}b
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-ink-soft mt-2">
            Full-width tool layout — court + play grid on one screen, no marketing hero spacing.
          </p>
        </Section>

        <div className="grid xl:grid-cols-2 gap-x-8 gap-y-0">
          <Section title="Palette">
            <p className="text-xs text-ink-soft mb-3">
              Shaded stat-sheet paper. <strong className="text-ink">Court</strong> stays the only dark block.
            </p>
            <div className="grid grid-cols-5 gap-2">
              <Swatch name="Paper" token="--paper" />
              <Swatch name="Paper 2" token="--paper-2" />
              <Swatch name="Rule" token="--rule" />
              <Swatch name="Court" token="--court" text="light" />
              <Swatch name="Jersey" token="--jersey" text="light" />
              <Swatch name="Chalk" token="--chalk" text="light" />
              <Swatch name="Go" token="--go" text="light" />
              <Swatch name="Flag" token="--flag" text="light" />
              <Swatch name="Ink" token="--ink" text="light" />
              <Swatch name="Ink soft" token="--ink-soft" />
            </div>
          </Section>

          <Section title="Typography">
            <div className="space-y-4">
              <div>
                <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">Display</p>
                <p className="font-display text-2xl font-bold">Horns Flare</p>
                <p className="font-display text-lg font-semibold mt-0.5">Team readiness 68%</p>
              </div>
              <div>
                <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">
                  Body · 15px tool / 16px coach
                </p>
                <p className="text-sm max-w-md">
                  Assign plays due Friday. Players drill on their phones between classes.
                </p>
              </div>
              <div>
                <p className="font-data text-[10px] uppercase tracking-widest text-ink-soft mb-1">Data</p>
                <p className="font-data text-sm">#23 · 12/36 · 87% · JXN-4829</p>
              </div>
            </div>
          </Section>

          <Section title="Buttons & states">
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className="ps-btn ps-btn-primary">Assign</button>
              <button type="button" className="ps-btn ps-btn-secondary">Print</button>
              <button type="button" className="ps-btn ps-btn-ghost">Cancel</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center min-h-[32px] px-2 text-xs font-semibold text-go border border-go">
                Mastered
              </span>
              <span className="inline-flex items-center min-h-[32px] px-2 text-xs font-semibold text-flag border border-flag">
                Needs review
              </span>
            </div>
          </Section>

          <Section title="Form fields">
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="ps-label" htmlFor="sg-play-name">Play name</label>
                <input id="sg-play-name" className="ps-input" defaultValue="Alabama" />
              </div>
              <div>
                <label className="ps-label" htmlFor="sg-category">Category</label>
                <select id="sg-category" className="ps-input">
                  <option>Set</option>
                  <option>Transition</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Roster table" className="xl:col-span-2">
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
                  <tr>
                    <td className="font-data">23</td>
                    <td>Marcus Chen</td>
                    <td className="font-data">PG</td>
                    <td className="text-ink-soft">Today</td>
                    <td className="font-data">12/36</td>
                    <td className="font-data text-go">5d</td>
                  </tr>
                  <tr>
                    <td className="font-data">11</td>
                    <td>Jordan Ellis</td>
                    <td className="font-data">SF</td>
                    <td className="text-ink-soft">Yesterday</td>
                    <td className="font-data">8/36</td>
                    <td className="font-data">2d</td>
                  </tr>
                  <tr>
                    <td className="font-data">44</td>
                    <td>Tyler Brooks</td>
                    <td className="font-data">C</td>
                    <td className="text-ink-soft">3d ago</td>
                    <td className="font-data text-flag">4/36</td>
                    <td className="font-data">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Stat sheet pattern">
            <div className="border border-rule max-w-lg">
              <table className="ps-table mb-0">
                <tbody>
                  <tr>
                    <td className="font-data w-10 text-ink-soft">01</td>
                    <td>Coaches re-teach the same plays every season</td>
                  </tr>
                  <tr>
                    <td className="font-data text-ink-soft">02</td>
                    <td>Transfers and freshmen fall behind</td>
                  </tr>
                  <tr>
                    <td className="font-data text-ink-soft">03</td>
                    <td>A PDF in a group chat is not teaching</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Play cards">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {samplePlays.map((p) => (
                <button key={p.name} type="button" className="ps-play-card">
                  <div className="ps-court-frame">
                    {p.frames ? (
                      <CourtFrameView
                        frame={p.frames[0]}
                        prev={null}
                        suffix={`-sg-${p.name}`}
                        maxWidthClass="max-w-full"
                        showGhost={false}
                        showActions={false}
                      />
                    ) : (
                      <div className="aspect-[500/470] bg-court" />
                    )}
                  </div>
                  <div className="px-1 py-1 border-t border-rule">
                    <p className="font-display text-xs font-semibold truncate">{p.name}</p>
                    <p className="font-data text-[10px] text-ink-soft">
                      {(p.frames?.length ?? p.beats)}b
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
