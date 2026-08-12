#!/usr/bin/env python3
"""Compare zero-travel screen flags between v1 seed and v2 interpret."""

from __future__ import annotations

import json
import copy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

from derive import TRANSFERS, finalize_beats, migrate_legacy_ball_field  # noqa: E402
from parser import parse  # noqa: E402

V1 = ROOT / "src" / "data" / "plays-interpreted.json"
V2 = ROOT / "src" / "data" / "plays-interpreted-v2.json"
LEGACY = ROOT / "_legacy" / "services" / "importer" / "interpreted.json"
REASON = "Screen has no movement"


def zero_travel_in_file(path: Path) -> list[dict]:
    plays = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for play in plays:
        for beat in play.get("beats") or []:
            for action in beat.get("actions") or []:
                if REASON in str(action.get("reason") or ""):
                    out.append(
                        {
                            "play": play["name"],
                            "beat": beat["id"],
                            "action": action.get("id"),
                            "by": str(action.get("by")),
                            "for": str(action.get("for") or ""),
                            "type": action.get("type"),
                            "derived": bool(action.get("derived")),
                        }
                    )
    return out


def legacy_ai_actions() -> dict[tuple[str, str], list[dict]]:
    legacy = json.loads(LEGACY.read_text(encoding="utf-8"))["plays"]
    out: dict[tuple[str, str], list[dict]] = {}
    for play in legacy:
        for beat in play.get("beats") or []:
            key = (play["name"], beat["id"])
            out[key] = [
                {"id": a.get("id"), "type": a.get("type"), "by": str(a.get("by")), "for": str(a.get("for") or "")}
                for a in beat.get("actions") or []
            ]
    return out


def v2_ai_raw_actions() -> dict[tuple[str, str], list[dict]]:
    """Re-run interpret output: strip derived/inserted from v2 file."""
    plays = json.loads(V2.read_text(encoding="utf-8"))
    out: dict[tuple[str, str], list[dict]] = {}
    for play in plays:
        for beat in play.get("beats") or []:
            actions = []
            for a in beat.get("actions") or []:
                if a.get("derived"):
                    continue
                if a.get("type") in TRANSFERS and str(a.get("reason") or "").startswith("Inserted pass"):
                    continue
                actions.append(
                    {"id": a.get("id"), "type": a.get("type"), "by": str(a.get("by")), "for": str(a.get("for") or "")}
                )
            out[(play["name"], beat["id"])] = actions
    return out


def fresh_zero_travel_from_ai(ai_plays: list[dict]) -> list[dict]:
    """Run derive on AI-only plays and return zero-travel flags."""
    plays = copy.deepcopy(ai_plays)
    flagged = []
    for play in plays:
        beats = play["beats"]
        for beat in beats:
            migrate_legacy_ball_field([beat])
            beat["actions"] = [a for a in beat.get("actions") or [] if not a.get("derived")]
            beat.pop("ball", None)
        summary = finalize_beats(beats)
        for item in summary["zero_travel_flagged"]:
            item = dict(item)
            item["play"] = play["name"]
            flagged.append(item)
    return flagged


def build_legacy_plays_with_parser() -> list[dict]:
    parser = {p["name"]: p for p in parse(str(Path(r"C:\Users\samue\Downloads\2024-25 plays.pdf")))}
    legacy = json.loads(LEGACY.read_text(encoding="utf-8"))["plays"]
    out = []
    for lp in legacy:
        pp = parser[lp["name"]]
        pb = {b["id"]: b for b in pp["beats"]}
        beats = []
        for ib in lp["beats"]:
            pbeat = pb[ib["id"]]
            beats.append(
                {
                    "id": ib["id"],
                    "startPos": pbeat.get("startPos") or pbeat.get("pos") or {},
                    "pos": pbeat.get("pos") or {},
                    "startBall": pbeat.get("startBall") or "1",
                    "actions": list(ib.get("actions") or []),
                }
            )
        out.append({"name": lp["name"], "beats": beats})
    return out


def main() -> None:
    v1_zt = zero_travel_in_file(V1)
    v2_zt = zero_travel_in_file(V2)
    v1_keys = {(x["play"], x["beat"], x["by"], x["for"]) for x in v1_zt}
    v2_keys = {(x["play"], x["beat"], x["by"], x["for"]) for x in v2_zt}

    overlap = v1_keys & v2_keys
    v2_only = v2_keys - v1_keys
    v1_only = v1_keys - v2_keys

    print("=== Zero-travel screen comparison (v1 seed file vs v2 file) ===\n")
    print(f"v1 flagged: {len(v1_zt)}")
    for x in v1_zt:
        print(f"  {x['play']} {x['beat']} P{x['by']} for P{x['for']} ({x['action']})")
    print(f"\nv2 flagged: {len(v2_zt)}")
    for x in v2_zt:
        print(f"  {x['play']} {x['beat']} P{x['by']} for P{x['for']} ({x['action']})")

    print(f"\nSame beat+player: {len(overlap)} overlap")
    for k in sorted(overlap):
        print(f"  {k[0]} {k[1]} P{k[2]} for P{k[3]}")
    print(f"v2-only: {len(v2_only)}")
    print(f"v1-only: {len(v1_only)}")

    legacy_ai = legacy_ai_actions()
    v2_ai = v2_ai_raw_actions()

    print("\n=== v2-only zero-travel beats: v1 AI read vs v2 AI read ===\n")
    beats_seen = set()
    for play, beat, by, for_ in sorted(v2_only):
        if (play, beat) in beats_seen:
            continue
        beats_seen.add((play, beat))
        v1acts = legacy_ai.get((play, beat), [])
        v2acts = v2_ai.get((play, beat), [])
        v1_types = [f"P{a['by']}:{a['type']}" + (f"->{a['for']}" if a.get('for') else "") for a in v1acts]
        v2_types = [f"P{a['by']}:{a['type']}" + (f"->{a['for']}" if a.get('for') else "") for a in v2acts]
        v1_screens = {a["by"] for a in v1acts if a["type"] == "screen"}
        v2_screens = {a["by"] for a in v2acts if a["type"] == "screen"}
        v1_cuts = {a["by"] for a in v1acts if a["type"] == "cut"}
        v2_cuts = {a["by"] for a in v2acts if a["type"] == "cut"}
        new_screens = v2_screens - v1_screens
        cut_to_screen = v1_cuts & v2_screens
        invented = new_screens - v1_cuts - v1_screens
        print(f"{play} {beat}:")
        print(f"  v1 AI: {v1_types or '(none)'}")
        print(f"  v2 AI: {v2_types or '(none)'}")
        if cut_to_screen:
            print(f"  -> cut-to-screen reclass: P{','.join(sorted(cut_to_screen))}")
        elif new_screens <= v1_cuts:
            print(f"  -> likely cut-to-screen on P{','.join(sorted(new_screens & v1_cuts))}")
        elif invented:
            print(f"  -> new screen(s) not in v1 read: P{','.join(sorted(invented))}")
        else:
            print("  -> screen existed in v1 but had travel (not zero-travel there)")

    # Fresh pipeline comparison on raw AI
    legacy_plays = build_legacy_plays_with_parser()
    v2_plays = json.loads(V2.read_text(encoding="utf-8"))
    for play in v2_plays:
        for beat in play.get("beats") or []:
            beat["actions"] = [
                a
                for a in beat.get("actions") or []
                if not a.get("derived")
                and not (
                    a.get("type") in TRANSFERS
                    and str(a.get("reason") or "").startswith("Inserted pass")
                )
            ]

    leg_zt = fresh_zero_travel_from_ai(legacy_plays)
    v2_fresh_zt = fresh_zero_travel_from_ai(v2_plays)
    print(f"\n=== Fresh derive zero-travel (legacy AI vs v2 AI stripped) ===")
    print(f"legacy AI -> {len(leg_zt)} zero-travel")
    print(f"v2 AI     -> {len(v2_fresh_zt)} zero-travel")


if __name__ == "__main__":
    main()
