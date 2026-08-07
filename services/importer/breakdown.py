"""Play-level breakdown — movements + main look only."""

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

TYPE_ORDER = {
    "dribble": 1,
    "pass": 2,
    "handoff": 2,
    "screen": 3,
    "cut": 4,
    "fill": 4,
    "relocate": 4,
}

PROMPT_TEMPLATE = """You translate one basketball play diagram into our animated model.

--- RUBRIC ---
{rubric}
--- END RUBRIC ---

Play: {name} / {category}
Beats: {beats_json}
Coach's notes: {notes}

Return strict JSON, no prose, no markdown fences:
{{
  "intent": "one sentence — the final shot this play hunts (main look only)",
  "motions": [
    {{
      "beatId": "b1",
      "order": 1,
      "playerId": "1",
      "type": "dribble|pass|handoff|screen|cut|fill|relocate",
      "description": "short factual movement — angle, timing, destination"
    }}
  ]
}}

MOTIONS — list every movement on every beat in play order (order restarts at 1 each beat):
- dribble → pass/handoff → screen → cut/fill/relocate within a beat unless the diagram clearly shows another sequence
- one pass arrow = one pass — never list pass options or reads
- screener order number must be lower than the cutter they screen for

Do NOT output: reads, roles, counters, situations, spacingRules, beatPurposes, advantage, entry, or coaching essays.

## How animation uses this data

The coach app plays beats **one action at a time** in `order` within each beat:
dribble → pass/handoff → screen → cut/fill/relocate. Parallel motion only when
actions share the same order step. One pass arrow = one animated pass. If the
diagram is ambiguous, omit the motion — the coach will fix it in review."""


def load_rubric() -> str:
    parts = []
    knowledge_path = RUBRIC_PATH.parent / "basketball-diagram-knowledge.md"
    if knowledge_path.is_file():
        parts.append(knowledge_path.read_text(encoding="utf-8"))
    if RUBRIC_PATH.is_file():
        parts.append(RUBRIC_PATH.read_text(encoding="utf-8"))
    return "\n\n".join(parts) if parts else "List movements in order. Name the main look in one sentence."


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


def normalize_breakdown(data: dict[str, Any], play: dict[str, Any]) -> dict[str, Any]:
    """Keep only intent + motions; ensure motion order per beat."""
    beats = play.get("beats", play.get("frames", []))
    beat_ids = [b.get("id") for b in beats if b.get("id")]

    motions: list[dict[str, Any]] = []
    for raw in data.get("motions") or []:
        if not isinstance(raw, dict):
            continue
        m = dict(raw)
        bid = m.get("beatId") or m.get("beat") or (beat_ids[0] if beat_ids else "b1")
        m["beatId"] = bid
        if m.get("order") is None:
            m["order"] = TYPE_ORDER.get(str(m.get("type", "")), 99)
        motions.append(m)

    by_beat: dict[str, list[dict[str, Any]]] = {}
    for m in motions:
        by_beat.setdefault(str(m["beatId"]), []).append(m)

    normalized: list[dict[str, Any]] = []
    ordered_beats = beat_ids or sorted(by_beat.keys())
    for bid in ordered_beats:
        group = sorted(
            by_beat.get(str(bid), []),
            key=lambda x: (int(x.get("order", 99)), TYPE_ORDER.get(str(x.get("type", "")), 99)),
        )
        for j, m in enumerate(group, 1):
            m["order"] = j
            normalized.append(m)

    intent = (data.get("intent") or "").strip()
    if not intent:
        legacy = data.get("mainReads")
        if isinstance(legacy, list) and legacy:
            intent = str(legacy[0]).strip()

    return {
        "intent": intent,
        "motions": normalized,
    }


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
    data = normalize_breakdown(data, play)
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
