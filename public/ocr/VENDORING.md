# VENDORING.md — OCR core assets

All OCR runtime assets live in this directory and are served from the same
origin as the page (COOP `same-origin` + COEP `require-corp` are satisfied —
nothing crosses to third parties, ever).

## Contents

| File | Size | Source |
|------|------|--------|
| `tesseract-core-simd.wasm` | 3.5 MB | tesseract.js-core@6.1.2 (`tesseract.js-core/dist/tesseract-core-simd.wasm`) |
| `tesseract-core-simd.js` | 122 KB | tesseract.js-core@6.1.2 (`tesseract.js-core/dist/tesseract-core-simd.js`, minified UMD glue) |
| `eng.traineddata` | 4.1 MB | tesseract-ocr/tessdata_fast@main (`eng.traineddata`, LSTM fast) |
| `ind.traineddata` | 1.1 MB | tesseract-ocr/tessdata_fast@main (`ind.traineddata`, LSTM fast) |

Models are single-thread SIMD builds. The glue is a classic-script UMD: the
worker does `importScripts("tesseract-core-simd.js")` and relies on the top-level
`var TesseractCore` landing on the worker global. Do not switch to a module
worker or Node build without re-testing.

## Re-vendor steps

```bash
# core bits (npm)
npm pack tesseract.js-core@6.1.2
tar xzf tesseract.js-core-6.1.2.tgz
cp package/tesseract-core-simd.js package/tesseract-core-simd.wasm public/ocr/

# language packs (GitHub upstream, tessdata_fast = LSTM integer fast)
curl -L -o public/ocr/eng.traineddata \
  https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata
curl -L -o public/ocr/ind.traineddata \
  https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/ind.traineddata
```

## Integrity check

Expected SHA-256 (verify with `shasum -a 256` after any re-vendor):

```
[tesseract-core-simd.wasm]  ca11ee92a02023e4f5083eefd0966fb83b297416da54e997b9f6ce445f719c9b
[tesseract-core-simd.js]     85762abcc52bc6f4762b1429e2986c8ea963db76632770970c0485fb6d6aa820
[eng.traineddata]            7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2
[ind.traineddata]            69786901da87ab8766c1ea7fbb10b28f2110c14da3f6c8f2735df131fba95d88
```

Run `npm audit` after touching deps; there are no runtime npm dependencies
for this page (values above were computed at vendoring time, replace with
`shasum -a 256` output).

## Why bundled, not CDN
- COOP `same-origin` + COEP `require-corp` block cross-origin subresources
  unless CORP-marked; a CDN would need CORP plus be a third-party trust.
- Zero-network rule is architectural: `public/` is itself covered by the CSP
  draft and the "no external resources" audit item. First visit fetches
  wasm+traineddata same-origin (fast on a shared host), then Cache API
  (`localism-ocr-v1`) makes subsequent visits fully offline.

## Runtime wiring
- Glue + wasm: absolute URLs resolved in `src/lib/ocr.ts` from the page
  origin (`/ocr/tesseract-core-simd.wasm`, `/ocr/tesseract-core-simd.js`).
- Worker (`public/ocr-worker.js`) receives `glueUrl`/`wasmUrl`/`langUrl` in
  the init message and loads the glue via `importScripts`; it fetches the
  wasm and traineddata through `caches.match` first, then same-origin
  `fetch`. Everything is same-origin.
- Language packs are identical flow; `ind` is lazy (only fetched when the
  user switches). `eng` is warmed on panel mount.