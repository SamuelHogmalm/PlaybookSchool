#!/usr/bin/env python3
"""Smoke-test stage 2 on a single frame PNG."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from interpret import interpret_one_frame
from anthropic import AsyncAnthropic


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python test_interpret.py <frame.png> [ball_handler]")
        sys.exit(1)

    png_path = Path(sys.argv[1])
    if not png_path.is_file():
        print(f"File not found: {png_path}")
        sys.exit(1)

    ball = sys.argv[2] if len(sys.argv) > 2 else "1"
    beat = {
        "id": "b1",
        "ball": ball,
        "pos": {
            "1": {"x": 250, "y": 353},
            "2": {"x": 454, "y": 224},
            "3": {"x": 39, "y": 211},
            "4": {"x": 337, "y": 81},
            "5": {"x": 157, "y": 87},
        },
    }

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("Set ANTHROPIC_API_KEY in .env")
        sys.exit(1)

    image_b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    client = AsyncAnthropic(api_key=key)
    result, usage = await interpret_one_frame(
        client, image_b64=image_b64, beat=beat, model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    )
    print(json.dumps({"result": result, "usage": usage}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
