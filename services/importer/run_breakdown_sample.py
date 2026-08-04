#!/usr/bin/env python3
"""Run play breakdown on Conn, Alabama, Horns — prints raw JSON to stdout.

Usage (from services/importer):
  python run_breakdown_sample.py

Requires ANTHROPIC_API_KEY in .env. Crops optional — text-only if missing.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from breakdown import breakdown_plays  # noqa: E402

PLAYS_PATH = ROOT / "src" / "data" / "plays-interpreted.json"
TARGET = {"Conn", "Alabama", "Horns"}


async def main() -> None:
    plays = json.loads(PLAYS_PATH.read_text(encoding="utf-8"))
    subset = [p for p in plays if p.get("name") in TARGET]
    if not subset:
        print("No target plays found.", file=sys.stderr)
        sys.exit(1)

    result = await breakdown_plays(subset, crops={}, play_names=list(TARGET))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
