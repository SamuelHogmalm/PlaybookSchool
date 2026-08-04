#!/usr/bin/env python3
"""Generate play-level breakdowns for all plays in plays-interpreted.json.

Usage (from services/importer):
  python run_breakdown_all.py

Writes src/data/plays-breakdowns.json (map of play name -> breakdown).
Requires ANTHROPIC_API_KEY in .env.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parent))

from breakdown import breakdown_plays  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PLAYS_PATH = ROOT / "src" / "data" / "plays-interpreted.json"
OUT_PATH = ROOT / "src" / "data" / "plays-breakdowns.json"


async def main() -> None:
    plays = json.loads(PLAYS_PATH.read_text(encoding="utf-8"))
    existing: dict[str, Any] = {}
    if OUT_PATH.is_file():
        try:
            existing = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = {}

    def save_partial(_name: str, _data: dict, all_bd: dict) -> None:
        merged = {**existing, **all_bd}
        OUT_PATH.write_text(json.dumps(merged, indent=1), encoding="utf-8")

    pending = [p for p in plays if p.get("name") not in existing]
    print(f"Breaking down {len(pending)} plays ({len(existing)} already saved)…", file=sys.stderr)

    if not pending:
        print(f"All {len(existing)} breakdowns already in {OUT_PATH}", file=sys.stderr)
        return

    result = await breakdown_plays(pending, crops={}, on_complete=save_partial)
    merged = {**existing, **result["breakdowns"]}
    OUT_PATH.write_text(json.dumps(merged, indent=1), encoding="utf-8")
    print(f"Wrote {len(merged)} breakdowns to {OUT_PATH}", file=sys.stderr)
    print(json.dumps({"usage": result["usage"], "model": result["model"]}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
