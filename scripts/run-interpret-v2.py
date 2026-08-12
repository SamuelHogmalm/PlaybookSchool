#!/usr/bin/env python3
"""Re-run AI interpretation with current skill file -> plays-interpreted-vN.json."""

from __future__ import annotations

import asyncio
import copy
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

from crops import encode_crops_from_dir  # noqa: E402
from derive import TRANSFERS, finalize_beats, migrate_legacy_ball_field  # noqa: E402
from interpret import interpret_plays  # noqa: E402
from parser import parse  # noqa: E402

PDF_PATH = Path(r"C:\Users\samue\Downloads\2024-25 plays.pdf")
CROPS_DIR = ROOT / "public" / "dev-repairs" / "crops"
V1_JSON = ROOT / "src" / "data" / "plays-interpreted.json"
ENV_PATH = ROOT / "services" / "importer" / ".env"
DEFAULT_OUT = ROOT / "src" / "data" / "plays-interpreted-v3.json"
INTERPRET_MODEL = os.environ.get("V1_INTERPRET_MODEL", "claude-sonnet-4-5-20250929")
INPUT_COST_PER_M = 3.0
OUTPUT_COST_PER_M = 15.0


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


def strip_derived_actions(beat: dict) -> None:
    cleaned = []
    for action in beat.get("actions") or []:
        if action.get("derived"):
            continue
        if action.get("needsReview") and action.get("type") in TRANSFERS:
            reason = str(action.get("reason") or "")
            if reason.startswith("Inserted pass"):
                continue
        cleaned.append(action)
    beat["actions"] = cleaned


def prepare_for_derive(play: dict) -> dict:
    """Copy play and strip derive artifacts for a clean pipeline run."""
    p = copy.deepcopy(play)
    for beat in p.get("beats") or []:
        strip_derived_actions(beat)
        beat.pop("ball", None)
    return p


def export_play(play: dict) -> dict:
    beats_out = []
    for beat in play.get("beats") or []:
        out = {
            "id": beat["id"],
            "startPos": beat.get("startPos") or beat.get("pos") or {},
            "pos": beat.get("pos") or {},
            "startBall": beat.get("startBall") or "1",
            "ball": beat.get("ball") or beat.get("startBall") or "1",
            "actions": beat.get("actions") or [],
        }
        if beat.get("note"):
            out["note"] = beat["note"]
        if beat.get("alignment"):
            out["alignment"] = beat["alignment"]
        if beat.get("needs_review"):
            out["needs_review"] = beat["needs_review"]
        if beat.get("review_reason"):
            out["review_reason"] = beat["review_reason"]
        if beat.get("confidence"):
            out["confidence"] = beat["confidence"]
        beats_out.append(out)
    return {
        "name": play["name"],
        "category": play.get("category") or "Set",
        "beats": beats_out,
    }


def run_derive_pipeline(plays: list[dict]) -> tuple[list[dict], dict]:
    """Run finalize_beats per play; return exported plays + aggregated stats."""
    exported: list[dict] = []
    totals = {
        "ai_read_before": 0,
        "after_derive": 0,
        "derived": 0,
        "short_dropped": 0,
        "inserted_passes": 0,
        "zero_travel_screens": 0,
        "pass_cut_flags": 0,
        "holder_cut_flags": 0,
        "per_play": [],
    }

    for play in plays:
        p = prepare_for_derive(play)
        beats = p["beats"]
        for beat in beats:
            migrate_legacy_ball_field([beat])

        summary = finalize_beats(beats)
        exported.append(export_play(p))

        inserted = len(summary["ball_repairs"])
        totals["ai_read_before"] += summary["actions_before"]
        totals["after_derive"] += summary["actions_after"]
        totals["derived"] += summary["derived_remaining"]
        totals["short_dropped"] += len(summary["short_dropped"])
        totals["inserted_passes"] += inserted
        totals["zero_travel_screens"] += len(summary["zero_travel_flagged"])
        totals["pass_cut_flags"] += len(summary["pass_cut_flagged"])
        totals["holder_cut_flags"] += len(summary["holder_cuts_flagged"])
        totals["per_play"].append(
            {
                "play": p["name"],
                "ai_before": summary["actions_before"],
                "ai_after": summary["actions_after"],
                "derived": summary["derived_remaining"],
                "short_dropped": len(summary["short_dropped"]),
                "inserted_passes": inserted,
                "zero_travel": len(summary["zero_travel_flagged"]),
                "pass_cut": len(summary["pass_cut_flagged"]),
                "holder_cut": len(summary["holder_cuts_flagged"]),
            }
        )

    return exported, totals


def count_pass_cut_conflicts(plays: list[dict]) -> int:
    """Player-level pass+ cut conflicts (matches validatePlay rule 12)."""
    n = 0
    for play in plays:
        for beat in play.get("beats") or []:
            by_player: dict[str, set[str]] = {}
            for action in beat.get("actions") or []:
                pid = str(action.get("by") or "")
                by_player.setdefault(pid, set()).add(str(action.get("type")))
            for types in by_player.values():
                if types & {"pass", "handoff"} and "cut" in types:
                    n += 1
    return n


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Re-run interpret with current skill file")
    parser.add_argument(
        "--model",
        default=INTERPRET_MODEL,
        help=f"Anthropic model (default: {INTERPRET_MODEL})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output JSON path (default: {DEFAULT_OUT.name})",
    )
    args = parser.parse_args()
    out_json: Path = args.out
    meta_json = out_json.with_name(out_json.stem + "-meta.json")

    load_dotenv(ENV_PATH)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in services/importer/.env", file=sys.stderr)
        sys.exit(1)

    if not PDF_PATH.is_file():
        print(f"ERROR: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print("=== Stage 1: Parse PDF ===")
    parser_plays = parse(str(PDF_PATH))
    seed_names = {p["name"] for p in json.loads(V1_JSON.read_text(encoding="utf-8"))}
    plays = [p for p in parser_plays if p["name"] in seed_names]
    frame_count = sum(len(p["beats"]) for p in plays)
    print(f"  {len(plays)} plays, {frame_count} frames (matching seed book)")

    print("\n=== Stage 2: Load crops ===")
    crops = encode_crops_from_dir(plays, str(CROPS_DIR))
    print(f"  {len(crops)} crops loaded from {CROPS_DIR}")
    missing = []
    for play in plays:
        for i in range(len(play["beats"])):
            from interpret import crop_key  # noqa: WPS433

            key = crop_key(play["name"], i)
            if key not in crops:
                missing.append(f"{play['name']} {play['beats'][i]['id']} ({key})")
    if missing:
        print(f"  WARN: {len(missing)} missing crops:", file=sys.stderr)
        for m in missing:
            print(f"    {m}", file=sys.stderr)

    print(f"\n=== Stage 3: AI interpretation ({frame_count} frames) ===")
    print(f"  Model: {args.model}")
    plays_copy = copy.deepcopy(plays)
    result = await interpret_plays(plays_copy, crops, model=args.model)
    usage = result["usage"]
    model = result.get("model", os.environ.get("ANTHROPIC_MODEL", "unknown"))
    in_tok = usage["input_tokens"]
    out_tok = usage["output_tokens"]
    cost = (in_tok / 1_000_000) * INPUT_COST_PER_M + (out_tok / 1_000_000) * OUTPUT_COST_PER_M
    print(f"  Model: {model}")
    print(f"  Input tokens:  {in_tok:,}")
    print(f"  Output tokens: {out_tok:,}")
    print(f"  Total tokens:  {in_tok + out_tok:,}")
    print(f"  Est. cost:     ${cost:.4f}  (@ ${INPUT_COST_PER_M}/M in, ${OUTPUT_COST_PER_M}/M out)")
    if result.get("needs_review"):
        print(f"  Beats flagged needs_review: {len(result['needs_review'])}")

    ai_read_total = sum(
        len(b.get("actions") or []) for p in plays_copy for b in p.get("beats") or []
    )
    print(f"  AI-read actions (raw): {ai_read_total}")

    print("\n=== Stage 4: Derive pipeline ===")
    new_exported, new_stats = run_derive_pipeline(plays_copy)
    out_json.write_text(json.dumps(new_exported, indent=1) + "\n", encoding="utf-8")
    print(f"  Wrote {out_json}")

    print("\n=== V1 baseline (re-derive stripped seed) ===")
    v1_raw = json.loads(V1_JSON.read_text(encoding="utf-8"))
    _, v1_stats = run_derive_pipeline(v1_raw)

    label = out_json.stem.replace("plays-interpreted-", "") or "new"
    print(f"\n=== Comparison: v1 (current seed) vs {label} ===")
    rows = [
        ("AI-read actions (pre-derive)", v1_stats["ai_read_before"], new_stats["ai_read_before"]),
        ("Actions after derive", v1_stats["after_derive"], new_stats["after_derive"]),
        ("Derived actions", v1_stats["derived"], new_stats["derived"]),
        ("Short-movement drops", v1_stats["short_dropped"], new_stats["short_dropped"]),
        ("Inserted passes", v1_stats["inserted_passes"], new_stats["inserted_passes"]),
        ("Zero-travel screens flagged", v1_stats["zero_travel_screens"], new_stats["zero_travel_screens"]),
        ("Pass+cut flags (derive)", v1_stats["pass_cut_flags"], new_stats["pass_cut_flags"]),
        ("Pass+cut conflicts (validate)", count_pass_cut_conflicts(v1_raw), count_pass_cut_conflicts(new_exported)),
        ("Ball-handler cut flags", v1_stats["holder_cut_flags"], new_stats["holder_cut_flags"]),
    ]
    print(f"{'Metric':<32} {'v1':>6} {label:>6} {'delta':>7}")
    print("-" * 55)
    for row_label, v1, vnew in rows:
        delta = vnew - v1
        sign = "+" if delta > 0 else ""
        print(f"{row_label:<32} {v1:>6} {vnew:>6} {sign}{delta:>6}")

    print(f"\nPer-play ({label}): ai_before -> after (derived)")
    for row in new_stats["per_play"]:
        print(
            f"  {row['play']}: {row['ai_before']} -> {row['ai_after']} "
            f"({row['derived']} derived, {row['short_dropped']} short drop, "
            f"{row['inserted_passes']} ins pass, {row['pass_cut']} pass+cut)"
        )

    sidecar = {
        "model": model,
        "usage": usage,
        "cost_usd": round(cost, 4),
        "v1": v1_stats,
        "new": new_stats,
        "pass_cut_conflicts_v1": count_pass_cut_conflicts(v1_raw),
        "pass_cut_conflicts_new": count_pass_cut_conflicts(new_exported),
    }
    meta_json.write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print(f"\nMeta written to {meta_json}")


if __name__ == "__main__":
    asyncio.run(main())
