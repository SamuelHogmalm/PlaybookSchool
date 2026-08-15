"""One real vision call, to prove the provider is wired up.

    cd services/importer
    .venv/Scripts/python.exe smoke_vision.py

Sends a single frame crop and asks a trivial question. Verifies the key, the model id,
the SDK call shape and the token accounting in one go — all the things that are only
theoretical until something actually hits the network.

Never prints the key.
"""

from __future__ import annotations

import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

from vision import make_vision_client  # noqa: E402  (needs env loaded first)

CROP = (
    Path(__file__).resolve().parents[2]
    / "public"
    / "dev-repairs"
    / "crops"
    / "Alabama_beat1.png"
)


async def main() -> int:
    for name in ("GEMINI_API_KEY", "ANTHROPIC_API_KEY"):
        value = os.environ.get(name)
        print(f"{name}: {'set (' + str(len(value)) + ' chars)' if value else 'not set'}")

    if not CROP.is_file():
        print(f"\nNo crop at {CROP}", file=sys.stderr)
        return 1

    try:
        client = make_vision_client()
    except RuntimeError as exc:
        print(f"\nprovider setup failed: {exc}", file=sys.stderr)
        return 1

    print(f"\nprovider: {client.provider}\nmodel:    {client.model}")

    image_b64 = base64.b64encode(CROP.read_bytes()).decode("ascii")
    prompt = (
        "This is one frame of a basketball play diagram. In one short sentence, say how "
        "many numbered player markers you can see and whether any arrows are drawn."
    )

    try:
        result = await client.describe(image_b64=image_b64, prompt=prompt)
    except Exception as exc:  # noqa: BLE001 - surfacing whatever the SDK raised
        print(f"\ncall failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print(f"\ntokens:   in={result.input_tokens} out={result.output_tokens}")
    print(f"reply:    {result.text.strip()[:400]}")

    # The real pipeline asks for strict JSON. Prove that path too, not just prose.
    json_prompt = (
        "Return strict JSON, no prose and no markdown fences, shaped exactly as "
        '{"players": <number of numbered markers you can see>, '
        '"arrows": <number of arrows you can see>}'
    )
    try:
        shaped = await client.describe(
            image_b64=image_b64, prompt=json_prompt, json_only=True
        )
    except Exception as exc:  # noqa: BLE001
        print(f"\njson-mode call failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    import json

    try:
        parsed = json.loads(shaped.text)
    except json.JSONDecodeError as exc:
        print(f"\njson mode returned unparseable text: {exc}", file=sys.stderr)
        print(shaped.text[:400], file=sys.stderr)
        return 1

    print(f"json:     {parsed}")
    print("\nOK — the provider is wired up, prose and JSON both.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
