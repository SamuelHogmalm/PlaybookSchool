"""
PlayLab import service — FastDraw PDF parsing + vision interpretation.

Run locally:
  cd services/importer
  pip install -r requirements.txt
  cp .env.example .env   # add ANTHROPIC_API_KEY + POPPLER_BIN
  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from typing import Any

from dotenv import load_dotenv

load_dotenv()

import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from crops import extract_crops_base64
from interpret import interpret_plays
from parser import parse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 100

app = FastAPI(title="PlayLab Importer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InterpretRequest(BaseModel):
    plays: list[dict[str, Any]]
    crops: dict[str, str] = Field(description="Base64 PNG crops keyed by PlayName_beatN")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "anthropic_configured": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }


@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, detail={"error": "invalid_file", "message": "Upload a PDF file."})

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            400,
            detail={
                "error": "file_too_large",
                "message": f"PDF must be under {MAX_BYTES // (1024 * 1024)}MB.",
            },
        )

    tmpdir = tempfile.mkdtemp(prefix="playlab-parse-")
    pdf_path = os.path.join(tmpdir, "upload.pdf")
    try:
        with open(pdf_path, "wb") as f:
            f.write(content)

        with pdfplumber.open(pdf_path) as pdf:
            page_count = len(pdf.pages)
            if page_count == 0:
                raise HTTPException(400, detail={"error": "empty_pdf", "message": "PDF has no pages."})
            if page_count > MAX_PAGES:
                raise HTTPException(
                    400,
                    detail={
                        "error": "too_many_pages",
                        "message": f"PDF has {page_count} pages (max {MAX_PAGES}).",
                    },
                )

        plays = parse(pdf_path)
        beat_count = sum(len(p.get("beats", [])) for p in plays)
        has_positions = any(
            b.get("pos") for p in plays for b in p.get("beats", [])
        )

        if not plays or not has_positions:
            raise HTTPException(
                422,
                detail={
                    "error": "unsupported_format",
                    "message": "No FastDraw court diagrams detected. Export from FastDraw as PDF.",
                },
            )

        crops: dict[str, str] = {}
        crop_warning = None
        try:
            crops = extract_crops_base64(pdf_path, plays, os.path.join(tmpdir, "frames"))
        except FileNotFoundError as exc:
            crop_warning = (
                "Frame crops skipped — poppler not found. Install poppler and add pdftoppm to PATH "
                "for AI arrow reading."
            )
            logger.warning("poppler missing: %s", exc)
        except subprocess.CalledProcessError as exc:
            crop_warning = "Frame crops failed — check poppler installation."
            logger.warning("pdftoppm failed: %s", exc)

        return {
            "plays": plays,
            "crops": crops,
            "meta": {
                "play_count": len(plays),
                "beat_count": beat_count,
                "page_count": page_count,
                "filename": file.filename,
                "crop_warning": crop_warning,
            },
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@app.post("/interpret")
async def interpret(body: InterpretRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            503,
            detail={
                "error": "ai_not_configured",
                "message": "Set ANTHROPIC_API_KEY on the importer service.",
            },
        )

    if not body.plays:
        raise HTTPException(400, detail={"error": "no_plays", "message": "plays array is required."})

    # Work on a copy so callers' data is not mutated in place unexpectedly
    import copy

    plays_copy = copy.deepcopy(body.plays)

    try:
        result = await interpret_plays(plays_copy, body.crops)
    except RuntimeError as exc:
        raise HTTPException(503, detail={"error": "ai_not_configured", "message": str(exc)}) from exc
    except Exception as exc:
        logger.exception("interpret failed")
        raise HTTPException(500, detail={"error": "interpret_failed", "message": str(exc)}) from exc

    return result
