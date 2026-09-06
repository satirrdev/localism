<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Localism — repo guide

Privacy-first client-side utility suite. Next.js 16 App Router, React 19, Tailwind v4, TS 5. All processing runs in-browser via Web Workers/WASM — no backend exists.

## Read first
`.agentremember` is the canonical session file. Re-read it, and its listed files, before editing any of them. `RULES.md` / `.agentrules` hold the architectural rules.

## Workflow (non-negotiable, from .agentremember)
- Batch ALL file edits first, then ONE `npm run build` + ONE `npm run lint`. Never build after a single file edit.
- Don't kill running `next-server` processes — they may belong to other sessions. Start new servers on a new port (`next start -p 401x`).
- If `next dev`/`next build` fails, run `npx next build --webpack` to surface the real error (Turbopack hides it behind "Error evaluating Node.js code").

## Architecture rules
- ZERO server calls — computations stay 100% in-browser; never suggest an external API.
- Thread safety — heavy work (WASM, PDF, image transforms) MUST use Web Workers.
- Memory hygiene — `URL.revokeObjectURL` on every object URL; terminate workers; no RAM leaks.

## Conventions / gotchas
- Design tokens live at ROOT `tokens.css` (`@theme`). globals.css imports it as `@import "../../tokens.css";` — that path is correct relative to `src/app`; do NOT "fix" it. Never inline hex/oklch in components; add tokens to tokens.css first. Colors reference tokens (`bg-paper`, `text-ink`, `border-rule`).
- Tailwind v4: use `wrap-anywhere`, never `overflow-wrap-anywhere`. No self-referential `@theme inline { --x: var(--x) }`.
- React 19 / Next 16.3.1: `LayoutProps<"/">` typing in layout.tsx is intentional. Never mutate `ref.current` during render (lint error) — sync refs in a useEffect.
- Keep the reduced-motion block in globals.css (kills `.reveal` + `.status-dot` pulse if removed).
- Design language: single-page dark suite — the `design-structure/` files define the Raycast/zinc palette + component specs. Preserve them when restyling.

## Commands
- `npm run dev` · `npm run build` · `npm run start` · `npm run lint` (ESLint). No test runner configured.

## Directory map
- `src/app/page.tsx` — hero + floating tool tabs + per-tool panel switch; `src/app/layout.tsx` — RootLayout + Geist fonts
- `src/components/*-panel.tsx` — one file per tool (image, pdf, video, hash, watermark, bgremove); each owns its dropzone + worker lifecycle
- `src/components/site-header.tsx` · `tool-tabs.tsx` · `value-proposition.tsx` · `faq.tsx` · `reveal.tsx`
- `src/lib/ffmpeg.ts` — FFmpeg WASM wiring
- `public/*.worker.js` + `public/ffmpeg/` + `public/bgremove/` — Web Worker entry scripts and WASM cores