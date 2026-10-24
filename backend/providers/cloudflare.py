"""
Cloudflare Workers AI provider — text-to-image generation.

Supports two models:
  - FLUX.1 Schnell  (@cf/black-forest-labs/flux-1-schnell)
  - SDXL Lightning  (@cf/bytedance/stable-diffusion-xl-lightning)

Both return JSON with a base64-encoded image field.
"""

import logging
import time
import base64
import requests

logger = logging.getLogger(__name__)

# Timeout for each request (seconds)
_TIMEOUT = 60
_MAX_RETRIES = 1


class CloudflareError(Exception):
    """Raised for classified Cloudflare API errors."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


def generate(
    account_id: str,
    api_token: str,
    model_id: str,
    prompt: str,
    *,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
    steps: int = 4,
    supports_negative_prompt: bool = False,
    supports_dimensions: bool = False,
):
    """
    Call Cloudflare Workers AI REST endpoint and return PNG bytes.

    Handles both JSON-base64 and binary-PNG response formats.
    Retries once on 5xx or timeout.
    """
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/ai/run/{model_id}"
    )

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    payload = {"prompt": prompt}

    # Schnell uses `steps`; SDXL Lightning uses `num_steps`
    if "flux-1-schnell" in model_id:
        payload["steps"] = min(max(steps, 1), 8)
    else:
        payload["num_steps"] = min(max(steps, 1), 20)

    if supports_negative_prompt and negative_prompt:
        payload["negative_prompt"] = negative_prompt

    if supports_dimensions:
        payload["width"] = width
        payload["height"] = height

    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
            break
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                logger.warning("Cloudflare request timeout/error, retrying… (%s)", exc)
                time.sleep(1)
                continue
            raise CloudflareError(
                "Cloudflare API timed out. Please try again.", code="TIMEOUT"
            ) from exc
    else:
        raise CloudflareError(
            "Cloudflare API timed out after retries.", code="TIMEOUT"
        ) from last_exc

    # ── Retry on 5xx ──
    if resp.status_code >= 500 and attempt < _MAX_RETRIES:
        logger.warning("Cloudflare 5xx (%d), retrying once…", resp.status_code)
        time.sleep(1)
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise CloudflareError(
                "Cloudflare API timed out on retry.", code="TIMEOUT"
            ) from exc

    # ── Classify errors ──
    _classify_error(resp)

    # ── Parse response ──
    return _extract_png(resp)


def _classify_error(resp):
    """Raise a user-friendly CloudflareError based on HTTP status & body."""
    if resp.ok:
        return

    status = resp.status_code
    try:
        body = resp.json()
    except Exception:
        body = {}

    error_text = str(body).lower()

    # 429 or neuron/quota message → daily limit
    if status == 429 or "neuron" in error_text or "quota" in error_text:
        raise CloudflareError(
            "Daily free allowance reached. It resets daily. "
            "Try another provider or come back tomorrow.",
            code="CF_QUOTA",
        )

    # 401 / 403 → bad credentials
    if status in (401, 403):
        raise CloudflareError(
            "Cloudflare credentials are invalid. Check backend/.env.",
            code="CF_AUTH",
        )

    # 400 with "input tensor" → img2img not supported on this endpoint
    if status == 400 and ("input tensor" in error_text or "3030" in error_text):
        raise CloudflareError(
            "Image-to-image is not available on this model via the REST API. "
            "Use the basic tools or Restyle instead.",
            code="CF_IMG2IMG_UNSUPPORTED",
        )

    # Generic server error
    logger.error(
        "Cloudflare API error status=%d body=%s",
        status,
        resp.text[:300],
    )
    raise CloudflareError(
        f"Image generation failed (Cloudflare {status}). Please try again.",
        code="CF_ERROR",
    )


def _extract_png(resp):
    """
    Extract PNG bytes from a Cloudflare response.

    FLUX Schnell returns JSON: { "result": { "image": "<base64>" } }
    SDXL Lightning returns raw binary PNG.
    """
    content_type = resp.headers.get("Content-Type", "")

    # JSON response (FLUX Schnell)
    if "json" in content_type or "application/json" in content_type:
        data = resp.json()
        # Handle both {"result":{"image":"..."}} and {"image":"..."} shapes
        img_b64 = None
        if isinstance(data, dict):
            result = data.get("result") or data
            if isinstance(result, dict):
                img_b64 = result.get("image")
        if not img_b64:
            raise CloudflareError("No image in Cloudflare response.", code="CF_ERROR")
        return base64.b64decode(img_b64)

    # Binary response (SDXL Lightning or any raw image)
    if resp.content and len(resp.content) > 100:
        return resp.content

    raise CloudflareError("Empty image response from Cloudflare.", code="CF_ERROR")


# ── Image-to-Image Restyle ────────────────────────────────────
_RESTYLE_MODEL = "@cf/bytedance/stable-diffusion-xl-lightning"


def restyle(
    account_id: str,
    api_token: str,
    prompt: str,
    image_b64: str,
    *,
    strength: float = 0.75,
    negative_prompt: str = "",
    num_steps: int = 8,
):
    """
    Restyle an image using SDXL Lightning img2img on Cloudflare.

    Parameters
    ----------
    image_b64 : str
        Base64-encoded PNG/JPEG bytes (no data-URI prefix).
    strength  : float
        Transformation strength 0.0 – 1.0  (higher = more change).
    """
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/ai/run/{_RESTYLE_MODEL}"
    )

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "image_b64": image_b64,
        "strength": max(0.0, min(1.0, strength)),
        "num_steps": min(max(num_steps, 1), 20),
    }

    if negative_prompt:
        payload["negative_prompt"] = negative_prompt

    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
            break
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                logger.warning("Cloudflare restyle timeout/error, retrying… (%s)", exc)
                time.sleep(1)
                continue
            raise CloudflareError(
                "Cloudflare API timed out. Please try again.", code="TIMEOUT"
            ) from exc
    else:
        raise CloudflareError(
            "Cloudflare API timed out after retries.", code="TIMEOUT"
        ) from last_exc

    if resp.status_code >= 500 and attempt < _MAX_RETRIES:
        logger.warning("Cloudflare restyle 5xx (%d), retrying once…", resp.status_code)
        time.sleep(1)
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise CloudflareError(
                "Cloudflare API timed out on retry.", code="TIMEOUT"
            ) from exc

    _classify_error(resp)
    return _extract_png(resp)
