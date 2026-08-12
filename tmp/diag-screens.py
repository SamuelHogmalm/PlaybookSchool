"""Diagnose 8 zero-length screen actions."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT / "src/data/plays-interpreted.json").read_text())

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


def cross_beat_move(prev_pos, cur_start, pid):
    a, b = prev_pos.get(pid), cur_start.get(pid)
    if not a or not b:
        return None
    return dist(a, b)


def within_beat(start_pos, pos, pid):
    a, b = start_pos.get(pid), pos.get(pid)
    if not a or not b:
        return None
    return dist(a, b)


for play_name, beat_id, action_id in CASES:
    play = next(p for p in raw if p["name"] == play_name)
    beats = play["beats"]
    bi = next(i for i, b in enumerate(beats) if b["id"] == beat_id)
    beat = beats[bi]
    prev = beats[bi - 1] if bi > 0 else None
    action = next(a for a in beat["actions"] if a["id"] == action_id)

    by = str(action["by"])
    for_id = str(action.get("for", ""))
    sp = beat.get("startPos") or beat["pos"]
    ep = beat["pos"]
    prev_pos = prev["pos"] if prev else None
    prev_sp = (prev.get("startPos") or prev["pos"]) if prev else None

    wb = within_beat(sp, ep, by)
    cb = cross_beat_move(prev_pos, sp, by) if prev else None
    prev_wb = within_beat(prev_sp, prev_pos, by) if prev else None

    prev_actions = []
    if prev:
        for a in prev.get("actions") or []:
            if str(a.get("by")) == by and a.get("type") in ("cut", "dribble", "screen"):
                prev_actions.append(f"{a['id']}:{a['type']}")

    crop = f"/dev-repairs/crops/{play_name.replace('*','')}_beat{beat_id[1:]}.png"
    crop_alt = f"/dev-repairs/crops/{play_name}_beat{beat_id[1:]}.png"

    print(f"\n{'='*60}")
    print(f"{play_name} {beat_id} {action_id}: screen P{by} for P{for_id}")
    print(f"  within-beat screener travel: {wb:.1f}u" if wb is not None else "  within-beat: n/a")
    print(f"  cross-beat prev.pos -> startPos: {cb:.1f}u" if cb is not None else "  cross-beat: n/a (beat 1)")
    if prev_wb is not None:
        print(f"  prev beat within-beat screener travel: {prev_wb:.1f}u")
    print(f"  prev beat screener actions: {prev_actions or 'none'}")
    print(f"  screener startPos: ({sp[by]['x']}, {sp[by]['y']})")
    print(f"  screener pos:      ({ep[by]['x']}, {ep[by]['y']})")
    if for_id:
        print(f"  screened player pos: ({ep[for_id]['x']}, {ep[for_id]['y']})")
    if prev:
        print(f"  prev.pos screener:   ({prev_pos[by]['x']}, {prev_pos[by]['y']})")
        landed = dist(prev_pos[by], sp[by]) < 1
        print(f"  prev.pos == this.startPos: {landed}")
    print(f"  crop paths: {crop} | {crop_alt}")
    print(f"  action path: {action.get('path')}")
