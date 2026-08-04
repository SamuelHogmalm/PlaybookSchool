"use client";

import Link from "next/link";
import AutoPlayCourt from "@/components/court/AutoPlayCourt";
import PlayerQuizSession from "@/components/player/PlayerQuizSession";
import { heroPlay } from "@/lib/plays";

function StatRow({ n, children }) {
  return (
    <tr>
      <td className="font-data w-12 text-ink-soft px-3 py-2.5 border-b border-rule">{n}</td>
      <td className="px-3 py-2.5 border-b border-rule text-sm">{children}</td>
    </tr>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper-2/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-4">
          <Link href="/" className="font-display text-lg font-bold tracking-tight">
            Playbook School
          </Link>
          <nav className="hidden sm:flex gap-4 text-sm text-ink-soft ml-4">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#mission" className="hover:text-ink">Mission</a>
            <a href="#about" className="hover:text-ink">About</a>
          </nav>
          <span className="flex-1" />
          <Link href="/login" className="text-sm font-semibold text-ink-soft hover:text-ink">
            Log in
          </Link>
          <Link href="/player/today" className="text-sm font-semibold text-chalk hover:underline hidden sm:inline">
            Player app
          </Link>
          <Link href="/signup" className="ps-btn ps-btn-primary py-0 min-h-[36px] text-xs">
            Create account
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              Your players forget the playbook. This fixes that.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-ink-soft max-w-lg leading-relaxed">
              Upload your playbook. Every player gets a tutor that drills them on their assignment until they know it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="ps-btn ps-btn-primary">
                Send us your playbook
              </Link>
              <a href="#how" className="ps-btn ps-btn-secondary">
                See how it works
              </a>
              <Link href="/demo" className="ps-btn ps-btn-ghost">
                Try demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              Free pilot for the rest of this season — we load your PDF for you.
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <AutoPlayCourt play={heroPlay} className="max-w-lg mx-auto lg:ml-auto" />
            <p className="font-display text-center lg:text-right text-lg font-semibold mt-3">{heroPlay.name}</p>
            <p className="font-data text-center lg:text-right text-xs text-ink-soft">Live play animation</p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-rule bg-paper-2 py-10">
        <div className="max-w-2xl mx-auto px-4">
          <table className="w-full border border-rule bg-paper">
            <tbody>
              <StatRow n="01">Coaches re-teach the same plays every season</StatRow>
              <StatRow n="02">Transfers and freshmen fall behind before the first scrimmage</StatRow>
              <StatRow n="03">A PDF in a group chat is not teaching</StatRow>
            </tbody>
          </table>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="font-display text-2xl font-bold mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Import your playbook",
              body: "Send us your FastDraw PDF. We load every play — you don't redraw anything.",
              href: "/import",
              cta: "Import flow",
            },
            {
              step: "02",
              title: "Assign what to study",
              body: "Pick plays, a folder, or the review queue. Whole team, guards, or one player. Done in 30 seconds.",
              href: "/coach/assignments",
              cta: "Coach view",
            },
            {
              step: "03",
              title: "Players drill on their phones",
              body: "Animations, quizzes, and draw-the-route questions — generated from your actual plays.",
              href: "/player/today",
              cta: "Player view",
            },
          ].map((s) => (
            <article key={s.step} className="border border-rule p-4 bg-paper flex flex-col">
              <p className="font-data text-xs text-jersey mb-2">{s.step}</p>
              <h3 className="font-display text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-ink-soft flex-1">{s.body}</p>
              <Link href={s.href} className="text-sm font-semibold text-chalk mt-4 hover:underline">
                {s.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* What players see — quiz demo */}
      <section className="border-t border-rule bg-paper-2 py-14">
        <div className="max-w-lg mx-auto px-4">
          <h2 className="font-display text-2xl font-bold mb-2 text-center">What players see</h2>
          <p className="text-sm text-ink-soft text-center mb-6">
            Draw-the-route questions — no competitor does this. The quiz writes itself from your play.
          </p>
          <div className="border border-rule bg-paper p-4 max-h-[520px] overflow-auto">
            <PlayerQuizSession play={heroPlay} myId="1" />
          </div>
        </div>
      </section>

      {/* FastDraw */}
      <section className="max-w-3xl mx-auto px-4 py-14 text-center">
        <h2 className="font-display text-xl font-bold mb-3">Already have a playbook?</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          We import your existing PDF. You don&apos;t redraw anything. You can still print play cards.
          Your drawing program stays your drawing program — we turn it into something players actually learn from.
        </p>
      </section>

      {/* Mission */}
      <section id="mission" className="border-t border-rule py-14">
        <div className="max-w-3xl mx-auto px-4">
          <p className="font-data text-xs uppercase tracking-widest text-jersey mb-2">Our mission</p>
          <h2 className="font-display text-3xl font-bold mb-6 leading-tight">
            Every player deserves a personal coach — anytime, anywhere.
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-ink-soft leading-relaxed">
            <p>
              Every season, coaches spend countless hours teaching the same plays, and players spend countless hours trying to memorize them. Too often, valuable practice time is spent reviewing what could have been learned before stepping onto the court.
            </p>
            <p className="text-ink font-medium">
              Our mission is to change that.
            </p>
            <p>
              We&apos;re building a platform that transforms traditional playbooks into interactive, personalized learning experiences. By combining AI with proven learning methods, we help athletes understand, remember, and execute their team&apos;s system with confidence — including players who struggle with learning differences, memory, or the pressure of picking up a new system mid-season.
            </p>
            <p>
              We believe every player should have a personal coach available anytime, anywhere. Every coach should spend less time repeating instructions and more time developing their team. And every team should enter game day knowing they&apos;re fully prepared.
            </p>
            <p>
              Our goal isn&apos;t to replace coaches — it&apos;s to give them a powerful tool that helps players learn faster, retain more, and perform better when it matters most.
            </p>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-rule bg-paper-2 py-14">
        <div className="max-w-3xl mx-auto px-4">
          <p className="font-data text-xs uppercase tracking-widest text-chalk mb-2">About us</p>
          <h2 className="font-display text-2xl font-bold mb-4">Built by a player who&apos;s been there</h2>
          <div className="space-y-4 text-sm sm:text-base text-ink-soft leading-relaxed">
            <p>
              Playbook School was created by a college basketball player from Sweden who experienced firsthand how difficult it can be to learn and retain a team&apos;s playbook. Whether you&apos;re a freshman, a transfer, or joining a new program, learning dozens of plays under pressure can be overwhelming.
            </p>
            <p>
              After seeing teammates struggle — some with learning difficulties, some who simply couldn&apos;t keep plays straight on the bus ride home — and watching coaches spend valuable practice time reteaching the same concepts, the idea for Playbook School was born.
            </p>
            <p>
              We set out to build more than another playbook app. Our vision is an intelligent learning platform that helps athletes master their team&apos;s system through interactive lessons, animations, quizzes, AI tutoring, and personalized daily practice.
            </p>
            <p className="text-ink font-medium">
              Today, we&apos;re building the future of playbook learning so coaches can coach, players can learn with confidence, and teams can perform at their best.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-rule py-14">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold mb-3">Ready for game day?</h2>
          <p className="text-sm text-ink-soft mb-6">
            Free for the rest of this season. Send your playbook PDF — we load it for you.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup" className="ps-btn ps-btn-primary">
              Create account
            </Link>
            <Link href="/demo" className="ps-btn ps-btn-secondary">
              Try the demo
            </Link>
            <Link href="/coach/playbook" className="ps-btn ps-btn-ghost">
              Coach app
            </Link>
            <Link href="/player/today" className="ps-btn ps-btn-ghost">
              Player app
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule py-6 text-center text-xs text-ink-soft">
        Playbook School · Built in Sweden · © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
