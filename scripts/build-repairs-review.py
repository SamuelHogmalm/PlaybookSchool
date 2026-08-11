#!/usr/bin/env python3
"""Generate repair review assets: PDF crops, repairs JSON, ring confidence."""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

import pdfplumber  # noqa: E402
from parser import (  # noqa: E402
    BALL_RING_SIZE,
    BALL_RING_TOL,
    COURT_H,
    COURT_W,
    DIGITS,
    ball_rings,
    find_courts,
    parse,
)

PDF_PATH = Path(r"C:\Users\samue\Downloads\2024-25 plays.pdf")
PLAYS_JSON = ROOT / "src" / "data" / "plays-interpreted.json"
OUT_JSON = ROOT / "src" / "data" / "repairs-review.json"
CROPS_DIR = ROOT / "public" / "dev-repairs" / "crops"


def crop_key(play_name: str, beat_index: int) -> str:
    safe = "".join(ch for ch in play_name if ch.isalnum() or ch in "-_")
    return f"{safe}_beat{beat_index + 1}"


def in_court(cx: float, cy: float, x0: float, x1: float, y0: float, y1: float, margin: float = 14) -> bool:
    return x0 - margin <= cx <= x1 + margin and y0 - margin <= cy <= y1 + margin


def analyze_start_ball(page, bbox: list[float]) -> dict:
    """Ring detection confidence for one court frame."""
    x0, y0, x1, y1 = bbox
    words = page.extract_words()
    rings = ball_rings(page)

    raw: dict[str, tuple[float, float]] = {}
    for w in words:
        if w["text"] not in DIGITS:
            continue
        cx = (w["x0"] + w["x1"]) / 2
        cy = (w["top"] + w["bottom"]) / 2
        if in_court(cx, cy, x0, x1, y0, y1):
            raw[w["text"]] = (cx, cy)

    court_rings = [
        ((c["x0"] + c["x1"]) / 2, (c["top"] + c["bottom"]) / 2)
        for c in page.curves
        if abs((c["x1"] - c["x0"]) - BALL_RING_SIZE) < BALL_RING_TOL
        and abs((c["bottom"] - c["top"]) - BALL_RING_SIZE) < BALL_RING_TOL
        and in_court((c["x0"] + c["x1"]) / 2, (c["top"] + c["bottom"]) / 2, x0, x1, y0, y1)
    ]

    if not court_rings:
        assigned = None
        best_dist = None
        flags = ["no_ring_in_court"]
        confidence = "none"
    else:
        best_dist = 999.0
        assigned = None
        second_best = 999.0
        for rx, ry in court_rings:
            for pid, (cx, cy) in raw.items():
                d = math.hypot(cx - rx, cy - ry)
                if d < best_dist:
                    second_best = best_dist
                    best_dist, assigned = d, pid
                elif d < second_best:
                    second_best = d

        flags = []
        if best_dist is None or assigned is None:
            confidence = "none"
            flags.append("ring_no_nearby_digit")
        elif best_dist <= 12:
            confidence = "high"
        elif best_dist <= 24:
            confidence = "medium"
            flags.append("ring_digit_gap")
        else:
            confidence = "low"
            flags.append("ring_far_from_digit")

        if len(court_rings) > 1:
            flags.append("multiple_rings")
            if second_best <= best_dist + 6:
                confidence = "low"
                flags.append("ambiguous_ring")

    used_fallback = assigned is None
    if used_fallback:
        assigned = "1"
        if confidence != "none":
            confidence = "low"
        flags.append("fallback_player_1")

    return {
        "startBall": assigned,
        "ringsInCourt": len(court_rings),
        "ringToDigitPx": round(best_dist, 1) if best_dist is not None and best_dist < 900 else None,
        "confidence": confidence,
        "flags": flags,
        "usedFallback": used_fallback,
    }


def extract_repairs(plays: list[dict]) -> list[dict]:
    repairs: list[dict] = []
    for play in plays:
        beats = play.get("beats") or []
        for i, beat in enumerate(beats):
            prev = beats[i - 1] if i > 0 else None
            for action in beat.get("actions") or []:
                if action.get("needsReview") and action.get("type") in {"pass", "handoff"}:
                    next_beat = beats[i + 1] if i + 1 < len(beats) else None
                    repairs.append(
                        {
                            "kind": "inserted_pass",
                            "play": play["name"],
                            "beatId": beat["id"],
                            "beatIndex": i,
                            "actionId": action.get("id"),
                            "actionType": action.get("type"),
                            "by": action.get("by"),
                            "for": action.get("for"),
                            "reason": action.get("reason") or "",
                            "prevEndBall": prev.get("ball") if prev else None,
                            "beatEndBall": beat.get("ball"),
                            "beatStartBall": beat.get("startBall"),
                            "nextStartBall": next_beat.get("startBall") if next_beat else None,
                            "nextBeatId": next_beat.get("id") if next_beat else None,
                            "trigger": action.get("reason")
                            or (
                                f"Derived end ball != next frame startBall "
                                f"(before insert: see action reason)"
                            ),
                        }
                    )
                elif action.get("derived"):
                    repairs.append(
                        {
                            "kind": "derived_movement",
                            "play": play["name"],
                            "beatId": beat["id"],
                            "beatIndex": i,
                            "actionId": action.get("id"),
                            "actionType": action.get("type"),
                            "by": action.get("by"),
                            "reason": (
                                f"Player {action.get('by')} moved "
                                f"{action.get('type')} with no AI action (rule 9)"
                            ),
                            "beatStartBall": beat.get("startBall"),
                            "holderAtStart": prev.get("ball") if prev else beat.get("startBall"),
                        }
                    )

    repairs.sort(key=lambda r: (0 if r["kind"] == "inserted_pass" else 1, r["play"], r["beatIndex"]))
    return repairs


def extract_crops_pdfplumber(pdf_path: str, parser_plays: list[dict], outdir: Path, dpi: int = 200) -> None:
    """Crop beats using pdfplumber page images (no poppler required)."""
    outdir.mkdir(parents=True, exist_ok=True)
    scale = dpi / 72.0
    with pdfplumber.open(pdf_path) as pdf:
        pages = {p.page_number: p for p in pdf.pages}
        for play in parser_plays:
            for i, beat in enumerate(play.get("beats") or []):
                src = beat.get("_source") or {}
                bbox = src.get("bbox")
                page_num = src.get("page")
                if not bbox or not page_num:
                    continue
                page = pages.get(page_num)
                if not page:
                    continue
                x0, y0, x1, y1 = bbox
                pad = 16
                crop_box = (
                    max(0, x0 - pad),
                    max(0, y0 - pad),
                    x1 + pad,
                    y1 + pad,
                )
                img = page.crop(crop_box).to_image(resolution=dpi)
                key = crop_key(play["name"], i)
                img.save(str(outdir / f"{key}.png"), format="PNG")


def main() -> None:
    if not PDF_PATH.is_file():
        raise SystemExit(f"PDF not found: {PDF_PATH}")

    interpreted = json.loads(PLAYS_JSON.read_text(encoding="utf-8"))
    parser_plays = parse(str(PDF_PATH))

    # Map beat -> bbox from parser _source
    bbox_by_key: dict[str, list[float]] = {}
    page_by_key: dict[str, int] = {}
    for play in parser_plays:
        for i, beat in enumerate(play.get("beats") or []):
            src = beat.get("_source") or {}
            key = crop_key(play["name"], i)
            bbox_by_key[key] = src.get("bbox")
            page_by_key[key] = src.get("page")

    CROPS_DIR.mkdir(parents=True, exist_ok=True)

    extract_crops_pdfplumber(str(PDF_PATH), parser_plays, CROPS_DIR, dpi=200)

    repairs = extract_repairs(interpreted)

    ring_by_key: dict[str, dict] = {}
    with pdfplumber.open(str(PDF_PATH)) as pdf:
        pages = {p.page_number: p for p in pdf.pages}
        for key, bbox in bbox_by_key.items():
            if not bbox:
                continue
            page = pages.get(page_by_key.get(key))
            if page:
                ring_by_key[key] = analyze_start_ball(page, bbox)

    # Attach ring confidence to repairs
    pass_ring_flags: list[dict] = []
    for repair in repairs:
        key = crop_key(repair["play"], repair["beatIndex"])
        repair["cropUrl"] = f"/dev-repairs/crops/{key}.png"
        repair["ringThisBeat"] = ring_by_key.get(key)

        if repair["kind"] == "inserted_pass":
            next_index = repair["beatIndex"] + 1
            next_key = crop_key(repair["play"], next_index)
            next_ring = ring_by_key.get(next_key)
            repair["ringNextBeat"] = next_ring
            repair["ringNextBeatCropUrl"] = f"/dev-repairs/crops/{next_key}.png"

            # Primary flag: next frame ring observation that triggered insert
            conf = next_ring.get("confidence") if next_ring else "unknown"
            repair["ringConfidence"] = conf
            risky = conf in {"none", "low"} or (next_ring and next_ring.get("usedFallback"))
            repair["ringRisk"] = risky
            if risky:
                pass_ring_flags.append(
                    {
                        "play": repair["play"],
                        "beatId": repair["nextBeatId"],
                        "confidence": conf,
                        "flags": next_ring.get("flags") if next_ring else [],
                        "observedStartBall": repair.get("nextStartBall"),
                    }
                )

    out = {
        "generatedFrom": str(PDF_PATH),
        "repairCount": len(repairs),
        "insertedPassCount": sum(1 for r in repairs if r["kind"] == "inserted_pass"),
        "derivedMovementCount": sum(1 for r in repairs if r["kind"] == "derived_movement"),
        "repairs": repairs,
        "passRingFlags": pass_ring_flags,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(repairs)} repairs to {OUT_JSON}")
    print(f"Crops in {CROPS_DIR} ({len(list(CROPS_DIR.glob('*.png')))} files)")
    print(f"\nRing confidence for {len(pass_ring_flags)} risky + all inserted passes:")
    for repair in repairs:
        if repair["kind"] != "inserted_pass":
            continue
        conf = repair.get("ringConfidence")
        risk = "RISK" if repair.get("ringRisk") else "ok"
        print(
            f"  {repair['play']} {repair['beatId']} -> next {repair.get('nextBeatId')}: "
            f"ring={conf} [{risk}] observed={repair.get('nextStartBall')}"
        )


if __name__ == "__main__":
    main()
