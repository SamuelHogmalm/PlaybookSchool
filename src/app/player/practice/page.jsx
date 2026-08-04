"use client";

import { useState, useEffect } from "react";
import PlayerQuizSession from "@/components/player/PlayerQuizSession";
import { allPlays, heroPlay } from "@/lib/plays";
import { CURRENT_PLAYER } from "@/data/mockTeam";

const POS_MAP = { PG: "1", SG: "2", SF: "3", PF: "4", C: "5" };

export default function PlayerPracticePage() {
  const [play, setPlay] = useState(heroPlay);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ps-practice-play");
      if (raw) {
        const { name } = JSON.parse(raw);
        const found = allPlays.find((p) => p.name === name);
        if (found) setPlay(found);
        sessionStorage.removeItem("ps-practice-play");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const myId = POS_MAP[CURRENT_PLAYER.position] ?? "4";

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Practice</h1>
      <p className="text-sm text-ink-soft mb-4">Spot, draw, and watch questions for your role.</p>

      <div className="mb-4">
        <label className="ps-label" htmlFor="practice-play">Play</label>
        <select
          id="practice-play"
          className="ps-input"
          value={play.name}
          onChange={(e) => {
            const found = allPlays.find((p) => p.name === e.target.value);
            if (found) {
              setPlay(found);
              setSessionKey((k) => k + 1);
            }
          }}
        >
          {allPlays.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <PlayerQuizSession key={`${play.name}-${sessionKey}`} play={play} myId={myId} />
    </div>
  );
}
