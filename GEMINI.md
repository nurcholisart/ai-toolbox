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

## Knowledge Sync Reminder
- If the AI identifies information useful for AI tasks that is not yet present here or in `AGENTS.md`, it must add a concise summary of that information to BOTH files.
- Insert updates into the most relevant section; if none fits, create a brief "Notes" subsection.
- Prevent duplication and maintain consistency with this document's style and tone.

## Notes
- ffmpeg.wasm: Use `@ffmpeg/ffmpeg` 0.12+ ESM API (`FFmpeg` class) and serve `@ffmpeg/core` locally under `public/ffmpeg/esm/`. Avoid sandboxed iframes (breaks workers/wasm). With Vite, set `optimizeDeps.exclude = ['@ffmpeg/ffmpeg', '@ffmpeg/util']` to prevent the dep optimizer from inlining the worker and causing missing `worker.js?...` errors.
