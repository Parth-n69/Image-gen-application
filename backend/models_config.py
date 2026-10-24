"""
Centralized model configuration for all providers.

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
}

# ── Hugging Face Inference models ──────────────────────────────
HUGGINGFACE_MODELS = {
    "flux-schnell": {
        "provider": "huggingface",
        "model_id": "black-forest-labs/FLUX.1-schnell",
        "name": "FLUX Schnell",
        "desc": "Lightning-fast generation with remarkable clarity",
        "badge": "Limited credits",
        "badge_class": "limited",
        "icon": "⚡",
        "supports_negative_prompt": False,
        "supports_dimensions": True,
        "note": None,
    },
    "flux-dev": {
        "provider": "huggingface",
        "model_id": "black-forest-labs/FLUX.1-dev",
        "name": "FLUX Dev",
        "desc": "Exceptional detail & prompt adherence for discerning creators",
        "badge": "Limited credits",
        "badge_class": "limited",
        "icon": "✦",
        "supports_negative_prompt": False,
        "supports_dimensions": True,
        "note": None,
    },
    "sd3.5": {
        "provider": "huggingface",
        "model_id": "stabilityai/stable-diffusion-3.5-large",
        "name": "Stable Diffusion 3.5",
        "desc": "Stability AI's flagship for complex composition",
        "badge": "Limited credits",
        "badge_class": "limited",
        "icon": "◈",
        "supports_negative_prompt": True,
        "supports_dimensions": True,
        "note": None,
    },
    "sdxl": {
        "provider": "huggingface",
        "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
        "name": "Stable Diffusion XL",
        "desc": "Classic high-resolution model with rich aesthetics",
        "badge": "Limited credits",
        "badge_class": "limited",
        "icon": "❖",
        "supports_negative_prompt": True,
        "supports_dimensions": True,
        "note": None,
    },
}

# ── Edit models (stay on Hugging Face) ─────────────────────────
EDIT_MODELS = {
    "kontext": {
        "id": "black-forest-labs/FLUX.1-Kontext-dev",
        "provider": "replicate",
    },
    "qwen-edit": {
        "id": "Qwen/Qwen-Image-Edit",
        "provider": "fal-ai",
    },
}

# Default generation model (Cloudflare FLUX.1 Schnell)
DEFAULT_MODEL = "cf-flux-schnell"
