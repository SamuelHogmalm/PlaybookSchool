#!/usr/bin/env python3
"""Apply review flags to seed plays (holder cuts, pass+cut conflicts)."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

from derive import flag_holder_cuts, flag_pass_and_cut  # noqa: E402

SEED = ROOT / "src" / "data" / "plays-interpreted.json"


def main() -> None:
    plays = json.loads(SEED.read_text(encoding="utf-8"))
    holder = []
    pass_cut = []
    for play in plays:
        beats = play.get("beats") or []
        holder.extend(flag_holder_cuts(beats))
        pass_cut.extend(flag_pass_and_cut(beats))

    SEED.write_text(json.dumps(plays, indent=1) + "\n", encoding="utf-8")
    print(f"Holder-cut flags: {len(holder)}")
    print(f"Pass+cut flags: {len(pass_cut)}")


if __name__ == "__main__":
    main()
