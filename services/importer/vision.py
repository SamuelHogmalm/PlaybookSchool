"""Vision provider abstraction for stage 2.

The interpret pipeline needs one thing from a model: hand it a PNG and a prompt, get
back text and a token count. Everything else — the skill document, the prompt template,
JSON parsing, normalisation, review flagging — is provider-agnostic and stays that way.

Keeping the seam this narrow is what makes an honest comparison possible: the same crops
and the same skill file can be run through two models and the outputs diffed, which is
what MASTER-BUILD-PLAN.md asks for before any interpretation change ships.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Any, NamedTuple, Protocol

logger = logging.getLogger(__name__)


class VisionResult(NamedTuple):
    text: str
    input_tokens: int
    output_tokens: int


class VisionClient(Protocol):
    """One image, one prompt, one block of text back.

    `json_only` asks the provider to guarantee parseable JSON where it can. It is a hint,
    not a contract — the caller still parses defensively, because one provider honouring
    it is not a reason for the pipeline to assume both do.
    """

    provider: str
    model: str

    async def describe(
        self, *, image_b64: str, prompt: str, json_only: bool = False
    ) -> VisionResult: ...


def _int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


class AnthropicVision:
    provider = "anthropic"

    DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key)
        self.model = model or os.environ.get("ANTHROPIC_MODEL", self.DEFAULT_MODEL)

    async def describe(
        self, *, image_b64: str, prompt: str, json_only: bool = False
    ) -> VisionResult:
        # Anthropic has no response-format switch here; the prompt already demands
        # strict JSON and `parse_model_json` strips fences if one slips through.
        del json_only
        message = await self._client.messages.create(
            model=self.model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        text = "".join(block.text for block in message.content if block.type == "text")
        return VisionResult(
            text=text,
            input_tokens=_int(getattr(message.usage, "input_tokens", 0)),
            output_tokens=_int(getattr(message.usage, "output_tokens", 0)),
        )


class GeminiVision:
    provider = "gemini"

    # Override with GEMINI_MODEL if this id is not available on the account.
    DEFAULT_MODEL = "gemini-2.5-pro"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        try:
            from google import genai
        except ImportError as exc:  # pragma: no cover - environment problem
            raise RuntimeError(
                "google-genai is not installed. Run: pip install -r requirements.txt"
            ) from exc

        self._genai = genai
        self._client = genai.Client(api_key=api_key)
        self.model = model or os.environ.get("GEMINI_MODEL", self.DEFAULT_MODEL)

    async def describe(
        self, *, image_b64: str, prompt: str, json_only: bool = False
    ) -> VisionResult:
        from google.genai import types

        config = types.GenerateContentConfig(
            # We never want tool calls here; leaving it on makes the SDK log an
            # advisory on every single frame.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True,
            ),
            # Gemini can guarantee the shape rather than being asked nicely for it.
            response_mime_type="application/json" if json_only else None,
        )

        response = await self._client.aio.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_bytes(
                    data=base64.b64decode(image_b64),
                    mime_type="image/png",
                ),
                prompt,
            ],
            config=config,
        )

        usage = getattr(response, "usage_metadata", None)
        return VisionResult(
            text=response.text or "",
            input_tokens=_int(getattr(usage, "prompt_token_count", 0)),
            output_tokens=_int(getattr(usage, "candidates_token_count", 0)),
        )


def make_vision_client(
    *,
    provider: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> VisionClient:
    """Pick a provider.

    Explicit argument wins, then IMPORT_VISION_PROVIDER, then whichever key is present.
    Gemini is preferred when both are configured, on the assumption that a deliberately
    set GEMINI_API_KEY is the more recent decision.
    """
    chosen = (provider or os.environ.get("IMPORT_VISION_PROVIDER") or "").strip().lower()

    if not chosen:
        if os.environ.get("GEMINI_API_KEY"):
            chosen = "gemini"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            chosen = "anthropic"
        else:
            raise RuntimeError(
                "No vision key found. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in "
                "services/importer/.env"
            )

    if chosen == "gemini":
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("IMPORT_VISION_PROVIDER=gemini but GEMINI_API_KEY is not set")
        client = GeminiVision(key, model)
    elif chosen == "anthropic":
        key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError(
                "IMPORT_VISION_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set"
            )
        client = AnthropicVision(key, model)
    else:
        raise RuntimeError(
            f"Unknown vision provider {chosen!r}. Use 'gemini' or 'anthropic'."
        )

    logger.info("vision provider=%s model=%s", client.provider, client.model)
    return client
