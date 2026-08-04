"""Play-level breakdown — one Claude call per play after beats are verified."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Callable

from anthropic import AsyncAnthropic

from interpret import crop_key, parse_model_json

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get(
    "ANTHROPIC_BREAKDOWN_MODEL",
    os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
)
RUBRIC_PATH = Path(__file__).resolve().parents[2] / "docs" / "how-to-break-down-a-play.md"

PROMPT_TEMPLATE = """You are a high school basketball coach breaking down one of your own plays so your players can learn it.

--- COACHING RUBRIC (follow this) ---
{rubric}
--- END RUBRIC ---

Play: {name} / {category}
Beats: {beats_json}
Coach's notes: {notes}

Return strict JSON, no prose, no markdown fences:
{{
  "intent": "the specific shot we're hunting",
  "advantage": "how we create it",
  "entry": "how it starts",
  "beatPurposes": {{"beatId": "why this beat exists"}},
  "reads": [{{"playerId": "1", "beatId": "b2", "situation": "...", "progression": ["first look", "second look"], "trigger": "..."}}],
  "roles": {{"1": {{"job": "...", "keys": ["..."], "commonError": "..."}}, "2": {{...}}, "3": {{...}}, "4": {{...}}, "5": {{...}}}},
  "spacingRules": ["..."],
  "counters": [{{"trigger": "...", "response": "...", "why": "..."}}],
  "situations": ["..."],
  "commonBreakdowns": ["..."],
  "confidence": "high|medium|low",
  "needsCoachInput": ["direct question if unsure"]
}}

Second person, present tense, coach voice throughout. Be honest about uncertainty in needsCoachInput."""


def load_rubric() -> str:
    if RUBRIC_PATH.is_file():
        return RUBRIC_PATH.read_text(encoding="utf-8")
    return "Every play hunts a specific shot. Name it first."


def beats_for_prompt(play: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for beat in play.get("beats", play.get("frames", [])):
        out.append(
            {
                "id": beat.get("id"),
                "ball": beat.get("ball"),
                "pos": beat.get("pos"),
                "actions": beat.get("actions", []),
                "note": beat.get("note", ""),
            }
        )
    return out


def coach_notes(play: dict[str, Any]) -> str:
    notes = [b.get("note", "").strip() for b in play.get("beats", play.get("frames", []))]
    notes = [n for n in notes if n]
    return " | ".join(notes) if notes else "none"


async def breakdown_one_play(
    client: AsyncAnthropic,
    play: dict[str, Any],
    crops: dict[str, str],
    *,
    model: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    beats = beats_for_prompt(play)
    rubric = load_rubric()
    text_prompt = PROMPT_TEMPLATE.format(
        rubric=rubric,
        name=play.get("name", "Play"),
        category=play.get("category", "Set"),
        beats_json=json.dumps(beats, indent=2),
        notes=coach_notes(play),
    )

    content: list[dict[str, Any]] = [{"type": "text", "text": text_prompt}]

    for i, beat in enumerate(play.get("beats", play.get("frames", []))):
        key = crop_key(play.get("name", ""), i)
        if key in crops:
            content.append({"type": "text", "text": f"Beat {i + 1} diagram ({beat.get('id', '')}):"})
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": crops[key],
                    },
                }
            )

    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
    )

    usage = {
        "input_tokens": message.usage.input_tokens,
        "output_tokens": message.usage.output_tokens,
    }

    raw = "".join(block.text for block in message.content if block.type == "text")
    data = parse_model_json(raw)
    data["breakdownStale"] = False
    data["breakdownModel"] = model
    return data, usage


async def breakdown_plays(
    plays: list[dict[str, Any]],
    crops: dict[str, str],
    *,
    play_names: list[str] | None = None,
    on_complete: Callable[[str, dict[str, Any], dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = AsyncAnthropic(api_key=api_key)
    model = DEFAULT_MODEL
    targets = plays
    if play_names:
        names = set(play_names)
        targets = [p for p in plays if p.get("name") in names]

    breakdowns: dict[str, Any] = {}
    total_usage = {"input_tokens": 0, "output_tokens": 0}

    for play in targets:
        name = play.get("name", "unknown")
        logger.info("breakdown: %s", name)
        data, usage = await breakdown_one_play(client, play, crops, model=model)
        breakdowns[name] = data
        total_usage["input_tokens"] += usage["input_tokens"]
        total_usage["output_tokens"] += usage["output_tokens"]
        if on_complete:
            on_complete(name, data, dict(breakdowns))

    return {"breakdowns": breakdowns, "usage": total_usage, "model": model}
