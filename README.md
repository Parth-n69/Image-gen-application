# Pixabel — AI Image Generator

Generate stunning images from text prompts using **Stable Diffusion XL** via the Hugging Face Inference API. Built with a Flask backend and vanilla HTML/CSS/JS frontend.

![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🗂️ Project Structure

```
image-gen-model/
├── backend/
│   ├── app.py              # Flask API server
│   ├── .env                # Your Hugging Face API key (not committed)
│   ├── .env.example        # Template for .env
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Main UI page
│   ├── style.css           # Dark-theme styles
│   ├── script.js           # Client-side logic (generation, gallery, lightbox)
│   └── storage.js          # IndexedDB storage module for generation history
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.9+** installed
- A free **Hugging Face** account → [huggingface.co](https://huggingface.co/)
- A **Hugging Face API token** (read access is enough)
  1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
  2. Create a new token with **Read** permissions
  3. Copy the token

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Image-gen-model.git
cd Image-gen-model
```

### 2. Set Up the Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Add Your Hugging Face Token

Open `backend/.env` and replace the placeholder:

```
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Never commit your real API key.** The `.env` file should be in `.gitignore`.

### 4. Set Up Supabase Auth & Email OTP

Pixabel uses **Supabase Auth** with email OTP (One-Time Password) verification for a secure, passwordless-confirmed onboarding experience:

1. **Create Supabase Project:**
   - Go to [Supabase](https://supabase.com/) and create a project.
   - Under **Project Settings > API**, copy your **Project URL** and **anon / public key**.
   - Update `frontend/config.js` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Guest mode can be toggled via `GUEST_MODE`.

2. **Configure Email Confirmation & Custom SMTP:**
   - In Supabase Dashboard, go to **Authentication > Providers > Email**.
   - Turn **Confirm email** **ON**.
   - **SMTP Requirement:** Supabase's default built-in email service is strictly rate-limited (approximately 3-4 emails per hour across all users for testing). For reliable OTP delivery and production use, configure a custom SMTP provider (e.g., [Resend](https://resend.com/), SendGrid, Amazon SES, or Brevo) under **Project Settings > Authentication > SMTP Settings**.

3. **Configure the Confirm Signup Email Template (`{{ .Token }}`):**
   - Go to **Authentication > Email Templates > Confirm signup**.
   - Replace the magic link button with the OTP code token variable `{{ .Token }}`.
   - Example template body:
     ```html
     <h2>Confirm your Pixabel account</h2>
     <p>Enter the following verification code to complete your registration:</p>
     <h1 style="letter-spacing: 6px; font-size: 32px; font-family: monospace; color: #d4af37;">{{ .Token }}</h1>
     <p>This code will expire shortly. If you did not request this, you can safely ignore this email.</p>
     ```

4. **Match `OTP_LENGTH` Setting:**
   - In Supabase under **Authentication > Providers > Email**, check **Email OTP Length** (set to `8` by default to match your Supabase project).
   - In `frontend/config.js`, `const OTP_LENGTH = 8;` dynamically generates 8 boxes with auto-advance, backspace, paste, and auto-submit.

5. **How the Verify & Resend Flow Works:**
   - **Sign-Up Submission:** Validates full name, username (`3-20` lowercase letters, numbers, underscore), email format, password (`>= 8` characters), password confirmation, and terms acceptance. On submit, calls `supabase.auth.signUp({ email, password, options: { data: { full_name, username } } })` (without `emailRedirectTo`).
   - **Existing Account Detection:** If an email is already registered, Supabase returns a fake user with an empty `identities` array (`identities.length === 0`). Pixabel detects this and prompts: *"An account with this email already exists. Try signing in."* without exposing the verification screen.
   - **Interactive OTP Screen:** Replaces the form with a luxury-styled "Verify your email" panel showing the masked email (`p****@gmail.com`). Separate boxes are rendered with `inputmode="numeric"`, `autocomplete="one-time-code"`, auto-advance on typing, backspace backwards navigation, keyboard arrow navigation, paste handling, and auto-submit on completion.
   - **Code Verification:** Calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })`. Upon success, the session is created, a success indicator is shown, and the user is redirected to `index.html`.
   - **Resend & Rate Limiting:**
     - Resend button calls `supabase.auth.resend({ type: 'signup', email })` with a visible 60-second countdown (`Resend in 42s`).
     - Maximum 5 resends per session; once reached, displays *"Too many requests. Please wait a few minutes."*
     - After 5 wrong code attempts, the client locks the Verify button for 60 seconds with an active countdown timer.
     - Incorrect code, expired code, rate limits, and network errors are mapped to user-friendly notices. Code boxes are cleared and refocused after an incorrect code.
   - **State Persistence & Unconfirmed Sign-in:**
     - The pending email is saved in `sessionStorage` (never passwords or codes), preserving the OTP screen across page refreshes until verified or dismissed via *"Use a different email"*.
     - Attempting to sign in with an unconfirmed account (`email_not_confirmed`) automatically triggers a code resend, opens the OTP screen with *"Please verify your email to continue."*, and logs the user in upon verification without password re-entry.


### 5. Start the Flask Server

```bash
# From the backend/ directory with venv activated
python app.py
```

The server will start at **http://127.0.0.1:5000**.

### 6. Open the Frontend

We recommend using Live Server (especially for Supabase Auth redirects):

- **Option A:** Use the "Live Server" extension in VS Code to serve the `frontend/` folder.
- **Option B:** Double-click `frontend/login.html` in your file explorer (note: some auth redirects require a server).
- **Option C:** Run a simple python server in the frontend directory: `python -m http.server 5500`

---

## 🎨 Usage

### Generating Images

1. Type a descriptive prompt (e.g., *"A cyberpunk city at sunset, neon lights, ultra detailed"*)
2. (Optional) Open the **Options** panel to select:
   - **Style Preset:** Quickly apply a specific artistic style (e.g., Anime, Realistic Photo).
   - **Aspect Ratio:** Choose between Square, Portrait, or Landscape.
   - **Negative Prompt:** Specify things to avoid in the generation (e.g., "blurry, distorted").
3. Click **Generate** (or press Enter)
4. Wait 10-30 seconds (longer on cold starts when the model is loading)
5. View and **download** your generated image as a PNG

### Image Editing

The new **Edit Tab** allows you to modify your existing images or generated creations:
1. Upload an image, drag-and-drop one, or click **"Edit this image"** on any generated result in the chat or gallery.
2. **AI Magic Edit:** Describe the change (e.g. "make it winter") and apply it using models like FLUX Kontext.
   > ⚠️ **Note:** AI edits use the Hugging Face Inference API which consumes your limited free account credits. If your credits run out, the AI edit will fail.
3. **Basic Tools:** You can always use the built-in basic tools—these run entirely in your browser and work even if AI credits are exhausted:
   - Rotate, flip
   - Adjust Brightness, Contrast, Saturation, Blur
   - Apply filters (Grayscale, Sepia, Invert)
4. Compare your edits with the original image using the **Compare (Hold)** button.
5. Save your edits directly to the Gallery (they will appear with an "Edited" badge) or download them.

### Generation History & Gallery

Every successful generation is **automatically saved** to your browser's IndexedDB storage (which can hold hundreds of images, unlike localStorage).

- **Gallery Tab:** Switch to the Gallery tab to browse all your past generations in a responsive grid layout.
- **Favorites:** Star ⭐ any image to mark it as a favorite. Use the "Favorites" filter to view only starred images.
- **Lightbox:** Click any gallery image to open a detailed view showing the full image and all generation settings (prompt, negative prompt, model, style, size).
- **Reuse Settings:** In the lightbox, click "Reuse Settings" to copy all settings from a past generation back into the Generate tab — perfect for iterating on a concept.
- **Delete:** Remove individual images (with confirmation), or use "Clear All" to remove all history (favorites are kept by default).
- **Download:** Download any image from the gallery or lightbox.

### Storage

- Images are stored in **IndexedDB** (not localStorage), which can handle hundreds of large base64 images.
- If IndexedDB is unavailable (e.g., in private browsing), the app still works — you just won't have persistent history. A warning toast will appear.
- Data is stored locally in your browser only. Clearing browser data will remove your history.

### Profile Page

Logged-in users have access to a comprehensive Profile page featuring:
- **Overview:** View your generation stats (from this device's local history), account age, and a customized avatar.
- **Account:** Manage your full name and username.
- **Security:** Change your password or sign out of all active sessions across devices. You can also securely wipe all local generation data.
- **Preferences:** Set a default AI model, style preset, and aspect ratio which will automatically load into the Generate tab each time you use the app.


## 💎 Theming (Modern Luxury)

The UI is built with a modern luxury aesthetic—minimalist, elegant, and highly customizable. All colors and sizing are controlled by CSS variables located in `frontend/style.css`.

### Customizing the Theme

To tweak the design, update the variables in `:root` (for Dark mode) and `[data-theme="light"]`. The most important variable is the singular accent color (champagne gold).

```css
:root {
  --bg: #0a0a0b;
  --surface: #111113;
  --text: #f2efe9;
  --gold: #d4af37; /* Primary Accent Color */
  --gold-hover: #e6c76a;
  --on-gold: #14110a;
}
```

- **Restraint:** The accent color is used sparingly (only for primary actions, focus rings, and active tabs).
- **Typography:** The app uses *Cormorant Garamond* for beautiful headings and *Inter* for clean UI elements.
- **Animations:** All transitions use a luxurious slow, smooth curve (`--t-smooth`, `--t-slow`).

### Branding

The Pixabel logo is built entirely from basic geometry and CSS variables. The logo lockups use real HTML text for the "Pixabel" wordmark, allowing it to render perfectly without requiring heavy fonts in the SVG.

To swap the logo:
1. Replace `frontend/assets/logo-symbol.svg` with your own mark (preferably square, 48x48).
2. Update the HTML structures in `index.html` (look for `.logo-lockup-horizontal` and `.logo-lockup-stacked`).
3. Update `frontend/assets/favicon.svg`.

---

## ⚠️ Notes

- **Cold starts:** The Stable Diffusion XL model on Hugging Face's free tier may take 30-60 seconds to load on the first request. Subsequent requests are faster.
- **Rate limits:** The free Hugging Face API has rate limits. If you hit them, wait a moment and try again.
- **Image quality:** For better results, use detailed, descriptive prompts.

---

## 🛠️ Tech Stack

| Layer    | Technology                                      |
|----------|------------------------------------------------|
| Frontend | HTML5, CSS3, vanilla JavaScript                 |
| Storage  | IndexedDB (via `storage.js` module)             |
| Backend  | Python, Flask, flask-cors                       |
| AI Model | Stable Diffusion XL (via Hugging Face API)      |
| Styling  | Custom dark theme with glassmorphism & animations|

---

## 📄 License

This project is open source under the [MIT License](LICENSE).
