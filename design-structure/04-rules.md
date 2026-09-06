# Hard Constraints for AI (Anti-Hallucination Guardrails)

When generating or editing code for Localism, you MUST follow these rules:

1. NEVER suggest light mode classes (no `bg-white`, no `text-black` on main layouts).
2. NEVER install heavy 3D or WebGL canvas animation libraries (Three.js, tsParticles) for background visuals. All glowing effects must be lightweight CSS gradients only.
3. NEVER make fetch/axios calls sending user files to any endpoint. Processing must always stay in-memory (Web Workers, WASM, Web Crypto, Canvas API).
4. ALWAYS add mobile responsiveness:
   - Ensure horizontal scrolling on tabs (`overflow-x-auto no-scrollbar`).
   - Use dynamic touch labels ("Drop files here or tap to browse").
5. ALWAYS pair Geist Sans with Geist Mono appropriately. Monospace is reserved exclusively for stats, numbers, code, file paths, and hashes.

