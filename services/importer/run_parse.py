"""Quick local parse test — no poppler needed for positions."""

import json
import sys
from parser import parse

pdf = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\samue\Downloads\2024-25 plays.pdf"
plays = parse(pdf)
beats = sum(len(p["beats"]) for p in plays)
print(f"OK: {len(plays)} plays, {beats} beats")
for p in plays:
    balls = "".join(b["ball"] for b in p["beats"])
    print(f"  {p['name']:<20} {len(p['beats'])} beats  ball: {balls}")

out = "test-parse-output.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump({"plays": plays, "meta": {"play_count": len(plays), "beat_count": beats}}, f, indent=1)
print(f"Saved {out}")
