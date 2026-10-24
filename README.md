# Pixabel — Luxury AI Image Generator & Editor

Generate stunning images from text prompts and edit them with precision using state-of-the-art diffusion models. Pixabel pairs a high-performance Flask API backend with an elegant, responsive React + Vite luxury client interface.

**Default provider:** Cloudflare Workers AI (free daily tier)
**Secondary provider:** Hugging Face Inference API (limited credits)

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-v8-purple?logo=vite)
![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🗂️ Project Structure

```
image-gen-model/
├── backend/
│   ├── app.py                  # Flask API server with CORS
│   ├── models_config.py        # Centralized model registry (CF + HF)
│   ├── providers/
│   │   ├── cloudflare.py       # Cloudflare Workers AI provider
│   │   └── huggingface.py      # Hugging Face Inference provider
│   ├── .env                    # API keys & config (not committed)
│   ├── .env.example            # Backend env template
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── public/                 # Static assets & icons
│   ├── src/
│   │   ├── components/         # Shared UI: Header, Tabs, Modal, Toast, Skeleton, etc.
│   │   ├── context/            # ThemeContext & AuthContext
│   │   ├── hooks/              # useCountdown, useGenerations
│   │   ├── lib/                # api.js, storage.js, supabase.js, autocorrect.js, download.js
│   │   ├── pages/              # Home, Login, ResetPassword, Profile, Terms, Privacy, NotFound
│   │   ├── styles/             # theme.css (luxury tokens, dark/light modes)
│   │   ├── App.jsx             # React Router route definitions
│   │   └── main.jsx            # Application entrypoint
│   ├── .env.local              # Local environment variables (git-ignored)
│   ├── .env.example            # Frontend env template
│   ├── vercel.json             # SPA production rewrite configuration
│   ├── vite.config.js          # Vite config (port 5173)
│   └── package.json            # React & Vite dependencies
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** & npm installed
- **Python 3.9+** installed
- A free **Cloudflare** account (recommended, for free daily image generation)
- A free **Hugging Face** account (optional, for secondary models)
- A **Supabase** project for authentication

---

### 1. Backend Setup (Flask)

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create `backend/.env` with your credentials:

```ini
# ── Cloudflare Workers AI (DEFAULT — free daily tier) ──
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here

# ── Hugging Face (optional — secondary provider) ──
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Rate limits (optional — defaults shown) ──
DAILY_LIMIT=20
CF_DAILY_LIMIT=20
CF_PER_MINUTE=5
```

Start the Flask server:

```bash
python app.py
```

The API runs on **http://127.0.0.1:5000**.

---

### 2. Getting Cloudflare Workers AI Credentials (Free)

Cloudflare Workers AI offers a **free daily tier** for image generation models. Here's how to set it up:

1. **Create a Cloudflare account** at [dash.cloudflare.com](https://dash.cloudflare.com/) (free).
2. **Find your Account ID:**
   - Go to any domain in your dashboard, or visit **Workers & Pages**.
   - Your Account ID is shown in the right sidebar under **Account details**, or in the URL: `dash.cloudflare.com/<ACCOUNT_ID>/...`
3. **Create an API Token:**
   - Go to **My Profile → API Tokens → Create Token**.
   - Use the **"Workers AI"** template, or create a custom token with the **Account › Workers AI › Read** permission.
   - Copy the token — you won't be able to see it again.
4. **Add to `backend/.env`:**
   ```ini
   CLOUDFLARE_ACCOUNT_ID=abcdef1234567890abcdef1234567890
   CLOUDFLARE_API_TOKEN=your-workers-ai-api-token
   ```

#### Free-Tier Models

| Model | ID | Free? | Notes |
|---|---|---|---|
| **FLUX.1 Schnell** | `@cf/black-forest-labs/flux-1-schnell` | ✅ Free daily | Default. Square images only. 1–8 steps. |
| **SDXL Lightning** | `@cf/bytedance/stable-diffusion-xl-lightning` | ✅ Free daily | Supports negative prompt, custom sizes, and img2img restyle. |

> **Daily limits:** Cloudflare provides a generous free tier that resets daily. Pixabel also enforces per-user limits (configurable via `CF_DAILY_LIMIT` and `CF_PER_MINUTE` env vars, defaults: 20/day, 5/min).

---

### 3. Frontend Setup (React + Vite)

In a new terminal window:

```bash
cd frontend

# Install dependencies
npm install
```

Configure your environment in `frontend/.env.local`:

```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://127.0.0.1:5000
VITE_GUEST_MODE=true
VITE_OTP_LENGTH=8
```

Run the development server:

```bash
npm run dev
```

The app will open at **http://localhost:5173**.

To build for production:

```bash
npm run build
```

---

## 🔑 Provider System

Pixabel uses a **multi-provider architecture** with automatic fallback:

| Provider | Status | Badge | Use Case |
|---|---|---|---|
| **Cloudflare Workers AI** | Default | "Free daily" | Text-to-image generation + Restyle |
| **Hugging Face Inference** | Secondary | "Limited credits" | Text-to-image + AI Magic Edit |

- Providers whose API keys are **not configured** are automatically hidden from the model picker.
- Each provider has its own error classification and user-friendly messages.
- Credentials are read from `backend/.env` only and never exposed to the frontend or logs.

### Error Messages

| Scenario | User-Facing Message |
|---|---|
| Cloudflare daily allowance reached (429/quota) | "Daily free allowance reached. It resets daily. Try another provider or come back tomorrow." |
| Invalid Cloudflare token (401/403) | "Cloudflare credentials are invalid. Check backend/.env." |
| Hugging Face credits exhausted (402/429) | "Hugging Face free credits are used up. Use a Cloudflare model." |

---

## 🔐 Supabase Auth & Email OTP Verification

Pixabel uses **Supabase Auth** with dynamic email OTP code verification:

1. **Email Confirmation:** Turn **Confirm email** ON in Supabase **Authentication > Providers > Email**.
2. **Confirm Signup Template (`{{ .Token }}`):** In **Email Templates > Confirm signup**, insert `{{ .Token }}` for numeric code delivery.
3. **Interactive Code Input:** 8 numeric digit boxes with auto-advance, backspace navigation, arrow key navigation, clipboard paste, and automatic submission.
4. **Resend Cooldown & Lockout:** 60-second cooldown timer, 5 max resends per session, and a 60-second lockout after 5 incorrect code attempts.
5. **Session Persistence:** OTP email is persisted in `sessionStorage` across page reloads. Signing in with an unconfirmed email automatically navigates to the verification screen.
6. **Guest Mode:** Non-authenticated users can explore the app and generate images via guest mode without mandatory initial sign-in.

---

## 🎨 Feature Overview

### 1. Generate Tab
- **Model Selection:** Cloudflare models listed first (FLUX.1 Schnell, SDXL Lightning) with "Free daily" badge. Hugging Face models available with "Limited credits" badge.
- **Default Model:** FLUX.1 Schnell on Cloudflare Workers AI.
- **Style Presets:** Realistic Photo, Anime, 3D Render, Digital Art, Oil Painting.
- **Aspect Ratios:** Square (1024×1024), Portrait (1024×1536), Landscape (1536×1024).
- **Advanced Controls:** Negative prompt input and AI Quality Enhancer toggle.
- **Prompt Autocorrect:** 100+ word dictionary correcting common prompt typos on space/Enter with toasts.
- **Collapsible Sidebar:** Inspiration prompts and recent creations history.
- **IndexedDB Auto-Save:** Every generation is automatically saved locally with metadata.
- **Rate Limit Display:** "X images left today" shown under the Generate button for Cloudflare models.

### 2. Gallery Tab
- **Filters:** View All, Favorites, or Edited creations.
- **Hover Card Overlays:** Quick actions for Favorite, Edit, Download, and Delete.
- **Lightbox Modal:** Full-resolution view with generation metadata, negative prompt, and **"Reuse Settings"** button.
- **Clear History Dialog:** Delete local history with option to preserve favorited creations.

### 3. Edit Tab
- **Image Input:** Drag-and-drop zone and file picker supporting PNG, JPEG, and WEBP (up to 8MB).
- **Basic Tools:** Rotate (-90° / +90°), flip horizontal / vertical.
- **Adjustments:** Sliders for brightness (0–200%), contrast (0–200%), saturation (0–200%), and blur (0–20px).
- **Filters:** Grayscale, Sepia, and Invert toggles.
- **AI Magic Edit** (Hugging Face): Prompt-driven transformation using FLUX Kontext or Qwen Image Edit. When HF credits are exhausted, shows a friendly message and points to the free tools.
- **Restyle** (Cloudflare, Free): Image-to-image restyling using SDXL Lightning with a transformation strength slider (10–100%). Includes preset chips: Oil painting, Watercolor, Cyberpunk neon, Studio Ghibli anime, Pencil sketch.
- **Compare:** Hold-to-compare overlay to preview original vs. modified state.
- **History & Export:** 10-state undo stack, save edited image to gallery, or download.

### 4. Profile & Preferences
- **Overview:** Deterministic gradient avatar with initials, member since, last sign-in, and generation statistics.
- **Account:** Edit full name and username with client validation.
- **Security:** Current password verification, password strength meter, requirement checklist, and global sign-out across all devices (`scope: 'global'`).
- **Preferences:** Default theme, model, style preset, and aspect ratio saved to user metadata and local storage.

---

## 💎 Design System & Aesthetics

- **Typography:** *Cormorant Garamond* (headings & logo) and *Inter* (UI controls).
- **Color Palette:** Curated dark/light theme tokens with champagne gold accents (`#d4af37`), soft glows, and noise grain overlay.
- **Theme Switcher:** Dark, Light, and System modes with zero-flash initial loading.
- **Animations:** Subtle glassmorphism, shimmers, and accessible `prefers-reduced-motion` overrides.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, Vite 8, React Router v7 |
| **Authentication & Cloud** | Supabase Auth (`@supabase/supabase-js`) |
| **Local Storage** | IndexedDB (`PixableDB` store) |
| **Styling** | Vanilla CSS tokens & variables (Theme System) |
| **Backend API** | Python 3, Flask, flask-cors, requests |
| **AI Providers** | Cloudflare Workers AI (FLUX.1 Schnell, SDXL Lightning), Hugging Face (FLUX Dev, SD 3.5, SDXL, Kontext) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
