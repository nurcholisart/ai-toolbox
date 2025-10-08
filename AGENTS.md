# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Vite entry HTML.
- `src/main.jsx`: App bootstrap.
- `src/App.jsx`: Toolbox UI.
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

### UI Language
- All user-facing UI text must be in English. Update any Indonesian copy to English when adding or modifying components.

### Semantic HTML
- Principle: use elements for meaning, not appearance (e.g., use `h1` for the page title, not a styled `div`).
- Benefits: improves accessibility (landmarks like `header`, `nav`, `main`), SEO (clear hierarchy), and maintainability (readable structure).
- Tags to prefer: `header`, `nav`, `main`, `article`, `section`, `aside`, `footer`, `h1`–`h6`, `ul/ol > li`, `table > thead/tbody/tr/th/td`, `button` for actions, `a` for navigation, `label`+`input` pairs.
- React practices:
  - Avoid wrapper `div`s; use React Fragments (`<>...</>`) to group without altering semantics, especially inside lists/tables.
  - Keep one `h1` per view and use descending `h2`–`h6` for subsections.
  - Allow polymorphic components via an `as` prop when appropriate (e.g., `<Title as="h2">`).
- Example (concise):
  ```jsx
  // Good: semantic structure
  export function BlogPost() {
    return (
      <article className='post'>
        <header><h1>My First Blog Post</h1><p>By Jane Doe</p></header>
        <section><p>Content...</p></section>
        <footer><p>Posted on Sep 19, 2025</p></footer>
      </article>
    )
  }

  // Good: fragment avoids invalid wrappers in tables
  function RowCells() { return (<><td>Item</td><td>Description</td></>) }
  ```

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

### Dialogs & Menus
- Modals: use native HTML `dialog` with `showModal()`/`close()`; avoid custom overlay divs.
- Dropdowns/menus: prefer non-modal `dialog` (`open` attribute) positioned near the trigger.
- Keep styling monochrome; provide explicit close buttons and support `Escape` to close.

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
- Remember to always documenting useful information of AI work that is not yet documented.
- Place the addition in the most relevant section; if no suitable section exists, create a short "Notes" subsection.
- Avoid duplication, keep entries factual and scoped, and follow the existing tone and formatting.

## Notes
- ffmpeg.wasm usage: In-browser video conversion is supported with `@ffmpeg/ffmpeg`. For 0.12+, prefer the ESM API (`new FFmpeg()`) and serve `@ffmpeg/core` locally (e.g., `/public/ffmpeg/esm/ffmpeg-core.js`). Avoid restrictive iframes/sandboxes that break workers/wasm. With Vite, exclude `@ffmpeg/ffmpeg` and `@ffmpeg/util` from `optimizeDeps` so the worker import (`new URL('./worker.js', import.meta.url)`) resolves correctly.
- PWA: We use `vite-plugin-pwa` with `registerType: 'autoUpdate'`. The manifest and Workbox config live in `vite.config.js`. Large ffmpeg `.wasm` files are excluded from precache (build size limits); they are fetched on demand. Add runtime caching if needed. Service worker is registered in `src/main.jsx` via `registerSW({ immediate: true })`.
- Query Explorer ("Query Result" tool) intentionally renders full width without a max-width container. Preserve this behavior for future changes.

### SEO & Crawling
- robots.txt: Keep a real text file at `public/robots.txt`. Without it, hosting fallbacks can serve `index.html`, which makes Lighthouse report “robots.txt is not valid”.
- Sitemap: Provide `public/sitemap.xml` and link it from `robots.txt` with an absolute URL: `Sitemap: https://toolbox.nurcholis.art/sitemap.xml`.
- Routing: The app uses path-based routes (History API). Crawlers do not discover hash (`/#/…`) routes; keep URLs like `/information-verifier`.
- Verify locally: run `npm run dev` then open `/robots.txt` and `/sitemap.xml`. After deploy, re-run Lighthouse SEO.
- Maintenance: when adding a tool/page, add its path to `public/sitemap.xml` to keep discovery current.

### Notes Scope
This document focuses on repo-wide guidelines and patterns. Tool-specific documentation lives with the component or in README/feature docs.


# Finally, Never assume that your code is error-free. Always test and build after you write code!
