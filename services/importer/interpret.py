"""Stage 2 — vision interpretation of frame crops (arrows only; never writes beat.ball)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any

from vision import VisionClient, make_vision_client

logger = logging.getLogger(__name__)

MAX_CONCURRENT = int(os.environ.get("INTERPRET_MAX_CONCURRENT", "5"))
MAX_ATTEMPTS = int(os.environ.get("INTERPRET_MAX_ATTEMPTS", "3"))
RETRY_BASE_SECONDS = float(os.environ.get("INTERPRET_RETRY_BASE", "2"))
SKILL_PATH = Path(__file__).resolve().parents[2] / "docs" / "skills" / "play-interpretation.md"


def load_skill() -> str:
    if SKILL_PATH.is_file():
        return SKILL_PATH.read_text(encoding="utf-8")
    return "Read arrows only. Output actions JSON."


PROMPT_TEMPLATE = """Follow the skill document below exactly. It defines notation, disambiguation, cross-frame checks, and output shape.

--- SKILL: READING BASKETBALL DIAGRAMS ---
{skill}
--- END SKILL ---

## This frame (context)

Play: {play_name} ({category}) · Frame {beat_num} of {beat_total} · id {beat_id}

Previous frame positions: {prev_positions_json}

This frame positions: {positions_json}

Ball at START of this frame (circled number): {start_ball}
Next frame START possession (circled number, for cross-frame check): {next_start_ball}

Return strict JSON matching the Output section in the skill — no prose, no markdown fences.
Do not output ball possession — only actions. Run the self-check before returning."""


def parse_model_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def crop_key(play_name: str, beat_index: int) -> str:
    safe = "".join(ch for ch in play_name if ch.isalnum() or ch in "-_")
    return f"{safe}_beat{beat_index + 1}"


def sanitize_pass_reads(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop read-style duplicate passes (same passer, multiple receivers)."""
    pass_idx = [i for i, a in enumerate(actions) if a.get("type") in {"pass", "handoff"}]
    if len(pass_idx) <= 1:
        return actions
    by_counts: dict[str, int] = {}
    for i in pass_idx:
        by = actions[i]["by"]
        by_counts[by] = by_counts.get(by, 0) + 1
    if not any(c > 1 for c in by_counts.values()):
        return actions
    drop: set[int] = set()
    seen_by: set[str] = set()
    for i in pass_idx:
        by = actions[i]["by"]
        if by in seen_by:
            drop.add(i)
        else:
            seen_by.add(by)
    return [a for j, a in enumerate(actions) if j not in drop]


TYPE_ORDER = {"dribble": 1, "pass": 2, "handoff": 2, "screen": 3, "cut": 4}

MAX_VIA_POINTS = 4
COURT_W = 500
COURT_H = 470


def normalize_via(raw: Any) -> list[dict[str, float]]:
    """Turning points of a bent arrow, as [[x, y], ...] or [{"x":…,"y":…}, ...].

    Anything off the court or unparseable is dropped rather than trusted — a stray
    coordinate would bend a route through the stands, and a straight line is a much
    better wrong answer than that.
    """
    if not isinstance(raw, (list, tuple)):
        return []

    out: list[dict[str, float]] = []
    for point in raw[:MAX_VIA_POINTS]:
        if isinstance(point, dict):
            x, y = point.get("x"), point.get("y")
        elif isinstance(point, (list, tuple)) and len(point) >= 2:
            x, y = point[0], point[1]
        else:
            continue
        try:
            fx, fy = float(x), float(y)
        except (TypeError, ValueError):
            continue
        if not (0 <= fx <= COURT_W and 0 <= fy <= COURT_H):
            continue
        out.append({"x": round(fx, 1), "y": round(fy, 1)})
    return out


def normalize_actions(raw_actions: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out = []
    for i, action in enumerate(raw_actions or []):
        if not isinstance(action, dict):
            continue
        by = str(action.get("by", ""))
        if by not in {"1", "2", "3", "4", "5"}:
            continue
        atype = action.get("type")
        if atype not in {"screen", "cut", "dribble", "pass", "handoff"}:
            continue
        entry: dict[str, Any] = {
            "id": f"a{i + 1}",
            "type": atype,
            "by": by,
        }
        for_val = action.get("for")
        if for_val is not None and str(for_val) in {"1", "2", "3", "4", "5"}:
            entry["for"] = str(for_val)
        via = normalize_via(action.get("via"))
        if via:
            entry["via"] = via
        order = action.get("order")
        if order is not None:
            try:
                entry["order"] = int(order)
            except (TypeError, ValueError):
                entry["order"] = TYPE_ORDER.get(atype, 99)
        if action.get("uncertain"):
            entry["uncertain"] = True
            reason = action.get("reason")
            if reason:
                entry["reason"] = str(reason)[:240]
        out.append(entry)
    out = sanitize_pass_reads(out)
    if out and not any(a.get("order") is not None for a in out):
        out.sort(key=lambda a: (TYPE_ORDER.get(a["type"], 99), a["id"]))
        for j, a in enumerate(out, 1):
            a["order"] = j
    return out


async def interpret_one_frame(
    client: VisionClient,
    *,
    image_b64: str,
    beat: dict[str, Any],
    prev_beat: dict[str, Any] | None,
    next_beat: dict[str, Any] | None,
    play_name: str,
    category: str,
    beat_index: int,
    beat_total: int,
    skill: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    prev_pos = prev_beat.get("startPos") or prev_beat.get("pos", {}) if prev_beat else {}
    next_start = next_beat.get("startBall", "— (last frame)") if next_beat else "— (last frame)"
    prompt = PROMPT_TEMPLATE.format(
        skill=skill,
        play_name=play_name,
        category=category or "Set",
        beat_num=beat_index + 1,
        beat_total=beat_total,
        prev_positions_json=json.dumps(prev_pos),
        beat_id=beat.get("id", f"b{beat_index + 1}"),
        positions_json=json.dumps(beat.get("startPos") or beat.get("pos", {})),
        start_ball=beat.get("startBall", "1"),
        next_start_ball=next_start,
    )
    # A dropped connection on frame 30 of 36 used to lose the whole run. Retry the
    # transient ones, then let the caller flag just this frame.
    last_error: Exception | None = None
    result = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            result = await client.describe(
                image_b64=image_b64, prompt=prompt, json_only=True
            )
            break
        except Exception as exc:  # noqa: BLE001 - provider SDKs raise their own types
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                break
            delay = RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                "vision call failed for beat %s (attempt %s/%s): %s — retrying in %.0fs",
                beat.get("id"),
                attempt,
                MAX_ATTEMPTS,
                type(last_error).__name__,
                delay,
            )
            await asyncio.sleep(delay)

    if result is None:
        raise RuntimeError(
            f"vision call failed after {MAX_ATTEMPTS} attempts: {last_error}"
        ) from last_error

    text = result.text
    usage = {
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
    }
    try:
        parsed = parse_model_json(text)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("JSON parse failed for beat %s: %s", beat.get("id"), exc)
        return (
            {
                "actions": [],
                "note": "",
                "needs_review": True,
                "review_reason": "parse_failed",
            },
            usage,
        )

    confidence = str(parsed.get("confidence", "low")).lower()
    actions = normalize_actions(parsed.get("actions"))
    has_uncertain = any(a.get("uncertain") for a in actions)
    needs_review = confidence in {"low", "medium"} or has_uncertain
    review_reason = None
    if confidence == "low":
        review_reason = "low_confidence"
    elif has_uncertain:
        review_reason = "uncertain_actions"
    elif confidence == "medium":
        review_reason = "medium_confidence"

    return (
        {
            "actions": actions,
            "note": parsed.get("note") or "",
            "alignment": parsed.get("alignment"),
            "needs_review": needs_review,
            "review_reason": review_reason,
            "confidence": confidence,
        },
        usage,
    )


async def interpret_plays(
    plays: list[dict[str, Any]],
    crops: dict[str, str],
    *,
    api_key: str | None = None,
    model: str | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    client = make_vision_client(provider=provider, api_key=api_key, model=model)
    model = client.model
    skill = load_skill()
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    total_in = 0
    total_out = 0
    review_beats: list[dict[str, Any]] = []

    async def process_beat(play: dict[str, Any], beat_idx: int, beat: dict[str, Any]) -> None:
        nonlocal total_in, total_out
        key_name = crop_key(play["name"], beat_idx)
        image_b64 = crops.get(key_name)
        beats = play.get("beats", [])
        prev = beats[beat_idx - 1] if beat_idx > 0 else None
        next_b = beats[beat_idx + 1] if beat_idx + 1 < len(beats) else None
        if not image_b64:
            beat["needs_review"] = True
            beat["review_reason"] = "missing_crop"
            review_beats.append(
                {"play": play["name"], "beat_id": beat.get("id"), "reason": "missing_crop"}
            )
            return

        try:
            async with sem:
                result, usage = await interpret_one_frame(
                    client,
                    image_b64=image_b64,
                    beat=beat,
                    prev_beat=prev,
                    next_beat=next_b,
                    play_name=play["name"],
                    category=play.get("category", "Set"),
                    beat_index=beat_idx,
                    beat_total=len(beats),
                    skill=skill,
                )
        except Exception as exc:  # noqa: BLE001
            # One unreachable frame is a frame to review, not a failed import.
            logger.error(
                "beat %s of %s failed: %s", beat.get("id"), play["name"], exc
            )
            beat["actions"] = []
            beat["needs_review"] = True
            beat["review_reason"] = "interpret_failed"
            review_beats.append(
                {
                    "play": play["name"],
                    "beat_id": beat.get("id"),
                    "reason": "interpret_failed",
                }
            )
            return
        total_in += usage["input_tokens"]
        total_out += usage["output_tokens"]
        beat["actions"] = result["actions"]
        beat["note"] = result["note"]
        if result.get("alignment"):
            beat["alignment"] = result["alignment"]
        if result.get("needs_review"):
            beat["needs_review"] = True
            beat["review_reason"] = result.get("review_reason")
            review_beats.append(
                {
                    "play": play["name"],
                    "beat_id": beat.get("id"),
                    "reason": result.get("review_reason"),
                }
            )
        if result.get("confidence"):
            beat["confidence"] = result["confidence"]

    tasks = []
    for play in plays:
        for i, beat in enumerate(play.get("beats", [])):
            tasks.append(process_beat(play, i, beat))

    await asyncio.gather(*tasks)

    logger.info(
        "interpret complete import_id=%s provider=%s model=%s "
        "input_tokens=%s output_tokens=%s review=%s",
        str(uuid.uuid4())[:8],
        client.provider,
        model,
        total_in,
        total_out,
        len(review_beats),
    )

    return {
        "plays": plays,
        "usage": {"input_tokens": total_in, "output_tokens": total_out},
        "needs_review": review_beats,
        "provider": client.provider,
        "model": model,
    }
