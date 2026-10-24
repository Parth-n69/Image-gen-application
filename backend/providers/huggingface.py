"""
Hugging Face Inference provider — text-to-image generation.

Wraps the huggingface_hub InferenceClient to produce PIL images,
which the caller converts to PNG bytes.
"""

import logging
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)


class HuggingFaceError(Exception):
    """Raised for classified Hugging Face API errors."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


def generate(api_key, model_id, prompt, *, negative_prompt="", width=1024, height=1024):
    """
    Call Hugging Face InferenceClient.text_to_image and return a PIL Image.
    Raises HuggingFaceError with a user-friendly message on failure.
    """
    client = InferenceClient(token=api_key)

    try:
        kwargs = {"width": width, "height": height}
        if negative_prompt:
            kwargs["negative_prompt"] = negative_prompt

        try:
            image = client.text_to_image(prompt, model=model_id, **kwargs)
        except Exception:
            # Fallback if model doesn't support width/height/negative_prompt
            image = client.text_to_image(prompt, model=model_id)

    except Exception as exc:
        _classify_error(exc)

    return image


def _classify_error(exc):
    """Re-raise as a user-friendly HuggingFaceError."""
    error_msg = str(exc).lower()

    if "503" in error_msg or "loading" in error_msg:
        raise HuggingFaceError(
            "The model is currently loading. Please try again in 30–60 seconds.",
            code="HF_LOADING",
        ) from exc

    if "403" in error_msg or "permission" in error_msg:
        raise HuggingFaceError(
            "API key does not have sufficient permissions. Please update your token.",
            code="HF_AUTH",
        ) from exc

    if (
        "402" in error_msg
        or "429" in error_msg
        or "payment" in error_msg
        or "credits" in error_msg
        or "quota" in error_msg
    ):
        raise HuggingFaceError(
            "Hugging Face free credits are used up. Use a Cloudflare model.",
            code="HF_CREDITS",
        ) from exc

    if "connect" in error_msg or "resolve" in error_msg:
        raise HuggingFaceError(
            "Could not connect to the Hugging Face API. Check your internet connection.",
            code="HF_NETWORK",
        ) from exc

    logger.error("Hugging Face generation error: %s", str(exc)[:200])
    raise HuggingFaceError(
        "Image generation failed. Please try again.",
        code="HF_ERROR",
    ) from exc
