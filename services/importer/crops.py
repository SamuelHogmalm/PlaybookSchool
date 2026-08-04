"""Helpers for stage-1 frame crops."""

from __future__ import annotations

import base64
import os

from interpret import crop_key
from parser import extract_frames


def encode_crops_from_dir(plays: list[dict], outdir: str) -> dict[str, str]:
    crops: dict[str, str] = {}
    for play in plays:
        for i in range(len(play.get("beats", []))):
            key = crop_key(play["name"], i)
            path = os.path.join(outdir, f"{key}.png")
            if not os.path.isfile(path):
                continue
            with open(path, "rb") as f:
                crops[key] = base64.b64encode(f.read()).decode("ascii")
    return crops


def extract_crops_base64(pdf_path: str, plays: list[dict], outdir: str) -> dict[str, str]:
    extract_frames(pdf_path, plays, outdir)
    return encode_crops_from_dir(plays, outdir)
