"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { allPlays, heroPlay } from "@/lib/plays";
import { generateFlashcardDeck, QUIZ_CATEGORIES, CATEGORY_ORDER, POS_NAME } from "@/lib/quiz";
import PlayerQuizSession from "@/components/player/PlayerQuizSession";

export default function QuizDevPage() {
  const [playName, setPlayName] = useState(heroPlay.name);
  const [myId, setMyId] = useState("1");
  const [live, setLive] = useState(false);

  const play = allPlays.find((p) => p.name === playName) ?? heroPlay;
  const { deck, buckets, available } = useMemo(
    () => generateFlashcardDeck(play, myId, { maxCards: 12 }),
    [play, myId]
  );

  return (
    <div className="min-h-screen bg-paper text-ink p-4 max-w-lg mx-auto">
      <header className="mb-4">
        <Link href="/coach/playbook" className="text-sm text-chalk">← Playbook</Link>
        <h1 className="font-display text-xl font-bold mt-2">Flashcard preview</h1>
      </header>

      <div className="grid gap-3 mb-4">
        <select className="ps-input" value={playName} onChange={(e) => setPlayName(e.target.value)}>
          {allPlays.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-1 flex-wrap">
          {["1", "2", "3", "4", "5"].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMyId(id)}
              className={`font-data px-3 py-2 border min-h-[44px] text-sm ${myId === id ? "border-jersey text-jersey" : "border-rule"}`}
            >
              {id} {POS_NAME[id]}
            </button>
          ))}
        </div>
      </div>

      {!live ? (
        <div className="border border-rule mb-4">
          <div className="px-3 py-2 bg-paper-2 border-b border-rule flex justify-between">
            <span className="font-data text-xs uppercase text-ink-soft">{deck.length} cards</span>
            <button type="button" className="text-xs text-chalk" onClick={() => setLive(true)}>Try live</button>
          </div>
          <ul className="divide-y divide-rule text-sm">
            {CATEGORY_ORDER.map((cat) => (
              <li key={cat} className="px-3 py-2">
                <span className="font-data text-[10px] uppercase text-jersey">{QUIZ_CATEGORIES[cat].short}</span>
                <span className="ml-2 text-ink-soft">({buckets[cat]?.length ?? 0} available)</span>
                {available.includes(cat) && buckets[cat]?.[0] && (
                  <p className="text-xs mt-0.5">{buckets[cat][0].prompt}</p>
                )}
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-rule text-sm border-t border-rule">
            {deck.map((q) => (
              <li key={q.id} className="px-3 py-2">
                <span className="font-data text-[10px] uppercase text-jersey mr-2">{QUIZ_CATEGORIES[q.category]?.short}</span>
                {q.prompt}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <PlayerQuizSession play={play} myId={myId} maxQuestions={10} />
      )}
    </div>
  );
}
