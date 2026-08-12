#!/usr/bin/env python3
"""Re-run movement derivation on seed plays (strip prior derived, apply new rules)."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "importer"))

from derive import (  # noqa: E402
    TYPE_ORDER,
    derive_holder_dribbles,
    derive_movement_actions,
    enrich_action_paths,
    flag_holder_cuts,
    flag_pass_and_cut,
)

SEED = ROOT / "src" / "data" / "plays-interpreted.json"


def main() -> None:
    plays = json.loads(SEED.read_text(encoding="utf-8"))
    stripped = 0

    for play in plays:
        for beat in play.get("beats") or []:
            before = len(beat.get("actions") or [])
            beat["actions"] = [
                a for a in (beat.get("actions") or []) if not a.get("derived")
            ]
            stripped += before - len(beat["actions"])

    holder = []
    movement = []
    flagged = []
    pass_cut = []
    for play in plays:
        beats = play.get("beats") or []
        holder.extend(derive_holder_dribbles(beats))
        movement.extend(derive_movement_actions(beats))
        enrich_action_paths(beats)
        flagged.extend(flag_holder_cuts(beats))
        pass_cut.extend(flag_pass_and_cut(beats))
        for beat in beats:
            actions = beat.get("actions") or []
            actions.sort(
                key=lambda a: (TYPE_ORDER.get(str(a.get("type")), 99), str(a.get("id")))
            )
            for j, action in enumerate(actions, 1):
                action["order"] = j

    SEED.write_text(json.dumps(plays, indent=1) + "\n", encoding="utf-8")

    derived_total = sum(
        1
        for play in plays
        for beat in play.get("beats") or []
        for action in beat.get("actions") or []
        if action.get("derived")
    )

    print(f"Stripped {stripped} prior derived actions")
    print(f"New holder dribbles: {len(holder)}")
    print(f"New movement derived: {len(movement)}")
    print(f"Total derived in seed: {derived_total}")
    print(f"Holder-cut flags: {len(flagged)}")
    print(f"Pass+cut flags: {len(pass_cut)}")


if __name__ == "__main__":
    main()
