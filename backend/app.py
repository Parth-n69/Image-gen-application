import os
import base64
import io
import logging
from PIL import Image
from datetime import date
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

from models_config import (
    CLOUDFLARE_MODELS,
    HUGGINGFACE_MODELS,
    EDIT_MODELS,
    DEFAULT_MODEL,
)
from providers import cloudflare as cf_provider
from providers import huggingface as hf_provider

load_dotenv()

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pixabel")

app = Flask(__name__)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
prod_origin = os.getenv("FRONTEND_URL")
if prod_origin:
    allowed_origins.extend([u.strip() for u in prod_origin.split(",") if u.strip()])

CORS(app, origins=allowed_origins)

# ── Provider credentials ──────────────────────────────────────
HF_API_KEY = os.getenv("HF_API_KEY")
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")

# ── Build available model list (hide unconfigured providers) ──
def _build_model_list():
    """Merge Cloudflare and HuggingFace models, hiding those whose keys are missing."""
    models = {}
    if CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN:
        models.update(CLOUDFLARE_MODELS)
    if HF_API_KEY:
        models.update(HUGGINGFACE_MODELS)
    return models


ALL_MODELS = _build_model_list()

# ── Daily rate-limiting config ─────────────────────────────────
DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "20"))

# Per-user Cloudflare-specific limits (configurable)
CF_DAILY_LIMIT = int(os.getenv("CF_DAILY_LIMIT", "20"))
CF_PER_MINUTE = int(os.getenv("CF_PER_MINUTE", "5"))

# In-memory store: { "ip_address": { "date": "YYYY-MM-DD", "count": int,
#                                      "cf_count": int, "cf_minute_log": [timestamps] } }
usage_tracker = {}


def _get_usage(ip):
    """Return the usage record for an IP, resetting if the date has changed."""
    today = date.today().isoformat()
    record = usage_tracker.get(ip)

    if record is None or record["date"] != today:
        usage_tracker[ip] = {
            "date": today,
            "count": 0,
            "cf_count": 0,
            "cf_minute_log": [],
        }

    return usage_tracker[ip]


import time as _time


def _check_cf_rate(record):
    """
    Check Cloudflare per-user rate limits.
    Returns (ok: bool, message: str | None).
    """
    if record["cf_count"] >= CF_DAILY_LIMIT:
        return False, (
            f"You've reached the Cloudflare daily limit ({CF_DAILY_LIMIT} images). "
            "Try a Hugging Face model or come back tomorrow."
        )

    now = _time.time()
    # Prune entries older than 60 seconds
    record["cf_minute_log"] = [t for t in record["cf_minute_log"] if now - t < 60]
    if len(record["cf_minute_log"]) >= CF_PER_MINUTE:
        return False, (
            f"Rate limited: max {CF_PER_MINUTE} Cloudflare images per minute. "
            "Please wait a moment."
        )

    return True, None


# ── Resolve effective default model ───────────────────────────
def _effective_default():
    """Return the best default model key from available models."""
    if DEFAULT_MODEL in ALL_MODELS:
        return DEFAULT_MODEL
    # Fallback to first available
    if ALL_MODELS:
        return next(iter(ALL_MODELS))
    return None


@app.route("/status", methods=["GET"])
def get_status():
    """Return the remaining daily credits for the requesting IP."""
    ip = request.remote_addr
    record = _get_usage(ip)
    remaining = max(0, DAILY_LIMIT - record["count"])
    cf_remaining = max(0, CF_DAILY_LIMIT - record["cf_count"])

    return jsonify({
        "daily_limit": DAILY_LIMIT,
        "used": record["count"],
        "remaining": remaining,
        "cf_daily_limit": CF_DAILY_LIMIT,
        "cf_remaining": cf_remaining,
        "models": list(ALL_MODELS.keys()),
        "default_model": _effective_default(),
    }), 200


@app.route("/models", methods=["GET"])
def list_models():
    """Return the full model list with metadata for the frontend model picker."""
    models_list = []
    for key, cfg in ALL_MODELS.items():
        models_list.append({
            "key": key,
            "name": cfg["name"],
            "desc": cfg["desc"],
            "badge": cfg["badge"],
            "badge_class": cfg["badge_class"],
            "icon": cfg["icon"],
            "provider": cfg["provider"],
            "supports_negative_prompt": cfg.get("supports_negative_prompt", True),
            "supports_dimensions": cfg.get("supports_dimensions", True),
            "note": cfg.get("note"),
        })

    ip = request.remote_addr
    record = _get_usage(ip)

    return jsonify({
        "models": models_list,
        "default": _effective_default(),
        "cf_remaining": max(0, CF_DAILY_LIMIT - record["cf_count"]),
        "cf_daily_limit": CF_DAILY_LIMIT,
    }), 200


@app.route("/generate", methods=["POST"])
def generate_image():
    """Generate an image from a text prompt using the selected provider & model."""

    ip = request.remote_addr
    record = _get_usage(ip)

    # ── Check global daily limit ──────────────────────────────
    if record["count"] >= DAILY_LIMIT:
        return jsonify({
            "error": (
                f"Your daily token has expired. You have used all {DAILY_LIMIT} "
                "free image generations for today. Please try again tomorrow."
            ),
            "code": "TOKEN_EXPIRED",
            "remaining": 0,
        }), 429

    # ── Validate request body ──────────────────────────────────
    data = request.get_json(silent=True)
    if not data or not data.get("prompt", "").strip():
        return jsonify({"error": "Prompt is required and cannot be empty."}), 400

    prompt = data["prompt"].strip()

    # ── Validate model selection ───────────────────────────────
    model_key = data.get("model", _effective_default() or "").strip()
    if model_key not in ALL_MODELS:
        return jsonify({
            "error": f"Invalid model '{model_key}'. Available models: {', '.join(ALL_MODELS.keys())}",
            "available_models": list(ALL_MODELS.keys()),
        }), 400

    model_cfg = ALL_MODELS[model_key]
    provider = model_cfg["provider"]

    # ── Extract parameters ─────────────────────────────────────
    negative_prompt = data.get("negative_prompt", "").strip()

    try:
        width = int(data.get("width", 1024))
    except (ValueError, TypeError):
        width = 1024

    try:
        height = int(data.get("height", 1024))
    except (ValueError, TypeError):
        height = 1024

    if not (256 <= width <= 2048):
        return jsonify({"error": "width must be between 256 and 2048"}), 400
    if not (256 <= height <= 2048):
        return jsonify({"error": "height must be between 256 and 2048"}), 400

    # Build response note for unsupported features
    note = None

    # ── CLOUDFLARE PROVIDER ────────────────────────────────────
    if provider == "cloudflare":
        if not CLOUDFLARE_ACCOUNT_ID or not CLOUDFLARE_API_TOKEN:
            return jsonify({"error": "Cloudflare credentials are not configured."}), 500

        # Check per-user CF rate limits
        ok, msg = _check_cf_rate(record)
        if not ok:
            return jsonify({"error": msg, "code": "CF_RATE_LIMIT"}), 429

        # Set note if model doesn't support certain features
        if not model_cfg.get("supports_dimensions") and (width != 1024 or height != 1024):
            note = model_cfg.get("note")
        if not model_cfg.get("supports_negative_prompt") and negative_prompt:
            note = note or model_cfg.get("note") or "This model does not support negative prompts."

        try:
            img_bytes = cf_provider.generate(
                account_id=CLOUDFLARE_ACCOUNT_ID,
                api_token=CLOUDFLARE_API_TOKEN,
                model_id=model_cfg["model_id"],
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                steps=model_cfg.get("default_steps", 4),
                supports_negative_prompt=model_cfg.get("supports_negative_prompt", False),
                supports_dimensions=model_cfg.get("supports_dimensions", False),
            )
        except cf_provider.CloudflareError as exc:
            logger.warning("Cloudflare generation failed: %s (code=%s)", str(exc)[:120], exc.code)
            status_map = {
                "CF_QUOTA": 429,
                "CF_AUTH": 401,
                "TIMEOUT": 504,
            }
            return jsonify({
                "error": str(exc),
                "code": exc.code,
            }), status_map.get(exc.code, 500)

        # Encode to base64
        b64_string = base64.b64encode(img_bytes).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_string}"

        # Increment usage
        record["count"] += 1
        record["cf_count"] += 1
        record["cf_minute_log"].append(_time.time())

        remaining = max(0, DAILY_LIMIT - record["count"])
        cf_remaining = max(0, CF_DAILY_LIMIT - record["cf_count"])

        response_data = {
            "image": data_uri,
            "remaining": remaining,
            "daily_limit": DAILY_LIMIT,
            "cf_remaining": cf_remaining,
            "cf_daily_limit": CF_DAILY_LIMIT,
            "model": model_key,
        }
        if note:
            response_data["note"] = note

        return jsonify(response_data), 200

    # ── HUGGING FACE PROVIDER ──────────────────────────────────
    elif provider == "huggingface":
        if not HF_API_KEY:
            return jsonify({"error": "Hugging Face API key is not configured."}), 500

        try:
            image = hf_provider.generate(
                api_key=HF_API_KEY,
                model_id=model_cfg["model_id"],
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
            )
        except hf_provider.HuggingFaceError as exc:
            logger.warning("HF generation failed: %s (code=%s)", str(exc)[:120], exc.code)
            status_map = {
                "HF_LOADING": 504,
                "HF_AUTH": 403,
                "HF_CREDITS": 402,
                "HF_NETWORK": 502,
            }
            return jsonify({
                "error": str(exc),
                "code": exc.code,
            }), status_map.get(exc.code, 500)

        # Encode to base64
        try:
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            buf.seek(0)
            b64_string = base64.b64encode(buf.read()).decode("utf-8")
            data_uri = f"data:image/png;base64,{b64_string}"
        except Exception as exc:
            return jsonify({"error": f"Failed to process the generated image: {str(exc)}"}), 500

        # Increment usage
        record["count"] += 1
        remaining = max(0, DAILY_LIMIT - record["count"])

        return jsonify({
            "image": data_uri,
            "remaining": remaining,
            "daily_limit": DAILY_LIMIT,
            "model": model_key,
        }), 200

    else:
        return jsonify({"error": f"Unknown provider '{provider}'."}), 500


@app.route("/edit", methods=["POST"])
def edit_image():
    """Edit an image using HF Inference API with provider routing."""
    data = request.get_json(silent=True)
    if not data or not data.get("prompt", "").strip():
        return jsonify({"error": "Prompt is required and cannot be empty."}), 400
    if not data.get("image"):
        return jsonify({"error": "Image is required."}), 400

    img_data_str = data["image"]
    if img_data_str.startswith("data:image"):
        try:
            img_data_str = img_data_str.split(",")[1]
        except IndexError:
            return jsonify({"error": "Invalid image format."}), 400

    try:
        img_bytes = base64.b64decode(img_data_str)
    except Exception:
        return jsonify({"error": "Invalid base64 image data."}), 400

    if len(img_bytes) > 8 * 1024 * 1024:
        return jsonify({"error": "Image is too large (max 8 MB)."}), 413

    try:
        img = Image.open(io.BytesIO(img_bytes))
        if img.format not in ["PNG", "JPEG", "WEBP"]:
            return jsonify({"error": f"Image must be PNG, JPEG, or WEBP. Got {img.format}"}), 400
    except Exception:
        return jsonify({"error": "Invalid image file."}), 400

    # Resize so longest side <= 1024
    longest_side = max(img.width, img.height)
    if longest_side > 1024:
        ratio = 1024 / longest_side
        new_w = int(img.width * ratio)
        new_h = int(img.height * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    processed_img_bytes = buf.getvalue()

    prompt = data["prompt"].strip()
    model_key = data.get("model", "kontext")
    if model_key not in EDIT_MODELS:
        model_key = "kontext"

    if not HF_API_KEY:
        return jsonify({
            "error": "Hugging Face free credits are used up. Use the free basic tools (rotate, flip, adjust) in the Edit tab.",
            "code": "HF_CREDITS",
        }), 402

    primary_model = EDIT_MODELS[model_key]
    fallback_model_key = "qwen-edit" if model_key == "kontext" else "kontext"
    fallback_model = EDIT_MODELS[fallback_model_key]

    def try_edit(model_info):
        client = InferenceClient(provider=model_info["provider"], api_key=HF_API_KEY)
        return client.image_to_image(processed_img_bytes, prompt=prompt, model=model_info["id"])

    try:
        result_img = try_edit(primary_model)
    except Exception as e1:
        logger.warning("Primary edit failed: %s", str(e1)[:120])
        try:
            result_img = try_edit(fallback_model)
        except Exception as e2:
            logger.warning("Fallback edit failed: %s", str(e2)[:120])
            err_str = str(e1).lower() + " " + str(e2).lower()
            if "401" in err_str or "403" in err_str or "unauthorized" in err_str or "permission" in err_str:
                return jsonify({"error": "Check your Hugging Face token"}), 401
            if "402" in err_str or "429" in err_str or "payment" in err_str or "credits" in err_str or "quota" in err_str:
                return jsonify({
                    "error": "Hugging Face free credits are used up. Use the free basic tools (rotate, flip, adjust) in the Edit tab.",
                    "code": "HF_CREDITS",
                }), 402
            if "503" in err_str or "timeout" in err_str or "loading" in err_str or "busy" in err_str:
                return jsonify({"error": "Model is busy, try again"}), 503
            return jsonify({"error": "Failed to edit image."}), 500

    out_buf = io.BytesIO()
    result_img.save(out_buf, format="PNG")
    b64_string = base64.b64encode(out_buf.getvalue()).decode("utf-8")
    return jsonify({"image": f"data:image/png;base64,{b64_string}"}), 200


@app.route("/restyle", methods=["POST"])
def restyle_image():
    """Restyle an image using Cloudflare SDXL Lightning img2img."""
    if not CLOUDFLARE_ACCOUNT_ID or not CLOUDFLARE_API_TOKEN:
        return jsonify({
            "error": "Cloudflare credentials are not configured. Restyle is unavailable.",
            "code": "CF_AUTH",
        }), 500

    data = request.get_json(silent=True)
    if not data or not data.get("prompt", "").strip():
        return jsonify({"error": "Prompt is required and cannot be empty."}), 400
    if not data.get("image"):
        return jsonify({"error": "Image is required."}), 400

    # Rate limit check
    ip = request.remote_addr
    record = _get_usage(ip)

    if record["count"] >= DAILY_LIMIT:
        return jsonify({
            "error": f"Your daily limit of {DAILY_LIMIT} generations is used up. Try again tomorrow.",
            "code": "TOKEN_EXPIRED",
            "remaining": 0,
        }), 429

    ok, msg = _check_cf_rate(record)
    if not ok:
        return jsonify({"error": msg, "code": "CF_RATE_LIMIT"}), 429

    # Decode the incoming image
    img_data_str = data["image"]
    if img_data_str.startswith("data:image"):
        try:
            img_data_str = img_data_str.split(",")[1]
        except IndexError:
            return jsonify({"error": "Invalid image format."}), 400

    try:
        img_bytes = base64.b64decode(img_data_str)
    except Exception:
        return jsonify({"error": "Invalid base64 image data."}), 400

    if len(img_bytes) > 8 * 1024 * 1024:
        return jsonify({"error": "Image is too large (max 8 MB)."}), 413

    # Resize to fit 1024px longest side for SDXL Lightning
    try:
        img = Image.open(io.BytesIO(img_bytes))
        longest_side = max(img.width, img.height)
        if longest_side > 1024:
            ratio = 1024 / longest_side
            new_w = int(img.width * ratio)
            new_h = int(img.height * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        processed_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as exc:
        logger.warning("Restyle image processing error: %s", str(exc)[:120])
        return jsonify({"error": "Failed to process the uploaded image."}), 400

    prompt = data["prompt"].strip()
    negative_prompt = data.get("negative_prompt", "").strip()

    try:
        strength = float(data.get("strength", 0.75))
    except (ValueError, TypeError):
        strength = 0.75

    try:
        result_bytes = cf_provider.restyle(
            account_id=CLOUDFLARE_ACCOUNT_ID,
            api_token=CLOUDFLARE_API_TOKEN,
            prompt=prompt,
            image_b64=processed_b64,
            strength=strength,
            negative_prompt=negative_prompt,
        )
    except cf_provider.CloudflareError as exc:
        logger.warning("Cloudflare restyle failed: %s (code=%s)", str(exc)[:120], exc.code)
        status_map = {
            "CF_QUOTA": 429,
            "CF_AUTH": 401,
            "TIMEOUT": 504,
        }
        return jsonify({
            "error": str(exc),
            "code": exc.code,
        }), status_map.get(exc.code, 500)

    b64_string = base64.b64encode(result_bytes).decode("utf-8")
    data_uri = f"data:image/png;base64,{b64_string}"

    # Increment usage
    record["count"] += 1
    record["cf_count"] += 1
    record["cf_minute_log"].append(_time.time())

    remaining = max(0, DAILY_LIMIT - record["count"])
    cf_remaining = max(0, CF_DAILY_LIMIT - record["cf_count"])

    return jsonify({
        "image": data_uri,
        "remaining": remaining,
        "cf_remaining": cf_remaining,
    }), 200


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
