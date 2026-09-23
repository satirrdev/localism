/* ocr.ts — main-thread facade for the OCR micro-tool.
 *
 * Manages a single classic Web Worker (`/ocr-worker.js`) that drives the
 * vendored Tesseract SIMD core. Everything stays same-origin: wasm, glue and
 * traineddata are fetched from this site and cached via the Cache Storage
 * API (`localism-ocr-v1`) so repeat visits work fully offline.
 *
 * No browser globals are touched at module scope — the panel imports this
 * during SSR, so everything here runs inside methods only.
 */

export const LANGUAGES = new Set(["eng", "ind"]);

export const DEFAULT_LANG = "eng";

export const OCR_CACHE = "localism-ocr-v1";

export interface OCRBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: OCRBBox;
}

export interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLine[];
}

type PendingEntry = {
  resolve: (r: OCRResult) => void;
  reject: (err: Error) => void;
  onProgress?: (status: string, progress: number) => void;
};

interface WorkerReadyMessage {
  type: "ready";
  lang: string;
}

interface WorkerStatusMessage {
  type: "progress";
  jobId: number | null;
  status: string;
  progress: number;
}

interface WorkerResultMessage {
  type: "result";
  jobId: number;
  text: string;
  confidence: number;
  lines: OCRLine[];
}

interface WorkerErrorMessage {
  type: "error";
  jobId: number | null;
  message: string;
}

type WorkerMessage =
  | WorkerReadyMessage
  | WorkerStatusMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

/** Resolve a public asset path to an absolute same-origin URL. */
function assetUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export class OCRWorker {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private readyLang = "";
  private jobId = 0;
  private pending = new Map<number, PendingEntry>();
  private busy = false;

  /**
   * Warm the cache with the default language. Call once the OCR panel
   * mounts so the first run is instant / offline-ready.
   */
  async warmup(): Promise<void> {
    if (!("caches" in window)) return;
    try {
      await this.cacheLang(DEFAULT_LANG);
    } catch {
      /* register-warm is an optimization; init() will surface real errors */
    }
  }

  /** Start the worker / engine for a language (eager eng, lazy ind). */
  async init(lang = DEFAULT_LANG): Promise<void> {
    const target = LANGUAGES.has(lang) ? lang : DEFAULT_LANG;

    if (this.ready && this.readyLang === target) {
      await this.ready;
      return;
    }

    await this.cacheLang(target);

    if (!this.worker) {
      this.worker = new Worker(assetUrl("/ocr-worker.js"));
      this.worker.addEventListener("message", (e) => this.handleMessage(e.data));
      this.worker.addEventListener("error", (e) => {
        this.pending.forEach((entry) => entry.reject(new Error(e.message || "worker error")));
        this.pending.clear();
        this.ready = null;
        this.worker?.terminate();
        this.worker = null;
      });
    }

    const initDone = this.waitReady({
      type: "init",
      glueUrl: assetUrl("/ocr/tesseract-core-simd.js"),
      wasmUrl: assetUrl("/ocr/tesseract-core-simd.wasm"),
      langUrl: assetUrl(`/ocr/${target}.traineddata`),
      lang: target,
    });

    this.ready = initDone;
    this.readyLang = target;
    try {
      await initDone;
    } catch (err) {
      this.ready = null;
      this.readyLang = "";
      throw err;
    }
  }

  /**
   * Run OCR on pre-processed pixels. Returns { text, confidence, lines }.
   * The caller's ImageData is copied before transfer so it can be re-used
   * for a second run without re-reading the file.
   */
  async recognize(
    imageData: ImageData,
    opts: { onProgress?: (status: string, progress: number) => void } = {},
  ): Promise<OCRResult> {
    await this.init();

    if (this.busy) {
      throw new Error("An OCR job is already running. Wait for it to finish or cancel it.");
    }
    this.busy = true;
    const jobId = ++this.jobId;

    const body = new Uint8Array(imageData.data);

    return new Promise<OCRResult>((resolve, reject) => {
      this.pending.set(jobId, {
        resolve,
        reject,
        onProgress: opts.onProgress,
      });

      this.worker?.postMessage(
        {
          type: "recognize",
          jobId,
          width: imageData.width,
          height: imageData.height,
          imageData: {
            width: imageData.width,
            height: imageData.height,
            data: new Uint8ClampedArray(body),
          },
        },
        [body.buffer],
      );
    }).finally(() => {
      this.busy = false;
    });
  }

  /** Cancel the current job (cooperative; hard-respawns the worker if mid-wasm). */
  async cancel(jobId: number | null = null): Promise<void> {
    const id = jobId ?? this.pending.keys().next().value ?? null;
    if (id == null) return;

    const entry = this.pending.get(id);
    if (entry) {
      entry.reject(new Error("OCR cancelled"));
      this.pending.delete(id);
    }

    if (this.worker && this.busy) {
      this.worker.postMessage({ type: "cancel", jobId: id });
      await this.respawn();
    }
  }

  /** Hard-stop the worker (called on panel unmount). */
  dispose(): void {
    this.pending.forEach((entry) => entry.reject(new Error("OCR worker disposed")));
    this.pending.clear();
    this.ready = null;
    this.readyLang = "";
    this.busy = false;
    if (this.worker) {
      this.worker.postMessage({ type: "terminate" });
      this.worker.terminate();
      this.worker = null;
    }
  }

  private async cacheLang(lang: string): Promise<void> {
    const url = assetUrl(`/ocr/${lang}.traineddata`);
    try {
      const cache = await caches.open(OCR_CACHE);
      if (await cache.match(url)) return;
      const resp = await fetch(url, { credentials: "same-origin" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${lang}.traineddata`);
      await cache.put(url, resp);
    } catch (err) {
      throw new Error(
        `Language data "${lang}" not available yet: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private waitReady(message: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker) {
        reject(new Error("worker missing"));
        return;
      }
      const onMessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m && m.type === "ready") {
          worker.removeEventListener("message", onMessage);
          resolve();
        } else if (m && m.type === "error" && m.jobId == null) {
          worker.removeEventListener("message", onMessage);
          reject(new Error(m.message));
        }
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage(message);
    });
  }

  private async respawn(): Promise<void> {
    try {
      this.worker?.postMessage({ type: "terminate" });
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    this.ready = null;
    this.readyLang = "";
    this.busy = false;
  }

  private handleMessage(msg: WorkerMessage): void {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "progress": {
        const entry = msg.jobId == null ? null : this.pending.get(msg.jobId);
        if (entry && entry.onProgress) entry.onProgress(msg.status, msg.progress);
        break;
      }
      case "result": {
        const entry = this.pending.get(msg.jobId);
        if (!entry) break;
        this.pending.delete(msg.jobId);
        entry.resolve({
          text: msg.text,
          confidence: msg.confidence,
          lines: msg.lines || [],
        });
        break;
      }
      case "error": {
        if (msg.jobId == null) {
          this.pending.forEach((entry) => entry.reject(new Error(msg.message)));
          this.pending.clear();
          this.ready = null;
          this.readyLang = "";
          break;
        }
        const entry = this.pending.get(msg.jobId);
        if (!entry) break;
        this.pending.delete(msg.jobId);
        entry.reject(new Error(msg.message));
        break;
      }
      default:
        break;
    }
  }
}