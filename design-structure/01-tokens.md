# Design Tokens: Localism

## 1. Palette (Raycast / High-End Dark Palette)
- Background Base: `#050505` (Tailwind: `bg-zinc-950` or custom `#050505`)
- Surface Raised (Cards/Panels): `#0d0e11` or `bg-zinc-900/40`
- Surface Overlay (Popovers/Tooltips): `#14161b` or `bg-zinc-900`
- Border Subtle: `border-zinc-800/60`
- Border Active / Hover: `border-zinc-700`
- Text Primary: `#fafafa` (`text-zinc-100`)
- Text Muted: `#a1a1aa` (`text-zinc-400`)
- Text Dim: `#71717a` (`text-zinc-500`)

## 2. Accents
- Security / Online Dot: Emerald 500 (`#10b981`)
- Ambient Hero Glow: Radial gradient `rgba(16, 185, 129, 0.10)` or `rgba(225, 29, 72, 0.10)` at top center

## 3. Typography
- Sans Font: Geist Sans (`font-sans`) for headings, body, UI controls
- Mono Font: Geist Mono (`font-mono`) for checksums, file sizes, speeds, tags, badges
- Heading Scale:
  * H1 (Hero): `text-3xl sm:text-5xl font-semibold tracking-tight`
  * H2 (Section): `text-xl sm:text-2xl font-medium tracking-tight`
  * Body: `text-sm text-zinc-400 leading-relaxed`
  * Microcopy / Badges: `text-xs font-mono`

## 4. Radii & Spacing
- Container Radius: `rounded-2xl`
- Element Radius (Buttons, Inputs): `rounded-lg`
- Badges: `rounded-full`
