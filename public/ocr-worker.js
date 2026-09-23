/* ocr-worker.js — OCR Web Worker (classic, importScripts-based).
 *
 * Drives the vendored Tesseract SIMD core with NO tesseract.js package, no
 * bundler and no runtime downloads. The glue (`tesseract-core-simd.js`) is a
 * UMD whose top-level `var TesseractCore` becomes a worker global when loaded
 * via importScripts. All asset URLs are passed from the engine on init and are
 * always same-origin — nothing is ever fetched from a CDN.
 *
 * Protocol (main -> worker):
 *   { type: 'init', glueUrl, wasmUrl, langUrl, lang }   load engine once
 *   { type: 'recognize', imageData, width, height, jobId }  ImageData transferable
 *   { type: 'cancel', jobId }                           cooperative cancel
 *   { type: 'terminate' }                               hard shutdown
 *
 * Protocol (worker -> main):
 *   { type: 'ready' }
 *   { type: 'progress', jobId, status, progress }       progress 0..1
 *   { type: 'result', jobId, text, confidence, lines: [{text, confidence, bbox}] }
 *   { type: 'error', jobId, message }
 */

const LANGUAGES = new Set(["eng", "ind"]);
const CACHE = "localism-ocr-v1";
const OEM_LSTM_ONLY = 3;

let engine = null;
let langLoaded = "";
let busy = false;
let currentJob = null;
let cancelled = false;

/**
 * Cache-first fetch helper (Cache Storage API). After the first load the
 * asset is served from cache, so a later visit works even fully offline.
 */
async function cachedFetch(url) {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    await cache.put(url, resp.clone());
    const fresh = await cache.match(url);
    if (fresh) return new Uint8Array(await fresh.arrayBuffer());
    return new Uint8Array(await resp.arrayBuffer());
  } catch (err) {
    throw new Error(`Failed to load ${url}: ${err.message}`);
  }
}

/**
 * Load the vendored glue. importScripts executes it; the factory it installs
 * on `self` returns a Promise of the wasm module.
 */
function loadCore(glueUrl) {
  return new Promise((resolve, reject) => {
    importScripts(glueUrl);
    const factory = self.TesseractCore;
    if (typeof factory !== "function") {
      reject(new Error("tesseract-core-simd.js did not expose TesseractCore"));
      return;
    }
    resolve(factory);
  });
}

/**
 * Initialize the wasm + language ONCE, then keep the engine for all jobs.
 * Language switches tear down and rebuild the engine in this same process.
 */
async function init(payload) {
  const lang = String(payload.lang || "eng").toLowerCase();
  if (!LANGUAGES.has(lang)) throw new Error(`Unsupported language: ${lang}`);
  const { glueUrl, wasmUrl, langUrl } = payload;
  if (!glueUrl || !wasmUrl || !langUrl) {
    throw new Error("init payload must include glueUrl, wasmUrl and langUrl");
  }

  if (engine && langLoaded === lang) return;
  if (engine) {
    // language switch: tear down the old engine, keep the worker process
    try {
      engine.api.End();
      engine.module.destroy(engine.api);
    } catch {
      /* already torn down */
    }
    engine = null;
  }

  postMessage({ type: "progress", jobId: null, status: "loading engine", progress: 0 });

  const factory = await loadCore(glueUrl);
  const wasmBinary = await cachedFetch(wasmUrl);
  const traineddata = await cachedFetch(langUrl);

  const module = await factory({
    wasmBinary,
    print: () => {},
    printErr: () => {},
    TesseractProgress(pct) {
      if (currentJob) {
        postMessage({
          type: "progress",
          jobId: currentJob,
          status: "recognizing",
          progress: 0.5 + (pct / 100) * 0.5,
        });
      }
    },
  });

  module.FS.writeFile(`/${lang}.traineddata`, traineddata);

  const api = new module.TessBaseAPI();
  const status = api.Init(null, lang, OEM_LSTM_ONLY);
  if (status !== 0) throw new Error(`Tesseract init failed (${status}); language data missing?`);
  api.SetVariable("debug_file", "/dev/null");
  api.SetVariable("preserve_interword_spaces", "1");

  engine = { module, api };
  langLoaded = lang;
  postMessage({ type: "ready", lang });
}

function alive() {
  return !cancelled;
}

/**
 * Feed raw RGBA bytes into the engine. We copy into the wasm heap, feed via
 * SetImage(ptr, w, h, bytesPerPixel, bytesPerLine), recognize, then free. The
 * engine references the heap buffer synchronously so freeing after Recognize
 * is safe. The heap is always freed in `finally`, even on early returns.
 */
function recognize(payload) {
  const { imageData, width, height, jobId } = payload;
  if (!engine) throw new Error("Engine not initialized");
  if (busy) throw new Error("Worker is busy");

  busy = true;
  cancelled = false;
  currentJob = jobId;
  const { module, api } = engine;
  let ptr = 0;

  try {
    postMessage({ type: "progress", jobId, status: "preparing", progress: 0.1 });
    if (!alive()) return;

    const bytes = imageData.data;
    ptr = module._malloc(bytes.byteLength);
    module.HEAPU8.set(bytes, ptr);

    postMessage({ type: "progress", jobId, status: "recognizing", progress: 0.35 });
    if (!alive()) return;

    api.SetImage(ptr, width, height, 4, width * 4);
    api.Recognize(null);

    if (!alive()) return;

    // --- text + overall confidence -------------------------------------------
    const text = api.GetUTF8Text() || "";
    let confidence = api.MeanTextConf();
    if (typeof confidence !== "number" || Number.isNaN(confidence)) confidence = 0;
    confidence = Math.max(0, Math.min(100, confidence));

    // --- line boxes via the result iterator ----------------------------------
    const lines = [];
    const ri = api.GetIterator();
    ri.Begin();
    do {
      if (ri.IsAtBeginningOf(module.RIL_TEXTLINE)) {
        const bbox = ri.getBoundingBox(module.RIL_TEXTLINE);
        const lineText = (ri.GetUTF8Text(module.RIL_TEXTLINE) || "").trim();
        if (!lineText) continue;
        const lineConf = Math.max(
          0,
          Math.min(100, Number(ri.Confidence(module.RIL_TEXTLINE)) || 0),
        );
        lines.push({
          text: lineText,
          confidence: lineConf,
          bbox: {
            x: bbox.x0,
            y: bbox.y0,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0,
          },
        });
      }
    } while (ri.Next(module.RIL_TEXTLINE));
    module.destroy(ri);

    postMessage({ type: "progress", jobId, status: "done", progress: 1 });
    postMessage({ type: "result", jobId, text, confidence, lines });

    api.Clear();
  } catch (err) {
    postMessage({ type: "error", jobId, message: String(err && err.message ? err.message : err) });
  } finally {
    if (ptr) module._free(ptr);
    busy = false;
    currentJob = null;
  }
}

self.onmessage = (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "init":
      init(msg).catch((err) =>
        postMessage({ type: "error", jobId: null, message: `init: ${err.message}` }),
      );
      break;

    case "recognize":
      if (!engine) {
        postMessage({ type: "error", jobId: msg.jobId, message: "not initialized; send init first" });
        return;
      }
      recognize(msg);
      break;

    case "cancel":
      cancelled = true;
      break;

    case "terminate":
      try {
        if (engine) {
          engine.api.End();
          engine.module.destroy(engine.api);
        }
      } catch {
        /* already torn down */
      }
      self.close();
      break;

    default:
      postMessage({ type: "error", jobId: msg.jobId || null, message: `unknown message type: ${msg.type}` });
  }
};