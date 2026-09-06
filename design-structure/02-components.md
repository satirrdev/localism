# Component Specifications

## 1. Top Navbar
- Logo left: Plain monospace or geometric icon + bold lowercase "localism".
- Status right: Clickable pill badge (`rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs font-mono`).
- Status indicator: Pulsing green dot `w-2 h-2 rounded-full bg-emerald-500`.

## 2. Tabs Bar
- Floating horizontal pill bar (`inline-flex p-1 bg-zinc-900/60 border border-zinc-800 rounded-xl`).
- Active Tab: `bg-zinc-800 text-zinc-100 shadow-sm`.
- Inactive Tab: `text-zinc-400 hover:text-zinc-200`.

## 3. The Dropzone
- Always integrated with the active tool config.
- Border: 2px dashed `border-zinc-700/60` with hover state `border-zinc-500`.
- Background: Subtly tinted `bg-zinc-900/30`.
- Entire surface must be clickable for mobile tap-to-upload.

## 4. Bento Feature Cards (Vercel Style)
- Grid: `grid grid-cols-1 md:grid-cols-3 gap-4`.
- Card style: `p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition`.
- Icon: Monochromatic Lucide icon inside a small square box `w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center`.

## 5. FAQ Accordion
- Minimalist divider style (`border-b border-zinc-800/80 py-4`).
- Trigger: Clean sans-serif, bold hover effect, chevron rotated on open.
- Content: `text-zinc-400 text-sm leading-relaxed pt-2`.
