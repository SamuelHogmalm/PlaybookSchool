"""Stage 2 — vision interpretation of frame crops (arrows, notes)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from typing import Any

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
MAX_CONCURRENT = int(os.environ.get("INTERPRET_MAX_CONCURRENT", "5"))

PROMPT_TEMPLATE = """You are reading one frame of a basketball play diagram.

The five players' positions are already known and given below in a 500x470
coordinate system (baseline at top, y=0; half-court line at bottom, y=470;
hoop center at x=250, y=52).

Players: {positions_json}
Ball handler: {ball}

Standard notation in this diagram:
- Solid line with an arrowhead = a cut (player movement)
- Dashed line with an arrowhead = a pass
- Wavy or zigzag line = a dribble
- Line ending in a short perpendicular bar = a screen; the bar is where
  the screen is set

Identify ONLY the actions in this frame. Return strict JSON, no prose,
no markdown fences:

{{
  "actions": [
    {{"type": "screen|cut|dribble|pass|handoff", "by": "1-5", "for": "1-5 or null"}}
  ],
  "note": "one sentence a high school player would understand",
  "confidence": "high|medium|low"
}}

Rules:
- "by" is the player performing the action. For a screen, "by" is the screener
  and "for" is the player being screened.
- For a pass, "by" is the passer and "for" is the receiver.
- If an arrow's owner is ambiguous, omit that action rather than guessing.
- Set confidence to "low" if arrows cross or you are unsure of any assignment."""


def parse_model_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def crop_key(play_name: str, beat_index: int) -> str:
    safe = "".join(ch for ch in play_name if ch.isalnum() or ch in "-_")
    return f"{safe}_beat{beat_index + 1}"


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
        out.append(entry)
    return out


async def interpret_one_frame(
    client: AsyncAnthropic,
    *,
    image_b64: str,
    beat: dict[str, Any],
    model: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    prompt = PROMPT_TEMPLATE.format(
        positions_json=json.dumps(beat.get("pos", {})),
        ball=beat.get("ball", "1"),
    )
    message = await client.messages.create(
        model=model,
        max_tokens=1024,
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
    needs_review = confidence == "low"
    actions = normalize_actions(parsed.get("actions"))
    if confidence == "low":
        actions = []

    return (
        {
            "actions": actions,
            "note": parsed.get("note") or "",
            "needs_review": needs_review,
            "review_reason": "low_confidence" if needs_review else None,
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
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    total_in = 0
    total_out = 0
    review_beats: list[dict[str, Any]] = []

    async def process_beat(play: dict[str, Any], beat_idx: int, beat: dict[str, Any]) -> None:
        nonlocal total_in, total_out
        key_name = crop_key(play["name"], beat_idx)
        image_b64 = crops.get(key_name)
        if not image_b64:
            beat["needs_review"] = True
            beat["review_reason"] = "missing_crop"
            review_beats.append(
                {"play": play["name"], "beat_id": beat.get("id"), "reason": "missing_crop"}
            )
            return

        async with sem:
            result, usage = await interpret_one_frame(
                client, image_b64=image_b64, beat=beat, model=model
            )
        total_in += usage["input_tokens"]
        total_out += usage["output_tokens"]
        beat["actions"] = result["actions"]
        beat["note"] = result["note"]
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

    tasks = []
    for play in plays:
        for i, beat in enumerate(play.get("beats", [])):
            tasks.append(process_beat(play, i, beat))

    await asyncio.gather(*tasks)

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
