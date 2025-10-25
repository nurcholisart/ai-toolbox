# Toolbox

Live: https://toolbox.nurcholis.art

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
- `src/App.jsx` — Toolbox UI (grid of tool cards)
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

## Meeting Transcription
- Location: `src/components/MeetingTranscription.jsx`
- Route: `/meeting-transcription`

Features:
- Converts supported audio/video files to MP3 in-browser, splits into up to 15-minute chunks, and transcribes each chunk to GitHub Flavored Markdown.
- Gemini requests now pin `responseMimeType: 'text/plain'` and low temperature settings for deterministic transcripts and to avoid empty responses.
- Uses the locally stored Gemini API key and performs all media processing client-side with `@ffmpeg/ffmpeg`.

Notes:
- Upload limit is 1 GB per file; compress or trim larger recordings before use.
- If the UI reports “Model returned no text (reason: …)”, the model finished without content—retry with shorter segments or check audio clarity.

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

## Query Explorer
- Location: `src/components/QueryExplorer.jsx`
- Route: `/query-explorer`

Features:
- DuckDB WASM sandbox with CSV, JSON Lines, and Parquet ingestion. Uploads persist in IndexedDB unless private mode is enabled.
- VSCode-inspired layout: a collapsible left sidebar for file uploads/defaults, schema inspector, query history, and notifications; SQL editor dominates the main pane with results directly underneath.
- Column inspector mirrors the selected dataset schema (name + type) and updates as selections change.
- Query history keeps the most recent statements with single-click restore/clear actions—no pinning.
- Result panel supports CSV, NDJSON, and Parquet exports via the inline actions above the result grid.
- SQL editor provides DuckDB-aware autocomplete (tables, columns, functions, keywords, snippets) when `enableSqlAutocomplete` is enabled.

Notes:
- Upload defaults (delimiter, encoding, null string, header, etc.) are configurable from the sidebar before importing additional CSV/TSV files.
- Dataset previews show the first 100 rows; use the refresh action to re-run the preview after file replacement or cache restores.
- New uploads made while the cache is still hydrating stay visible; cached datasets merge with any in-flight session state instead of replacing it.
- Schema metadata is cached in memory with `{ tables, columnsByTable, tableLookup, functions, keywords, aliases }` and refreshes after DuckDB init, dataset uploads/removals, or cache restores. Use the “Refresh schema” buttons in the editor toolbar or Columns panel to force a refresh if the indicator reports staleness.
- Disable completions by flipping `enableSqlAutocomplete` inside `QueryExplorer.jsx`—the editor falls back to keywords and functions only.

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

## Promptable
- Location: `src/components/Promptable.jsx`
- Route: `/promptable`

Features:
- Manage a personal prompt library with metadata (target model, use case) stored locally.
- Request Gemini to improve a prompt and preview a monochrome diff before accepting changes.
- Browse and restore saved versions with inline diffs to track iteration history.
- Run sample inputs against Gemini, copy results, and optionally archive runs to Notable.

## Notes
- PictureMe: This tool is based on the Gemini Canvas template created by the Google team, and they shared details in this X post: https://x.com/GeminiApp/status/1963615829708132611
 - Image editing (Gemini): Client calls use the `gemini-2.5-flash-image-preview:generateContent` endpoint with two parts: a text instruction and the input image as `inlineData` (base64). The response may include an `inlineData` image (PNG). For background removal, instruct Gemini to produce a transparent PNG without cropping, and implement simple retries for `429`.

### Google Search Grounding (Gemini)
- Enable web-grounded answers by adding `tools: [{ googleSearch: {} }]` to the `generateContent` request body. The model may cite web sources in its answer when this tool is provided.
- Ask the model to return a machine-readable citations list (title + URL) in the output to surface links in the UI.
- Fallback: if the API rejects the `tools` field (400/404 on some regions/models), retry the same request without `tools`.

## Mermaid Validator
- Location: `src/components/MermaidValidator.jsx`
- Route: `/mermaid-validator`

Features:
- Validates a Mermaid diagram string using the real Mermaid parser (no heuristics).

Notes:
- Install Mermaid to enable validation in the browser: `npm install mermaid`.
- If the parser is unavailable, the UI indicates it cannot validate.

### Dev cURL Endpoint
During `npm run dev`, a small HTTP endpoint is exposed for validating Mermaid via cURL (no heuristic fallback).

- URL: `GET /api/mermaid/validate`
- Params: `b64` (Base64-encoded diagram) or `text` (raw, URL-encoded)
- Also supports `POST` with JSON `{ b64?: string, text?: string }`
- Response JSON: `{ valid: boolean, error?: string, parser: 'mermaid' | 'none' }`
- Status codes: `200` (valid), `422` (invalid syntax), `400` (missing input), `501` (parser unavailable), `500` (server error)
 - Convenience: The API normalizes literal `\n` sequences in `text` into actual newlines, so `text=flowchart%20TD%5CnA--%3EB` works. Prefer `--data-urlencode` or `b64` for complex inputs.

Examples:
- Base64 GET:
  - `printf 'flowchart TD\nA-->B' | base64 | tr -d '\n' | xargs -I{} curl -s "http://localhost:5173/api/mermaid/validate?b64={}"`
- Raw text GET:
  - `curl -s --get --data-urlencode "text=flowchart TD\nA-->B" http://localhost:5173/api/mermaid/validate`
- POST JSON:
  - `curl -s -X POST -H 'content-type: application/json' --data '{"text":"flowchart TD\nA-->B"}' http://localhost:5173/api/mermaid/validate`

Notes:
- The dev endpoint requires `mermaid` and `jsdom` installed locally to validate; if missing, it returns `501`.
- This endpoint is dev-only (available on the Vite dev server). `vite preview` serves static files and will not include this route.
- PWA note: Navigating directly to `/api/...` in the browser can be treated as an app navigation by the Service Worker and return the SPA shell. The Workbox config excludes `/api/` from navigation fallback; refresh to update the SW.

### Production cURL Endpoint (Vercel)
Deployed builds expose the same API shape via a Vercel Serverless Function (no heuristics).

- URL: `GET/POST /api/mermaid/validate`
- Inputs: `b64` (Base64) or `text` (raw, URL-encoded); POST JSON `{ b64?, text? }`
- Output: `{ valid, error?, parser }`
- Status codes: `200` (valid), `422` (invalid syntax), `400` (missing input), `501` (parser unavailable), `500` (server error)

Examples:
- Base64 GET:
  - `printf 'flowchart TD\nA-->B' | base64 | tr -d '\n' | xargs -I{} curl -s "https://<your-domain>/api/mermaid/validate?b64={}"`
- Raw text GET:
  - `curl -s --get --data-urlencode "text=flowchart TD\nA-->B" https://<your-domain>/api/mermaid/validate`
- POST JSON:
  - `curl -s -X POST -H 'content-type: application/json' --data '{"text":"flowchart TD\nA-->B"}' https://<your-domain>/api/mermaid/validate`

Notes:
- Install `mermaid` and set `ENABLE_MERMAID_PARSE=1` in Vercel to enable server-side parsing; otherwise the endpoint returns `501`.
- Server-side parsing note: Mermaid depends on DOMPurify hooks which expect a browser-like `window`. The API auto-creates a JSDOM window before importing Mermaid to avoid `DOMPurify.addHook is not a function`. Ensure `jsdom` is in `dependencies` (not only `devDependencies`).
- PWA note: Typing `/api/...` in the address bar is a navigation; the Service Worker could serve `index.html`. We denylist `/api/` from navigation fallback so API endpoints return JSON when opened directly. After deployment, hard refresh to update the SW.

## Mermaid Editor
- Location: `src/components/MermaidEditor.jsx`
- Route: `/mermaid-editor`

Features:
- Split layout with a monospace Mermaid editor and live canvas preview, including zoom/pan controls and a sample reset action.
- Renders diagrams client-side with `mermaid.render` while keeping the last valid SVG in place when syntax errors are detected.
- Optional Gemini assistant that turns natural language prompts into Mermaid code and inserts the result into the editor.

Notes:
- The AI assistant uses the Gemini API key saved from the Settings tool and retries failed requests with exponential backoff before surfacing errors.
- Preview interactions rely on client-side transforms rather than re-rendering the SVG, so large diagrams stay responsive while panning or zooming.
- Markdown-style code fences are stripped automatically before rendering, and the editor now validates diagrams with `mermaid.parse` before attempting to render so the preview never shows Mermaid's default brown "Syntax error" SVG.

## SSE to JSON
- Location: `src/components/SSEToJSON.jsx`
- Route: `/sse-to-json`

Features:
- Paste raw `text/event-stream` transcripts and parse them into structured event objects.
- Merge OpenAI Responses API streams into a single response snapshot or inspect the raw events.
- Copy or download the parsed JSON and run quick smoke tests for the parser/unifier.

Notes:
- The parser follows the SSE spec (comment lines, blank separators, multi-line `data:` fields) and keeps non-JSON payloads as text.
- Sample events in the UI demonstrate delta merging for reasoning items.

## Token Counter
- Location: `src/components/TokenCounter.jsx`
- Route: `/token-counter`

Features:
- Counts tokens client-side using the pure JavaScript build of `gpt-tokenizer` (no WASM needed).
- Provides layered CDN fallbacks (jsDelivr → unpkg → esm.run → esm.sh → Skypack) and respects `window.GPT_TOKENIZER_URL` overrides.
- Displays per-token decoding, token/character totals, clipboard export, and a regression test suite covering diverse scripts.

Notes:
- The tokenizer module is loaded via dynamic `import()`. Ensure your deployment allows ESM module loading from the selected CDN.
- When offline or behind a restrictive CSP, self-host the ESM bundle and set `window.GPT_TOKENIZER_URL` before the app initializes.
