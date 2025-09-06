# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Vite entry HTML.
- `src/main.jsx`: App bootstrap.
- `src/App.jsx`: AIToolbox UI.
- `src/index.css`: Tailwind entry and global styles.
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js`: tooling configuration.
- Conventions: place reusable components in `src/components/` and assets in `src/assets/` (create these folders as needed).

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server (default `http://localhost:5173`).
- `npm run build`: production build to `dist/`.
- `npm run preview`: serve the built `dist/` locally to verify production output.

## Coding Style & Naming Conventions
- React: functional components with hooks; component files use PascalCase (e.g., `ToolCard.jsx`).
- Files: `.jsx` for components, `.css` only for Tailwind entry; prefer co-located modules.
- JavaScript: 2‑space indentation, single quotes, no semicolons (match existing files), and trailing commas where valid.
- Styling: favor Tailwind utility classes; avoid custom CSS unless necessary. Keep JSX shallow by extracting subcomponents.

## UI Styling (Monochrome)
- Base palette: black, white, and neutral grays only (no blues/greens/reds for accents).
- Cards/containers: `bg-white border-2 border-black rounded-xl shadow-md` with comfortable padding.
- Buttons (primary): `bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black` and `rounded-lg`.
- Buttons (secondary/utility): `bg-white border-2 border-black text-black hover:bg-gray-100`.
- Inputs/textarea/previews: `bg-white border-2 border-black rounded-lg` and remove colored focus rings.
- Tabs: active uses black text + `border-b-2 border-black`; inactive uses neutral gray text with transparent border.
- Drag & drop areas: dashed `border-2 border-dashed border-black`; hover/drag state uses subtle `bg-gray-100`.
- Status/feedback: use grayscale text/icons; avoid colored success/error states.
- Consistency: align tool pages with the tools list style (monochrome cards, 2px black borders, rounded corners).

## Icons
- Use Tabler Icons via `@tabler/icons-react`.
- Import only the needed icons (e.g., `import { IconArrowLeft } from '@tabler/icons-react'`).
- Keep icon color monochrome: default `currentColor` with black/gray text.

## Testing Guidelines
- Tests are not configured yet. Recommended stack: Vitest + React Testing Library.
- Co‑locate tests as `Component.test.jsx` next to the source file.
- Aim for critical-path coverage (rendering, interactions). Add `npm test` when tests are introduced.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`.
- Keep commits scoped and descriptive; reference related issues (e.g., `#123`).
- PRs must include: summary, rationale, screenshots for UI changes, and verification steps (commands, navigation path).

## Security & Configuration Tips
- Never commit secrets. Use `.env` locally (already gitignored); provide non‑secret defaults in `.env.example` when adding env vars.
- Node 18+ is recommended for Vite 5. Document any new scripts or commands in the README.

## Knowledge Sync Reminder
- If the AI discovers useful information for AI work that is not yet documented here or in `GEMINI.md`, it must add a concise summary of that information to BOTH files.
- Place the addition in the most relevant section; if no suitable section exists, create a short "Notes" subsection.
- Avoid duplication, keep entries factual and scoped, and follow the existing tone and formatting.

## Notes
- ffmpeg.wasm usage: In-browser video conversion is supported with `@ffmpeg/ffmpeg`. For 0.12+, prefer the ESM API (`new FFmpeg()`) and serve `@ffmpeg/core` locally (e.g., `/public/ffmpeg/esm/ffmpeg-core.js`). Avoid restrictive iframes/sandboxes that break workers/wasm. With Vite, exclude `@ffmpeg/ffmpeg` and `@ffmpeg/util` from `optimizeDeps` so the worker import (`new URL('./worker.js', import.meta.url)`) resolves correctly.
 - PWA: We use `vite-plugin-pwa` with `registerType: 'autoUpdate'`. The manifest and Workbox config live in `vite.config.js`. Include `.wasm` in `workbox.globPatterns` so ffmpeg assets under `/public/ffmpeg/` can be cached for offline use. Service worker is registered in `src/main.jsx` via `registerSW({ immediate: true })`.
