#!/usr/bin/env python3
"""Rebuild plays-interpreted.json: parser startPos/pos + legacy AI actions + derive pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

from derive import TRANSFERS, finalize_beats, migrate_legacy_ball_field  # noqa: E402
from parser import parse  # noqa: E402

PDF_PATH = Path(r"C:\Users\samue\Downloads\2024-25 plays.pdf")
PARSER_JSON = ROOT / "_legacy" / "src" / "data" / "plays.json"
LEGACY_INTERPRETED = ROOT / "_legacy" / "services" / "importer" / "interpreted.json"
OUT_JSON = ROOT / "src" / "data" / "plays-interpreted.json"


def strip_derived_actions(beat: dict) -> None:
    """Remove prior derive artifacts so finalize is idempotent."""
    cleaned = []
    for action in beat.get("actions") or []:
        if action.get("derived"):
            continue
        if action.get("needsReview") and action.get("type") in TRANSFERS:
            continue
        cleaned.append(action)
    beat["actions"] = cleaned


def load_parser_plays() -> list[dict]:
    if PDF_PATH.is_file():
        return parse(str(PDF_PATH))
    return json.loads(PARSER_JSON.read_text(encoding="utf-8"))


def merge_play(parser_play: dict, legacy_play: dict) -> dict:
    parser_beats = {b["id"]: b for b in parser_play.get("beats", [])}
    out_beats = []
    for ib in legacy_play.get("beats", []):
        pb = parser_beats.get(ib["id"], {})
        beat = {
            "id": ib["id"],
            "startPos": pb.get("startPos") or pb.get("pos") or ib.get("startPos") or ib.get("pos") or {},
            "pos": pb.get("pos") or ib.get("pos") or {},
            "startBall": pb.get("startBall") or pb.get("ball") or ib.get("startBall") or ib.get("ball") or "1",
            "actions": list(ib.get("actions") or []),
        }
        strip_derived_actions(beat)
        if ib.get("note"):
            beat["note"] = ib["note"]
        if ib.get("alignment"):
            beat["alignment"] = ib["alignment"]
        out_beats.append(beat)
    return {
        "name": legacy_play["name"],
        "category": legacy_play.get("category") or parser_play.get("category") or "Set",
        "beats": out_beats,
    }


def export_beat(beat: dict) -> dict:
    out = {
        "id": beat["id"],
        "startPos": beat.get("startPos") or beat.get("pos") or {},
        "pos": beat["pos"],
        "startBall": beat["startBall"],
        "ball": beat["ball"],
        "actions": beat.get("actions") or [],
    }
    if beat.get("note"):
        out["note"] = beat["note"]
    if beat.get("alignment"):
        out["alignment"] = beat["alignment"]
    return out


def main() -> None:
    parser_plays = load_parser_plays()
    legacy_plays = json.loads(LEGACY_INTERPRETED.read_text(encoding="utf-8"))["plays"]
    parser_by_name = {p["name"]: p for p in parser_plays}
    legacy_by_name = {p["name"]: p for p in legacy_plays}

    all_repairs: list[dict] = []
    all_derived: list[dict] = []
    all_needs_review: list[dict] = []
    action_stats: list[dict] = []
    rebuilt = []

    for lp in legacy_plays:
        name = lp["name"]
        pp = parser_by_name.get(name)
        if not pp:
            print(f"WARN: no parser data for {name}", file=sys.stderr)
            continue
        play = merge_play(pp, lp)
        for beat in play["beats"]:
            migrate_legacy_ball_field([beat])
        actions_before = sum(len(b.get("actions") or []) for b in play["beats"])
        summary = finalize_beats(play["beats"])
        actions_after = summary["actions_after"]
        derived_count = summary["derived_remaining"]
        action_stats.append(
            {
                "play": play["name"],
                "before": actions_before,
                "after": actions_after,
                "derived": derived_count,
                "dropped_short": len(summary["short_dropped"]),
                "snapped": len(summary["jitter_snapped"]),
            }
        )
        ball_repairs = summary["ball_repairs"]
        if ball_repairs:
            all_repairs.append({"play": play["name"], "repairs": ball_repairs})
        for item in summary["movement_derived"]:
            item["play"] = play["name"]
            all_derived.append(item)
        for beat in play["beats"]:
            for action in beat.get("actions") or []:
                if action.get("needsReview"):
                    all_needs_review.append(
                        {
                            "play": play["name"],
                            "beat": beat["id"],
                            "action": action.get("id"),
                            "type": action.get("type"),
                            "by": action.get("by"),
                            "for": action.get("for"),
                            "reason": action.get("reason"),
                        }
                    )
        rebuilt.append(
            {
                "name": play["name"],
                "category": play["category"],
                "beats": [export_beat(b) for b in play["beats"]],
            }
        )

    OUT_JSON.write_text(json.dumps(rebuilt, indent=1) + "\n", encoding="utf-8")

    print("=== Rebuild complete ===")
    print(f"Wrote {len(rebuilt)} plays to {OUT_JSON}")

    total_before = sum(s["before"] for s in action_stats)
    total_after = sum(s["after"] for s in action_stats)
    total_derived = sum(s["derived"] for s in action_stats)
    print(f"\nActions: {total_before} before -> {total_after} after ({total_derived} derived remain)")
    print("\nPer play (before -> after, derived):")
    for s in action_stats:
        print(
            f"  {s['play']}: {s['before']} -> {s['after']} "
            f"({s['derived']} derived, {s['dropped_short']} short dropped, {s['snapped']} jitter snapped)"
        )

    conn = next((p for p in rebuilt if p["name"] == "Conn"), None)
    if conn:
        b1 = next((b for b in conn["beats"] if b["id"] == "b1"), None)
        if b1:
            p3 = [a for a in b1["actions"] if str(a.get("by")) == "3"]
            print(f"\nConn b1 P3 actions: {len(p3)}")
            for a in p3:
                print(f"  {a['id']} {a['type']} by {a['by']}")

    print(f"\nBall repairs (inserted passes): {sum(len(e['repairs']) for e in all_repairs)} total")
    for entry in all_repairs:
        print(f"  {entry['play']}: {len(entry['repairs'])} pass(es) inserted")
        for r in entry["repairs"]:
            print(f"    {r['beat']}: {r['from']}->{r['to']}")

    print(f"\nDerived movement actions: {len(all_derived)}")
    for d in all_derived:
        print(f"  {d['play']} {d['beat']} P{d['player']} {d['type']}")

    print(f"\nneedsReview actions: {len(all_needs_review)}")
    for n in all_needs_review:
        dest = f"->{n['for']}" if n.get("for") else ""
        print(f"  {n['play']} {n['beat']} {n['action']} {n['type']} {n['by']}{dest}")


if __name__ == "__main__":
    main()
