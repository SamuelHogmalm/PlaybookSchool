import json
from pathlib import Path

plays = json.loads(Path("src/data/plays-interpreted.json").read_text())
al = next(p for p in plays if p["name"] == "Alabama")
b1, b2 = al["beats"][0], al["beats"][1]
print("=== Alabama beat 2 ===")
print("actions:", len(b2["actions"]))
for a in b2["actions"]:
    path = a.get("path") or []
    print(
        f"  {a['id']} {a['type']:6} by={a['by']} for={a.get('for','-'):1} "
        f"path_pts={len(path)} derived={a.get('derived', False)}"
    )

print("\n=== RepairBeatSvg render count (1 path per action with from+to) ===")
start_pos = b1["pos"]
rendered = 0
for a in b2["actions"]:
    from_p = (a.get("path") or [None])[0] or start_pos.get(a["by"])
    if a["type"] in ("pass", "handoff"):
        to_p = (a.get("path") or [None])[-1] or b2["pos"].get(a.get("for"))
    else:
        to_p = (a.get("path") or [None])[-1] or b2["pos"].get(a["by"])
    if from_p and to_p:
        rendered += 1
        segs = max(1, len(a.get("path") or []) - 1)
        print(f"  {a['id']}: 1 SVG path, {segs} segment(s), arrowheads=1")

print(f"total SVG paths: {rendered}")

print("\n=== Split paths (>2 points) across seed ===")
multi = []
for p in plays:
    for b in p["beats"]:
        for a in b.get("actions") or []:
            path = a.get("path") or []
            if len(path) > 2:
                multi.append((p["name"], b["id"], a["id"], a["type"], len(path)))
print(f"count: {len(multi)}")
for row in multi[:8]:
    print(" ", row)
