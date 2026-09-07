# Security Audit Report — Localism

- **Date:** 2026-09-07
- **Mode:** full (phases 1–5: recon, white-box, gray-box, hotspot, smell)
- **Scope:** entire repository (`src/`, `public/`, config, lockfile). No `.security-audit-ignore`.
- **Result summary:** 0 CRITICAL, 0 HIGH, **2 MEDIUM**, 2 LOW, 5 INFO. No backdoor or remote-code-execution surface found.
- **Verdict:** no exploitable security bugs / no backdoors detected. Two behavioral defects in the PDF redaction tool must be fixed (see MEDIUM-001/002).

---

## Executive Summary

Localism is a zero-backend static Next.js app. All computation is client-side. The attack surface is therefore limited to: (1) the trust boundary between user-supplied files/`file.name` and the in-browser DOM, downloads, FFmpeg virtual FS and decoders; (2) output integrity of the "redaction" features; (3) supply chain of committed third-party binaries; (4) response headers.

**Verified clean:**

- 🔵 Zero network calls in `src/` — no `fetch`/`XHR`/`WebSocket`/`eval`/`innerHTML`/`dangerouslySetInnerHTML` (grep across `src/` + `public/*.worker.js`). Runtime network is limited to same-origin fetches: FFmpeg core (`public/ffmpeg/` via `@ffmpeg/util` `toBlobURL`) and ONNX models (`public/bgremove/` via `@imgly/background-removal`, `publicPath` = origin).
- 🔵 COOP `same-origin` + COEP `require-corp` set globally in `next.config.ts` `headers()`. **Verified live by curl** on `/`, `_next/static/chunks/*`, and `public/*.worker.js`.
- 🔵 All committed binaries integrity-checked:
  - `public/js-sha1.min.js`, `js-sha256.min.js`, `js-sha512.min.js`, `spark-md5.min.js`, `pdf-lib.min.js` — byte-identical (SHA-256) to the corresponding `node_modules` builds.
  - `public/ffmpeg/ffmpeg-core.wasm` = `@ffmpeg/core` `dist/esm` build; `ffmpeg-core.js` = `dist/umd` build (SHA-256 match).
  - All 86 ONNX/WASM model chunks in `public/bgremove/` are **content-addressed**: filename == SHA-256 of file content (86/86 verified; only `resources.json` is a manifest, not hash-named). Tampering with any binary breaks its own lookup — the deployment is self-authenticating.
  - `npm audit`: **0 vulnerabilities**.
- 🔵 FFmpeg arguments built exclusively from whitelisted enumerations (`FORMATS`/`CRF_PRESETS`/`RESOLUTIONS`/`SPEEDS`), no shell, no user-string interpolation; input filename regex-sanitized to `[a-zA-Z0-9._-]` (video-panel.tsx:241).
- 🔵 `file.name` flows only into the React-escaped `download` attribute and worker progress labels — no HTML rendering, filenames with quotes/`<`/`>` remain inert. Download output names are derived by stripping the extension (image-panel.tsx:44-47, video-panel.tsx:80-85, watermark-panel.tsx:710/715, bg-remove-panel.tsx:47-49, 308).
- 🔵 Blob/object-URL hygiene correct across all six panels: URLs revoked on replace/unmount; workers created once per panel and terminated on unmount (image-panel.tsx:90-96, pdf-panel.tsx:66-71, hash-panel.tsx:81-87).
- 🔵 No secrets, env usage, or `NEXT_PUBLIC_*` in `src/` or config.

---

## Findings

### 🟡 [MEDIUM-001] PDF redaction silently produces an unchanged document (fail-open)

- **OWASP 2025:** A10:2025 (Mishandling of Exceptional Conditions — silent failure)
- **CWE:** CWE-703 (Improper Check or Handling of Exceptional Conditions)
- **NIST CSF:** PR.DS (Protect — Data Security)
- **File:** `public/pdf-worker.js:36-38`
- **Vulnerable code:**

```js
if (terms.length === 0) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0), opacity: 0 });
}
```

**Detail:** When the user leaves the "Terms to redact" field blank, the UI promises to "mark all pages" (pdf-panel.tsx:364). The worker instead draws a fully **transparent** black rectangle (`opacity: 0`). The output PDF is visually unchanged yet presented as "Redacted PDF ready". A person protecting a sensitive document can walk away with an **unredacted** file while being told it was redacted. This is a silent, fail-open behavior on a security tool.

**Remediation (applied):** draw the full-page black rectangle with `opacity: 1` unconditionally; the feature is now "Blackout PDF" with no misleading search-box.

### 🟡 [MEDIUM-002] PDF redaction "terms search" is cosmetic; redacted text remains recoverable

- **OWASP 2025:** A10:2025 (Mishandling of Exceptional Conditions); A08:2025 (Data Integrity) secondary
- **CWE:** CWE-212 (Improper Cross-boundary Removal of Sensitive Data)
- **NIST CSF:** PR.DS-1 / DE.AE
- **File:** `public/pdf-worker.js:39-45`
- **Vulnerable code:**

```js
terms.forEach(() => {
  page.drawRectangle({ x: 0, y: height * 0.1, width, height: height * 0.05, color: rgb(0, 0, 0), opacity: 1 });
});
```

**Detail:** The `terms` array is never searched against the page text. Each term draws an identical, fixed-position bar (10% from the bottom, 5% tall) regardless of where the sensitive text actually appears. Users redacting "John Doe, 123-45-6789" get decorative bars while the actual values remain fully visible. Independently of positioning, covering text with vector fills **does not remove it from the PDF content stream** — the original text stays selectable/extractable from the saved file.

**Remediation (applied):** removed the fake selective search entirely; the tool now performs a single, unambiguous operation — full-page opaque blackout. True irreversible redaction would require rasterizing pages (e.g., pdf.js); flagged as a `ponytail:` upgrade path in the worker. This resolves the "claimed coverage that does not exist" hazard; PDF-level destructive removal remains a product decision, not a silent behavior.

### 🟢 [LOW-001] Framework version disclosure via `X-Powered-By`

- **OWASP 2025:** A02:2025 (Security Misconfiguration)
- **CWE:** CWE-200 (Exposure of Sensitive Information)
- **NIST CSF:** PR.IP
- **File:** `next.config.ts` (default Next.js behavior; verified live on `/`, `_next/static/*`, `public/*`)
- **Detail:** every response carries `X-Powered-By: Next.js`. Minor fingerprinting aid.
- **Remediation (applied):** `poweredByHeader: false`.

### 🟢 [LOW-002] Missing defensive response headers

- **OWASP 2025:** A02:2025 (Security Misconfiguration)
- **CWE:** CWE-693 (Protection Mechanism Failure)
- **NIST CSF:** PR.IP / PR.DS
- **File:** `next.config.ts`
- **Detail:** no CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, or `Permissions-Policy` (verified live). COOP/COEP are present and correct.
- **Remediation (applied):** added `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()`.
  - **CSP deferred, not applied:** App Router emits inline bootstrap + RSC payload scripts (verified in served HTML), and workers/WASM need `blob:` + `wasm-unsafe-eval`, so a working policy requires `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:`. It cannot be validated here without a browser; enabling unvalidated CSP risks breaking the WASM tools (ffmpeg/bg-removal) in production. Ship it after browser QA. Candidate policy is in **Recommendation R2**.

### 🔵 [INFO-001] Large binary artifacts committed to the repository

- **OWASP 2025:** A03:2025 (Software Supply Chain Failures)
- **CWE:** CWE-494 (Download of Code Without Integrity Check)
- **NIST CSF:** GV.SC / PR.DS
- **File:** `public/bgremove/` (86 chunks + `resources.json`), `public/ffmpeg/`
- **Detail:** ~250 MB of WASM/ONNX binaries tracked in git (verified, 89 files). Integrity is strong today (content-addressed chunks; byte-matches with `node_modules`), but provenance is implicit. A future update of `@imgly/background-removal` or `@ffmpeg/core` could drift from the committed copies without notice.
- **Recommendation:** document the sync procedure (npm package → `public/` copy + hash check) in `.agentremember`; add `npm audit` to CI when one exists.

### 🔵 [INFO-002] Self-DoS via crafted large media (no decode limits)

- **OWASP 2025:** A10:2025 (Resource exhaustion); A06:2025 secondary
- **CWE:** CWE-770 (Allocation of Resources Without Limits)
- **NIST CSF:** PR.DS
- **File:** image-panel.tsx:134-137, watermark-panel.tsx:260-271, bg-remove-panel.tsx, video-panel.tsx
- **Detail:** no dimension/size cap on decode — a crafted huge image can exhaust the visitor's own tab (decode happens in workers/OffscreenCanvas, so only that tab is affected; nothing leaks to server).
- **Recommendation:** accept as documented client-only risk, or add a soft `file.size` (e.g., 512 MB) pre-check with a clear message. Not applied — would alter product behavior.

### 🔵 [INFO-003] No CSP (defense in depth deferred)

- **OWASP 2025:** A02:2025
- **CWE:** CWE-693
- **NIST CSF:** PR.DS
- **Recommendation:** after browser QA, enable the policy in R2.

### 🔵 [INFO-004] Process gaps: no CI, SAST, or tests

- **NIST CSF:** GV.RR / DE.CM
- **Detail:** `npm run lint` (ESLint) is the only gate. There is no CI (`.github/` absent), no dependency-audit job, no test runner.
- **Recommendation:** a minimal CI running `npm audit` + `npm run lint` + `npm run build` covers the remaining supply-chain and regression risk.

### 🔵 [INFO-005] `multiple` attribute on single-file dropzones

- **File:** image-panel.tsx:268, watermark-panel.tsx:383, hash-panel.tsx:267, video-panel.tsx:380, bg-remove-panel.tsx:343
- **Detail:** inputs allow multi-select; staging logic picks the first/right file. Cosmetic; harmless. No finding beyond noticing inconsistent UX.

---

## Recommendations by OWASP Category

**A02 (Security Misconfiguration) — mostly fixed.**
- (Done) `poweredByHeader: false`, `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy`.
- R1. Enable CSP after browser QA:
  `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`.
  Requires verifying FFmpeg + bg-removal + image/video previews under the policy in a real browser first (`wasm-unsafe-eval` and `blob:` are load-bearing).
- R2. When behind a real domain, add HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).

**A08 / A10 (Data integrity / exceptional conditions) — fixed.**
- MEDIUM-001/002 remediated: PDF tool is now an honest full-page blackout; decorative fake search removed; worker fails predictably (always opaque) instead of silently.

**A03 (Supply chain) — verified clean; keep it that way.**
- All vendored binaries match their npm origins, `npm audit` = 0. No further action required beyond INFO-001.

---

## Baseline

Fingerprints written to `.security-audit-baseline.json`. Re-run with `--diff-report` to see deltas.

## Scope Exclusions
None (no `.security-audit-ignore`). `node_modules/`, `.next/`, `package-lock.json` scanned via `npm audit` instead of line review.