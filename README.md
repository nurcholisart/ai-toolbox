# AI Toolbox

Live: https://ai-toolbox.nurcholis.art

A lightweight Vite + React + Tailwind project showcasing an AI tools hub (cards linking to various tools). Use this repo as a starting point for adding routes, APIs, or real tool pages.

## Quick Start
- Node 18+ recommended
- Install: `npm install`
- Dev server: `npm run dev` (open the printed URL)
- Production build: `npm run build` (outputs to `dist/`)
- Preview build: `npm run preview`

## Progressive Web App (PWA)
This app is installable and works offline for static assets via `vite-plugin-pwa`.

- Register SW: handled in `src/main.jsx` via `registerSW`
- Manifest & caching: configured in `vite.config.js` (includes `.wasm` so ffmpeg assets can be cached)

Usage:
- Dev: `npm run dev` (SW enabled with `devOptions.enabled = true`)
- Build: `npm run build` then `npm run preview`
- Install: open the app in a supported browser and use “Install App”/Add to Home Screen

Notes:
- Default monochrome, maskable PNG icons are included at `public/icons/icon-192.png` and `public/icons/icon-512.png` and referenced in the manifest. Replace with your brand if needed.
- Large ffmpeg `.wasm` files are intentionally excluded from precache to avoid exceeding Workbox size limits on build (Vercel). They will be fetched on demand, then cached at runtime using a `CacheFirst` strategy for `/ffmpeg/` assets.

## Project Structure
- `index.html` — HTML entry for Vite
- `src/main.jsx` — React bootstrap
- `src/App.jsx` — AIToolbox UI (grid of tool cards)
- `src/index.css` — Tailwind entry and globals
- `tailwind.config.js`, `postcss.config.js` — styling toolchain
- `vitest.config.js`, `src/test/setup.js`, `src/App.test.jsx` — test setup and examples

Suggested folders when expanding:
- `src/components/` — shared UI components
- `src/assets/` — images and static assets

## Testing
- Run once: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run coverage`

Stack: Vitest + React Testing Library with JSDOM environment. Example test checks the main heading and a card render.

## Contributing
- Read the contributor guide: `AGENTS.md`
- Use Conventional Commits (e.g., `feat: add tool card`)
- Include screenshots/GIFs for UI changes in PRs

## Environment
Do not commit secrets. Use `.env` locally (already ignored) and document new variables by adding non‑secret defaults to `.env.example`.

### Get Gemini API Key
1. Open: https://aistudio.google.com/u/0/apikey
2. Sign in with your Google account.
3. Click "Create API key" to generate a new key, or copy an existing key.
4. Paste the key in the app Settings (Settings card or `#/settings`) and click Save.

Notes:
- Treat the key like a password. It is stored locally in your browser (localStorage) and used directly from your device to the Gemini API.
- You can revoke or rotate the key anytime from Google AI Studio.

## PDF → Markdown Tool
- Location: `src/components/PdfToMarkdown.jsx`
- Access: open the app and click the card “PDF to Markdown” (or navigate to `#/pdf-to-markdown`).

### Setup API Key (no .env)
- Open the app and go to Settings (card or `#/settings`).
- Paste your Gemini API Key and Save. It is stored in your browser (localStorage).
- No environment variables are required.

### Install
- If not already installed: `npm install`

### Run
- Dev: `npm run dev` then go to the app, open “PDF to Markdown”.
- Build: `npm run build` and `npm run preview` to verify.

### Notes
- The tool extracts text client‑side using `pdfjs-dist` and sends it to Gemini for GFM conversion.
- It requires network access for the Gemini API.
- Image‑based PDFs (scanned) may produce empty text extraction unless OCR is added (not included).

## Notes
- PictureMe: This tool is based on the Gemini Canvas template created by the Google team, and they shared details in this X post: https://x.com/GeminiApp/status/1963615829708132611
 - Image editing (Gemini): Client calls use the `gemini-2.5-flash-image-preview:generateContent` endpoint with two parts: a text instruction and the input image as `inlineData` (base64). The response may include an `inlineData` image (PNG). For background removal, instruct Gemini to produce a transparent PNG without cropping, and implement simple retries for `429`.

### Google Search Grounding (Gemini)
- Enable web-grounded answers by adding `tools: [{ googleSearch: {} }]` to the `generateContent` request body. The model may cite web sources in its answer when this tool is provided.
- Ask the model to return a machine-readable citations list (title + URL) in the output to surface links in the UI.
- Fallback: if the API rejects the `tools` field (400/404 on some regions/models), retry the same request without `tools`.
