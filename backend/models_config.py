"""
Centralized model configuration for Cloudflare Workers AI.

Each entry maps a short model key (used by the frontend) to its provider,
API model identifier, display name, capability flags, and UI badge text.
"""

# ── Cloudflare Workers AI models ───────────────────────────────
CLOUDFLARE_MODELS = {
    "cf-flux-schnell": {
        "provider": "cloudflare",
        "model_id": "@cf/black-forest-labs/flux-1-schnell",
        "name": "FLUX.1 Schnell",
        "desc": "Lightning-fast generation via Cloudflare Workers AI",
        "badge": "Free daily",
        "badge_class": "free",
        "icon": "⚡",
        "supports_negative_prompt": False,
        "supports_dimensions": False,
        "default_steps": 4,
        "max_steps": 8,
        "note": "FLUX Schnell generates square images; use SDXL Lightning for other sizes.",
    },
    "cf-sdxl-lightning": {
        "provider": "cloudflare",
        "model_id": "@cf/bytedance/stable-diffusion-xl-lightning",
        "name": "SDXL Lightning",
        "desc": "High-resolution generation with negative prompt & custom sizes",
        "badge": "Free daily",
        "badge_class": "free",
        "icon": "◈",
        "supports_negative_prompt": True,
        "supports_dimensions": True,
        "default_steps": 4,
        "max_steps": 20,
        "note": None,
    },
    "cf-sdxl-base": {
        "provider": "cloudflare",
        "model_id": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        "name": "Stable Diffusion XL",
        "desc": "Classic high-resolution model via Cloudflare Workers AI",
        "badge": "Free daily",
        "badge_class": "free",
        "icon": "❖",
        "supports_negative_prompt": True,
        "supports_dimensions": True,
        "default_steps": 20,
        "max_steps": 50,
        "note": None,
    },
}

# Default generation model (Cloudflare FLUX.1 Schnell)
DEFAULT_MODEL = "cf-flux-schnell"
