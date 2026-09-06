# Motion & Animation Guidelines: Localism

## 1. Core Principles
- Snappy & Functional: Animations exist only to provide immediate visual feedback.
- Max Duration: 150ms to 250ms. Never exceed 300ms for UI state changes.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) or standard `ease-out`.
- GPU Only: Strictly animate `transform` (scale, translate) and `opacity`. Never animate `width`, `height`, or `margin` directly to avoid layout thrashing.

## 2. Micro-Interactions Blueprint
- Tab Indicator: Animated sliding pill background using Framer Motion (`layoutId="active-tab"`) or CSS transitions.
- Dropzone Drag-Over: Subtle border glow pulse (`border-zinc-500`, `scale-[1.008]`, `transition-transform duration-200`).
- Processing States: Smooth shimmer skeleton on loading bars, never a blocking full-screen spinner.
- Card Hover: Gentle border shift from `border-zinc-800/80` to `border-zinc-600` with subtle elevation translate (`-translate-y-0.5`).
- Success States: Crisp checkmark scale-in bounce (`scale-0` to `scale-100` in 150ms).
