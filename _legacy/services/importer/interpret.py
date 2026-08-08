"""Stage 2 — vision interpretation of frame crops (arrows, notes)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic

from animation_validate import apply_animation_validation

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
MAX_CONCURRENT = int(os.environ.get("INTERPRET_MAX_CONCURRENT", "5"))
KNOWLEDGE_PATH = Path(__file__).resolve().parents[2] / "docs" / "basketball-diagram-knowledge.md"


def load_basketball_knowledge() -> str:
    if KNOWLEDGE_PATH.is_file():
        return KNOWLEDGE_PATH.read_text(encoding="utf-8")
    return "Use standard basketball action order: dribble, pass, screen, cut."


PROMPT_TEMPLATE = """Follow the skill document below exactly. It defines notation, disambiguation, cross-frame checks, and output shape.

--- SKILL: READING BASKETBALL DIAGRAMS ---
{knowledge}
--- END SKILL ---

## This frame (context)

Play: {play_name} ({category}) · Frame {beat_num} of {beat_total} · id {beat_id}

Previous frame ball handler: {prev_ball}
Previous frame positions: {prev_positions_json}

This frame END positions: {positions_json}
This frame END ball handler: {ball}

Next frame ball handler (for cross-frame validation): {next_ball}

Return strict JSON matching the Output section in the skill — no prose, no markdown fences.
Run the self-check before returning."""


def parse_model_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def crop_key(play_name: str, beat_index: int) -> str:
    safe = "".join(ch for ch in play_name if ch.isalnum() or ch in "-_")
    return f"{safe}_beat{beat_index + 1}"


def sanitize_pass_reads(actions: list[dict[str, Any]], ball: str | None) -> list[dict[str, Any]]:
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


def normalize_actions(raw_actions: list[dict[str, Any]] | None, ball: str | None = None) -> list[dict[str, Any]]:
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
    out = sanitize_pass_reads(out, ball)
    if out and not any(a.get("order") is not None for a in out):
        out.sort(key=lambda a: (TYPE_ORDER.get(a["type"], 99), a["id"]))
        for j, a in enumerate(out, 1):
            a["order"] = j
    return out


def ensure_cross_frame_pass(prev: dict[str, Any] | None, beat: dict[str, Any]) -> None:
    """Ball cannot teleport — inject missing pass with uncertain flag."""
    if not prev:
        return
    pb = str(prev.get("ball") or "")
    cb = str(beat.get("ball") or "")
    if not pb or not cb or pb == cb or pb not in {"1", "2", "3", "4", "5"}:
        return
    actions: list[dict[str, Any]] = list(beat.get("actions") or [])
    has_transfer = any(
        a.get("type") in {"pass", "handoff"} and str(a.get("by")) == pb and str(a.get("for")) == cb
        for a in actions
    )
    if has_transfer:
        return
    actions.append(
        {
            "id": f"a{len(actions) + 1}",
            "type": "pass",
            "by": pb,
            "for": cb,
            "order": 2,
            "uncertain": True,
            "reason": "Ball changed from previous frame but no pass line was detected",
        }
    )
    beat["actions"] = actions
    beat["needs_review"] = True
    beat["review_reason"] = beat.get("review_reason") or "missing_pass_inferred"


async def interpret_one_frame(
    client: AsyncAnthropic,
    *,
    image_b64: str,
    beat: dict[str, Any],
    prev_beat: dict[str, Any] | None,
    next_beat: dict[str, Any] | None,
    play_name: str,
    category: str,
    beat_index: int,
    beat_total: int,
    model: str,
    knowledge: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    prev_ball = prev_beat.get("ball", "?") if prev_beat else "— (formation)"
    prev_pos = prev_beat.get("pos", {}) if prev_beat else {}
    next_ball = next_beat.get("ball", "— (last frame)") if next_beat else "— (last frame)"
    prompt = PROMPT_TEMPLATE.format(
        knowledge=knowledge,
        play_name=play_name,
        category=category or "Set",
        beat_num=beat_index + 1,
        beat_total=beat_total,
        prev_ball=prev_ball,
        prev_positions_json=json.dumps(prev_pos),
        beat_id=beat.get("id", f"b{beat_index + 1}"),
        positions_json=json.dumps(beat.get("pos", {})),
        ball=beat.get("ball", "1"),
        next_ball=next_ball,
    )
    message = await client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    usage = {
        "input_tokens": message.usage.input_tokens,
        "output_tokens": message.usage.output_tokens,
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
    actions = normalize_actions(parsed.get("actions"), str(beat.get("ball", "1")))
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
) -> dict[str, Any]:
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = AsyncAnthropic(api_key=key)
    model = model or DEFAULT_MODEL
    knowledge = load_basketball_knowledge()
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
            beat["inferMoves"] = False
            review_beats.append(
                {"play": play["name"], "beat_id": beat.get("id"), "reason": "missing_crop"}
            )
            return

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
                model=model,
                knowledge=knowledge,
            )
        total_in += usage["input_tokens"]
        total_out += usage["output_tokens"]
        beat["actions"] = result["actions"]
        beat["note"] = result["note"]
        beat["inferMoves"] = (
            len(result["actions"]) == 0
            or result.get("confidence") == "low"
        )
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

    for play in plays:
        beats = play.get("beats", [])
        for i, beat in enumerate(beats):
            if i > 0:
                ensure_cross_frame_pass(beats[i - 1], beat)
                beat["actions"] = normalize_actions(beat.get("actions"), str(beat.get("ball", "1")))
        apply_animation_validation(play)
        for i, beat in enumerate(play.get("beats", [])):
            for issue in beat.get("animation_issues") or []:
                if issue.get("severity") == "error":
                    review_beats.append(
                        {
                            "play": play["name"],
                            "beat_id": beat.get("id"),
                            "reason": issue.get("code", "animation_error"),
                        }
                    )

    logger.info(
        "interpret complete import_id=%s input_tokens=%s output_tokens=%s review=%s",
        str(uuid.uuid4())[:8],
        total_in,
        total_out,
        len(review_beats),
    )

    return {
        "plays": plays,
        "usage": {"input_tokens": total_in, "output_tokens": total_out},
        "needs_review": review_beats,
        "model": model,
    }
