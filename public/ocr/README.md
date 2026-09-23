# localism · OCR

In-browser OCR as a **suite tab** (`OCR` in the toolbar on the home page).
Drop an image, get its text — extraction runs as WebAssembly in a Web Worker
in your own tab. The engine and language models are served from this site's
own origin (never a CDN) and cached for offline reuse.

## What runs where

```
┌─ main thread (React, src/components/ocr-panel.tsx) ──────┐
│ dropzone, rotate, language, preview canvas + line boxes  │
│ src/lib/ocr-preprocess.ts  Canvas → grayscale → Otsu     │
│ src/lib/ocr.ts            worker lifecycle, queue, cache │
└──────────────────────────────┬────────────────────────────┘
                               │ postMessage (transferable ImageData)
┌──────────────────────────────┴────────────────────────────┐
│ public/ocr-worker.js  classic Web Worker                  │
│   importScripts → tesseract-core-simd.js (UMD glue)       │
│   engine: FS.writeFile('/<lang>.traineddata', bytes)      │
│           Init(null, lang, OEM_LSTM_ONLY)                 │
│   SetImage(malloc'd pixels) → Recognize → GetUTF8Text     │
│           + GetIterator line boxes (bbox + confidence)    │
└────────────────────────────────────────────────────────────┘
```

## Offline behavior
1. First run: the panel warms `eng.traineddata` on mount; the worker fetches
   wasm + traineddata same-origin on the first run, then `cache.put` under
   `localism-ocr-v1`.
2. Later runs (even fully offline): `caches.match` short-circuits. `ind`
   (Bahasa Indonesia) is only fetched on demand when selected.
3. Verify with the Network tab: no request ever targets a foreign host.

## Localness checklist (manual QA)
- [ ] Open DevTools → Network; confirm only same-origin requests
      (`/ocr-worker.js`, `/ocr/tesseract-core-simd.wasm`, `/ocr/*.traineddata`).
- [ ] Drop an image → text appears; confidence badge + line counts update;
      line boxes overlay the preview.
- [ ] Rotate 90/180/270 → boxes re-map correctly.
- [ ] Switch language to Indonesia (first use downloads `ind`), run.
- [ ] Cancel mid-run does not hang the tab (worker is respawned).
- [ ] Reload offline → warm `eng` still works.
- [ ] Download `.txt` revokes its object URL on the next download/unmount.

## Files
- `src/components/ocr-panel.tsx` — the tab UI + controller.
- `src/lib/ocr.ts` — `OCRWorker` facade (init/recognize/cancel/dispose).
- `src/lib/ocr-preprocess.ts` — Canvas 2D grayscale + percentile stretch +
  Otsu binarize.
- `public/ocr-worker.js` — the classic worker driving the Tesseract glue.
- `public/ocr/` — vendored assets (`tesseract-core-simd.js/.wasm`,
  `eng.traineddata`, `ind.traineddata`), see `VENDORING.md`. No other files.

## Rights
Engine glue/wasm: Apache-2.0 (tesseract.js-core). Traineddata: Apache-2.0
(tesseract-ocr/tessdata_fast). Page code: AGPL-3.0 (as Localism).

**Scope note:** image → text only in v1. PDF/multi-page OCR is out of scope by
design; the suite's PDF story remains the full-page opaque blackout redaction
(`public/pdf-worker.js`).