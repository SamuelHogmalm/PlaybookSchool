"""
FastDraw PDF -> PlayLab play objects.

Stage 1 of the import pipeline. Fully deterministic: no AI, no cost.
Extracts play names, beat sequence, all five player positions per beat,
and which player has the ball.

Stage 2 (arrow interpretation) runs a vision model over the frame crops
this script emits. See extract_frames().
"""

import json
import os
import subprocess
from collections import defaultdict

import pdfplumber

# PlayLab court coordinate system
COURT_W, COURT_H = 500, 470
DIGITS = set("12345")

# FastDraw geometry, in PDF points
COURT_MIN_W, COURT_MAX_W = 130, 150
COURT_MIN_H, COURT_MAX_H = 120, 145
BALL_RING_SIZE = 12.5
BALL_RING_TOL = 2.0


def pdftoppm_bin():
    """Path to pdftoppm — use POPPLER_BIN env if poppler isn't on system PATH."""
    bin_dir = os.environ.get("POPPLER_BIN")
    if bin_dir:
        return os.path.join(bin_dir, "pdftoppm.exe")
    return "pdftoppm"


def find_courts(page):
    """Court boundary = the inner rect of each diagram. Returns them in reading order."""
    rects = [
        r for r in page.rects
        if COURT_MIN_W < (r["x1"] - r["x0"]) < COURT_MAX_W
        and COURT_MIN_H < (r["bottom"] - r["top"]) < COURT_MAX_H
    ]
    out, seen = [], set()
    for r in sorted(rects, key=lambda r: (round(r["top"] / 20), r["x0"])):
        key = (round(r["x0"]), round(r["top"]))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def ball_rings(page):
    """The possession ring is a ~12.5pt circle drawn around the ball handler's number."""
    rings = []
    for c in page.curves:
        w = c["x1"] - c["x0"]
        h = c["bottom"] - c["top"]
        if (abs(w - BALL_RING_SIZE) < BALL_RING_TOL
                and abs(h - BALL_RING_SIZE) < BALL_RING_TOL):
            rings.append(((c["x0"] + c["x1"]) / 2, (c["top"] + c["bottom"]) / 2))
    return rings


def parse_page(page):
    """Return a list of beat dicts for one page."""
    courts = find_courts(page)
    words = page.extract_words()
    rings = ball_rings(page)
    titles = [w for w in words if w["text"] not in DIGITS and w["text"] != "PLAY"]
    beats = []

    for r in courts:
        x0, x1, y0, y1 = r["x0"], r["x1"], r["top"], r["bottom"]
        pos, raw = {}, {}

        for w in words:
            if w["text"] not in DIGITS:
                continue
            cx = (w["x0"] + w["x1"]) / 2
            cy = (w["top"] + w["bottom"]) / 2
            # margin: players are sometimes drawn on or just outside the line
            if x0 - 14 <= cx <= x1 + 14 and y0 - 14 <= cy <= y1 + 14:
                raw[w["text"]] = (cx, cy)
                pos[w["text"]] = {
                    "x": max(12, min(COURT_W - 12, round((cx - x0) / (x1 - x0) * COURT_W))),
                    "y": max(12, min(COURT_H - 12, round((cy - y0) / (y1 - y0) * COURT_H))),
                }

        # ball = digit nearest a possession ring inside this court
        ball = None
        best = 999
        for rx, ry in rings:
            if not (x0 - 14 <= rx <= x1 + 14 and y0 - 14 <= ry <= y1 + 14):
                continue
            for pid, (cx, cy) in raw.items():
                d = ((cx - rx) ** 2 + (cy - ry) ** 2) ** 0.5
                if d < best:
                    best, ball = d, pid

        cand = [t for t in titles
                if t["bottom"] < y0 and abs((t["x0"] + t["x1"]) / 2 - (x0 + x1) / 2) < 90]
        name = sorted(cand, key=lambda t: y0 - t["bottom"])[0]["text"] if cand else "Untitled"

        beats.append({
            "play": name,
            "pos": pos,
            "startBall": ball,
            "page": page.page_number,
            "bbox": [x0, y0, x1, y1],
        })
    return beats


def parse(pdf_path):
    """Full PDF -> list of Play objects with beats. Actions are left empty for stage 2."""
    with pdfplumber.open(pdf_path) as pdf:
        raw = []
        for page in pdf.pages:
            raw += parse_page(page)

    plays, order = defaultdict(list), []
    for b in raw:
        if b["play"] not in plays:
            order.append(b["play"])
        plays[b["play"]].append(b)

    out = []
    for name in order:
        frames = plays[name]
        beats = []
        for i, b in enumerate(frames):
            start_pos = b["pos"]
            end_pos = frames[i + 1]["pos"] if i + 1 < len(frames) else start_pos
            beats.append({
                "id": f"b{i+1}",
                "startPos": start_pos,
                "pos": end_pos,
                "startBall": b["startBall"] or "1",
                "actions": [],          # stage 2 fills this
                "note": "",             # stage 2 fills this
                "_source": {"page": b["page"], "bbox": b["bbox"]},
            })
        out.append({
            "name": name,
            "category": "Set",
            "beats": beats,
            "counters": [],
        })
    return out


def extract_frames(pdf_path, plays, outdir, dpi=200):
    """Crop each beat to its own PNG for the stage-2 vision pass."""
    os.makedirs(outdir, exist_ok=True)
    scale = dpi / 72.0
    pages = {}
    subprocess.run(
        [pdftoppm_bin(), "-png", "-r", str(dpi), pdf_path, os.path.join(outdir, "pg")],
        check=True,
    )
    from PIL import Image
    for f in os.listdir(outdir):
        if f.startswith("pg-") and f.endswith(".png"):
            pages[int(f.split("-")[1].split(".")[0])] = Image.open(os.path.join(outdir, f))

    made = []
    for p in plays:
        for i, beat in enumerate(p["beats"]):
            src = beat["_source"]
            x0, y0, x1, y1 = src["bbox"]
            pad = 16 * scale
            img = pages[src["page"]]
            crop = img.crop((
                max(0, int(x0 * scale - pad)),
                max(0, int(y0 * scale - pad)),
                min(img.width, int(x1 * scale + pad)),
                min(img.height, int(y1 * scale + pad)),
            ))
            safe = "".join(ch for ch in p["name"] if ch.isalnum() or ch in "-_")
            path = os.path.join(outdir, f"{safe}_beat{i+1}.png")
            crop.save(path)
            made.append(path)
    for f in os.listdir(outdir):
        if f.startswith("pg-"):
            os.remove(os.path.join(outdir, f))
    return made


if __name__ == "__main__":
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/2024-25_plays.pdf"
    plays = parse(src)
    print(f"{len(plays)} plays, {sum(len(p['beats']) for p in plays)} beats")
    for p in plays:
        starts = "".join(b["startBall"] for b in p["beats"])
        print(f"  {p['name']:<18} {len(p['beats'])} beats   startBall sequence: {starts}")
    frames = extract_frames(src, plays, "/home/claude/frames")
    print(f"\n{len(frames)} frame crops written")
    with open("/home/claude/plays.json", "w") as f:
        json.dump(plays, f, indent=1)
