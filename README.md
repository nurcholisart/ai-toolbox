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

Install as App:
- Android/Chrome: tap the `Install App` button in the header (or on the home screen actions). It triggers the native install prompt when available.
- iOS/Safari: tap the `Install App` button to see a quick tip, then use Safari’s Share menu → `Add to Home Screen`.
- The button only shows when installation is available and hides once installed or when running in standalone.

Usage:
- Dev: `npm run dev` (SW enabled with `devOptions.enabled = true`)
- Build: `npm run build` then `npm run preview`
- Install: open the app in a supported browser and use “Install App”/Add to Home Screen

Routing note:
- Clean URLs use the History API (no `#/`). Vite dev/preview already fallback to `index.html`. For production, unknown routes must rewrite to `index.html` so direct links like `/information-verifier` work.
- Included configs:
  - Netlify: `public/_redirects` with `/* /index.html 200` is copied to `dist/`.
  - Vercel: `vercel.json` routes use filesystem-first, then SPA fallback to `index.html`.
  - Custom servers: enable SPA/history fallback (e.g., Nginx `try_files $uri /index.html;`).

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
4. Paste the key in the app Settings (Settings card or `/settings`) and click Save.

Notes:
- Treat the key like a password. It is stored locally in your browser (localStorage) and used directly from your device to the Gemini API.
- You can revoke or rotate the key anytime from Google AI Studio.

## PDF → Markdown Tool
- Location: `src/components/PdfToMarkdown.jsx`
- Access: open the app and click the card “PDF to Markdown” (or navigate to `/pdf-to-markdown`).

### Setup API Key (no .env)
- Open the app and go to Settings (card or `/settings`).
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

## Information Verifier
- Location: `src/components/InformationVerifier.jsx`
- Route: `/information-verifier`

Features:
- Web-grounded verification (Gemini + optional Google Search tool) returning a strict JSON: `{ verdict, reason, citations }` where `verdict` is one of `Valid | Mislead | Hoax`.
- Share results: after verifying, click "Share result" to copy/open a link containing the encoded result.
  - Click "Share result" to copy/open a link that embeds the full output (verdict, reason, all citations, and claim) using compressed, URI-safe encoding.

Share link format:
- Path: `/information-verifier?result=<compressed>`
- Encoding: LZ-based, URI‑safe compression of the UTF‑8 JSON payload.
- Payload JSON: `{ verdict, reason, citations, claim }`.
- Backward compatible: old Base64URL links still decode correctly.
- Opening the link renders the shared result immediately without re‑verifying.
- The page updates Open Graph tags (title/description/url) based on the shared result for richer previews. Note: most crawlers do not execute client JS; dynamic OG tags work best when the target supports server rendering.

Note:
- Older Base64URL links are still supported and render as usual.

## Lockfile Scanner
- Location: `src/components/LockfileScanner.jsx`
- Route: `/lockfile-scanner`

Features:
- Paste or upload `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`
- Sends package names and versions to OSV.dev and lists known vulnerabilities

## Flower Bouquet Generator
- Location: `src/components/FlowerBouquetGenerator.jsx`
- Route: `/flower-bouquet`

Features:
- Fill a detailed form to craft a realistic bouquet prompt
- Generates a studio-style flower bouquet photo with Gemini

## Context Cards
- Location: `src/components/ContextCards.jsx`
- Route: `/context-cards`

Features:
- Browse mitigation tactics for common context failure modes (Poisoning, Distraction, Confusion, Clash)
- Filter by failure mode and lever (Write, Select, Compress, Isolate)
- Search across card content and copy card text or filtered JSON

## Notes
- PictureMe: This tool is based on the Gemini Canvas template created by the Google team, and they shared details in this X post: https://x.com/GeminiApp/status/1963615829708132611
 - Image editing (Gemini): Client calls use the `gemini-2.5-flash-image-preview:generateContent` endpoint with two parts: a text instruction and the input image as `inlineData` (base64). The response may include an `inlineData` image (PNG). For background removal, instruct Gemini to produce a transparent PNG without cropping, and implement simple retries for `429`.

### Google Search Grounding (Gemini)
- Enable web-grounded answers by adding `tools: [{ googleSearch: {} }]` to the `generateContent` request body. The model may cite web sources in its answer when this tool is provided.
- Ask the model to return a machine-readable citations list (title + URL) in the output to surface links in the UI.
- Fallback: if the API rejects the `tools` field (400/404 on some regions/models), retry the same request without `tools`.
