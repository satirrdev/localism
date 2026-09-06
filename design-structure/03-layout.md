# Page Architecture & Visual Hierarchy

The entire single-page flow follows this strict vertical order:

1. [Navbar] (Sticky or top static, max-w-5xl, mx-auto, py-4)
2. [Hero Section]
   - Eyebrow: `LOCALISM / UTILITY SUITE` (monospace text-xs text-zinc-500)
   - Title: "Your files, processed on this device."
   - Subtitle: 1 concise sentence explaining 100% in-browser processing.
3. [Interactive Tool Area]
   - Tabs Nav: Image | Video | PDF | Hash | Document Watermark
   - Active Tool Card + Dropzone + Settings Drawer + Output Preview
4. [Value Proposition / Security Architecture]
   - Title: "Compute locally. Rely on no one."
   - 3-column Bento cards showing technical proofs (Sandbox, 0 network requests, No limits).
5. [FAQ Section] (Vercel Security Accordion)
   - 3 to 5 high-impact questions verifying client-side integrity and zero tracking.
6. [Trust Footer]
   - GitHub audit badge link + minimalistic legal/attribution notice.
