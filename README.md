# AI Toolbox

A lightweight Vite + React + Tailwind project showcasing an AI tools hub (cards linking to various tools). Use this repo as a starting point for adding routes, APIs, or real tool pages.

## Quick Start
- Node 18+ recommended
- Install: `npm install`
- Dev server: `npm run dev` (open the printed URL)
- Production build: `npm run build` (outputs to `dist/`)
- Preview build: `npm run preview`

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
