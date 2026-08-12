"""Legacy AI comparison + screener history for zero-length screens."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / "src/data/plays-interpreted.json").read_text())
leg = json.loads((ROOT / "_legacy/services/importer/interpreted.json").read_text())
leg_by = {(p["name"], b["id"]): b for p in leg["plays"] for b in p["beats"]}

CASES = [
    ("Alabama", "b4", "a2"),
    ("Arkansas-Rip", "b4", "a4"),
    ("Down", "b3", "a3"),
    ("Horns", "b3", "a3"),
    ("Idaho", "b2", "a2"),
    ("Kansas", "b3", "a3"),
    ("Kickup", "b3", "a2"),
    ("Relax*", "b3", "a2"),
]


def dist(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def screener_history(beats, bi, by):
    rows = []
    for j in range(max(0, bi - 2), bi + 1):
        b = beats[j]
        sp = b.get("startPos") or b["pos"]
        ep = b["pos"]
        move = dist(sp[by], ep[by])
        acts = [
            f"{a['id']}:{a['type']}"
            for a in b.get("actions", [])
            if str(a.get("by")) == by
        ]
        rows.append((b["id"], move, acts))
    return rows


for play_name, beat_id, action_id in CASES:
    play = next(p for p in raw if p["name"] == play_name)
    beats = play["beats"]
    bi = next(i for i, b in enumerate(beats) if b["id"] == beat_id)
    beat = beats[bi]
    action = next(a for a in beat["actions"] if a["id"] == action_id)
    by = str(action["by"])
    for_id = str(action.get("for", ""))

    leg_beat = leg_by.get((play_name, beat_id), {})
    leg_actions = leg_beat.get("actions", [])

    print(f"\n{'='*64}")
    print(f"{play_name} {beat_id} {action_id} — screen P{by} for P{for_id}")
    print("Legacy AI on THIS beat:", [(a["id"], a["type"], a.get("by"), a.get("for")) for a in leg_actions])
    print("Screener history (startPos->pos, actions):")
    for bid, move, acts in screener_history(beats, bi, by):
        print(f"  {bid}: {move:.1f}u  {acts or '(idle)'}")

    # Hypothesis: screen travel landed on prev beat
    if bi > 0:
        prev = beats[bi - 1]
        prev_move = dist(prev["startPos"][by], prev["pos"][by])
        prev_cut = any(
            a.get("type") == "cut" and str(a.get("by")) == by
            for a in prev.get("actions", [])
        )
        if prev_move > 60 and prev_cut:
            print(f"  >> LIKELY LATE: prev {prev['id']} cut P{by} moved {prev_move:.0f}u to screen spot")
        elif prev_move <= 1:
            print(f"  >> screener idle on N-1 — not a late-screen from travel")

    sp = beat["startPos"][by]
    tp = beat["pos"][for_id]
    print(
        f"  bar at screener ({sp['x']},{sp['y']}) oriented toward screened ({tp['x']},{tp['y']}) dist={dist(sp,tp):.0f}u"
    )
    crop = ROOT / "public" / "dev-repairs" / "crops" / f"{play_name.replace('*','')}_beat{beat_id[1:]}.png"
    print(f"  crop exists: {crop.exists()} ({crop.name})")
