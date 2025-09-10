# Gemini Agent Guidelines

This document provides essential guidelines for the Gemini agent working on this repository.

## Project Overview
This is a React application built with Vite and styled with Tailwind CSS.

## Key Files
- `index.html`: Main HTML entry point.
- `src/main.jsx`: Application bootstrap and rendering root.
- `src/App.jsx`: Main application component (AIToolbox UI).
- `src/index.css`: Global styles and Tailwind CSS entry point.
- `vite.config.js`: Vite configuration.
- `tailwind.config.js`: Tailwind CSS configuration.

## Folder Structure
- `src/components/`: Contains reusable React components.
- `src/assets/`: Contains static assets like images and icons.

## Development Workflow

### 1. Installation
To install dependencies, run:
```bash
npm install
```

### 2. Development Server
To start the development server, run:
```bash
npm run dev
```
The server will be available at `http://localhost:5173`.

### 3. Building for Production
To create a production build, run:
```bash
npm run build
```
The output will be in the `dist/` directory.

### 4. Previewing the Build
To serve the production build locally, run:
```bash
npm run preview
```

## Coding Style and Conventions
- **Indentation**: 2 spaces.
- **Quotes**: Single quotes (`'`).
- **Semicolons**: No semicolons.
- **Trailing Commas**: Use trailing commas where valid.
- **Components**: Use PascalCase for component file names (e.g., `MyComponent.jsx`).
- **Styling**: Use Tailwind CSS utility classes directly in JSX. Avoid creating separate CSS files.

## UI Styling (Monochrome)
- Use a monochrome palette: black, white, and neutral grays only.
- Containers/cards: `bg-white border-2 border-black rounded-xl shadow-md` with adequate padding.
- Primary actions: `bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black rounded-lg`.
- Secondary actions: `bg-white border-2 border-black text-black hover:bg-gray-100`.
- Inputs/editors/previews: `bg-white border-2 border-black rounded-lg`; avoid colored focus states.
- Tabs: active tab uses black text and `border-b-2 border-black`; inactive is gray with transparent border.
- Drag-and-drop: dashed `border-2 border-dashed border-black`; hover state `bg-gray-100`.
- Feedback/status: prefer grayscale text/icons; avoid colored success/error states.
- Match the tools list styling for new pages to ensure visual consistency.

## Icons
- Standardize on Tabler Icons with `@tabler/icons-react`.
- Import only required icons to keep bundles lean (e.g., `import { IconArrowLeft } from '@tabler/icons-react'`).
- Respect the monochrome palette: inherit text color (black/gray) unless otherwise specified.

## Testing
- **Framework**: Vitest with React Testing Library.
- **File Location**: Test files should be co-located with the component they are testing (e.g., `MyComponent.test.jsx`).
- **Test Command**: `npm test` (once configured).

## Commits
- **Format**: Use Conventional Commits standard (e.g., `feat: add new feature`, `fix: resolve a bug`).

## Environment Variables
- Store secrets in a `.env` file (this file is ignored by Git).
- For new environment variables, add non-secret defaults to `.env.example`.

## Get Gemini API Key
1. Open: https://aistudio.google.com/u/0/apikey
2. Sign in with your Google account.
3. Click "Create API key" to generate a new key, or copy an existing one.
4. Paste the key into the app Settings (`/settings`) and click Save.

Notes:
- Treat the key like a password. The app stores it only in the browser (localStorage) and uses it directly to call the Gemini API from the client.
- Revoke or rotate keys anytime from Google AI Studio.

## Knowledge Sync Reminder
- If the AI identifies information useful for AI tasks that is not yet present here or in `AGENTS.md`, it must add a concise summary of that information to BOTH files.
- Insert updates into the most relevant section; if none fits, create a brief "Notes" subsection.
- Prevent duplication and maintain consistency with this document's style and tone.

## Notes
- ffmpeg.wasm: Use `@ffmpeg/ffmpeg` 0.12+ ESM API (`FFmpeg` class) and serve `@ffmpeg/core` locally under `public/ffmpeg/esm/`. Avoid sandboxed iframes (breaks workers/wasm). With Vite, set `optimizeDeps.exclude = ['@ffmpeg/ffmpeg', '@ffmpeg/util']` to prevent the dep optimizer from inlining the worker and causing missing `worker.js?...` errors.
- PWA: The app uses `vite-plugin-pwa` with `autoUpdate` registration. Manifest/workbox configuration is in `vite.config.js`. ffmpeg `.wasm` files are excluded from precache to avoid Workbox size limits on build; fetch on demand or add runtime caching if truly required. The service worker is registered in `src/main.jsx` via `registerSW`.
- PictureMe: This tool is based on the Gemini Canvas template created by the Google team, and they shared details in this X post: https://x.com/GeminiApp/status/1963615829708132611
 - Image editing (Gemini): Use `gemini-2.5-flash-image-preview:generateContent` with `contents.parts = [{ text: instruction }, { inlineData: { mimeType, data } }]`. The API may return an `inlineData` image (PNG). For background removal, ask for a transparent PNG, preserve subject edges/hair, and avoid cropping; implement simple retry/backoff on `429`.

### Flower Bouquet Generator
- Component: `src/components/FlowerBouquetGenerator.jsx` (route `/flower-bouquet`).
- Builds a detailed prompt to synthesize realistic bouquet photos using `gemini-2.5-flash-image-preview`.

### Google Search Grounding
- To allow the model to search the web and ground responses, include `tools: [{ googleSearch: {} }]` in the `generateContent` payload.
- Instruct the model to return citations (title + URL) explicitly so the client can render them.
- If the server returns an error for unsupported tools, retry the same request without `tools` as a graceful fallback.

### Information Verifier
- Component: `src/components/InformationVerifier.jsx` (route `/information-verifier`).
- Goal: Given a claim, request a grounded verification and return:
  - `verdict`: one of `Valid | Mislead | Hoax`
  - `reason`: short explanation
  - `citations`: array of `{ title, url }`
- Payload pattern:
  - `systemInstruction`: ask for strict JSON with the schema above, allow web search when available.
  - `contents`: include the claim in a clear section; request “ONLY valid JSON” in the output.
  - `tools`: include `[{ googleSearch: {} }]` for grounding; on 400/404, retry without tools.
- Response handling: parse text to JSON (allow fenced ```json blocks), normalize verdict values to the exact set, filter citations with valid URLs.

### UI Language
- All user-facing UI text must be in English across tools and pages.

### Lockfile Scanners
- `src/components/LockfileScanner.jsx` (`/lockfile-scanner`): parses JavaScript lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).
- `src/components/GemfileScanner.jsx` (`/gemfile-scanner`): parses Ruby `Gemfile.lock` files.
- `src/components/GoSumScanner.jsx` (`/go-sum-scanner`): parses Go `go.sum` files.
- Each tool queries OSV.dev and lists package name, version, status, and advisory IDs.
