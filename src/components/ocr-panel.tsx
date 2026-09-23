"use client";

import {
  Check,
  Copy,
  Download,
  Loader2,
  RotateCw,
  ScanText,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { Tool } from "./tool-tabs";
import { OCRWorker, DEFAULT_LANG, type OCRLine, type OCRResult } from "@/lib/ocr";
import { toOcrImageData } from "@/lib/ocr-preprocess";

/* ── Types / constants ─────────────────────────────────── */

type OcrLang = "eng" | "ind";
type Rotate = 0 | 90 | 180 | 270;

const ROTATIONS: { value: Rotate; label: string }[] = [
  { value: 0, label: "0°" },
  { value: 90, label: "90°" },
  { value: 180, label: "180°" },
  { value: 270, label: "270°" },
];

const LANGS: { value: OcrLang; label: string }[] = [
  { value: "eng", label: "English" },
  { value: "ind", label: "Indonesia" },
];

const IMAGE_RE = /^image\/(jpeg|png|webp|bmp)$/i;
const IMAGE_NAME_RE = /\.(jpe?g|png|webp|bmp)$/i;

function sanitizeName(name: string): string {
  return name.replace(IMAGE_NAME_RE, "") || "ocr";
}

function isImage(file: File): boolean {
  return IMAGE_RE.test(file.type) || IMAGE_NAME_RE.test(file.name);
}

/* ── Component ─────────────────────────────────────────── */

export function OcrPanel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotate, setRotate] = useState<Rotate>(0);
  const [lang, setLang] = useState<OcrLang>(DEFAULT_LANG);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ocrRef = useRef<OCRWorker | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const linesRef = useRef<OCRLine[] | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOcr = useCallback(() => {
    if (!ocrRef.current) ocrRef.current = new OCRWorker();
    return ocrRef.current;
  }, []);

  /* ── lifecycle ────────────────────────────── */

  // Warm the default language cache once the panel mounts, so the first
  // real run is fast and repeat visits work fully offline.
  useEffect(() => {
    let cancelled = false;
    getOcr()
      .warmup()
      .catch(() => {
        /* warm cache is an optimization; init() surfaces real errors */
      });
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [getOcr]);

  // Tear down on unmount: dispose the worker, revoke object URLs, and
  // release the decoded bitmap.
  useEffect(() => {
    return () => {
      ocrRef.current?.dispose();
      ocrRef.current = null;
      bitmapRef.current?.close();
      bitmapRef.current = null;
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = null;
      }
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  /* ── canvas / preview ────────────────────── */

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const imageData = imageDataRef.current;
    if (!canvas || !imageData) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    const lines = linesRef.current;
    if (lines && lines.length) {
      ctx.strokeStyle = "rgba(16,185,129,0.9)";
      ctx.lineWidth = 2;
      for (const line of lines) {
        ctx.strokeRect(
          line.bbox.x,
          line.bbox.y,
          line.bbox.width,
          line.bbox.height,
        );
      }
    }
  }, []);

  /* ── preprocessing ───────────────────────── */

  const reprocess = useCallback(() => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const out = toOcrImageData(bitmap, { rotate, maxSide: 1800 });
    imageDataRef.current = out.imageData;
    linesRef.current = null;
    drawPreview();
    setResult(null);
    setCopied(false);
    setProgress(null);
  }, [rotate, drawPreview]);

  const stageFile = useCallback(
    async (f: File) => {
      if (!isImage(f)) {
        setError(`${f.name} is not a supported image (JPG, PNG, WebP, BMP).`);
        return;
      }
      setError(null);
      bitmapRef.current?.close();
      bitmapRef.current = null;
      const bitmap = await createImageBitmap(f);
      bitmapRef.current = bitmap;
      setFile(f);
      setResult(null);
      setCopied(false);
      reprocess();
    },
    [reprocess],
  );

  /* ── OCR actions ─────────────────────────── */

  const runOcr = useCallback(async () => {
    const imageData = imageDataRef.current;
    if (!imageData) return;
    setPending(true);
    setError(null);
    setProgress(0);
    setResult(null);
    setCopied(false);
    linesRef.current = null;

    try {
      const ocr = getOcr();
      await ocr.init(lang);
      const res = await ocr.recognize(imageData, {
        onProgress: (_status, pct) => setProgress(pct),
      });
      linesRef.current = res.lines;
      setResult(res);
      drawPreview();
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }, [lang, getOcr, drawPreview]);

  const cancelOcr = useCallback(async () => {
    setPending(false);
    setProgress(null);
    try {
      await getOcr().cancel();
    } catch {
      /* worker already torn down */
    }
  }, [getOcr]);

  /* ── drag + pickers ──────────────────────── */

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void stageFile(f);
    },
    [stageFile],
  );
  const onDragEnter = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragOver(false);
    }
  }, []);
  const onDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void stageFile(f);
      e.target.value = "";
    },
    [stageFile],
  );

  const onRotate = useCallback(
    (r: Rotate) => {
      setRotate(r);
      if (bitmapRef.current) reprocess();
    },
    [reprocess],
  );

  const removeFile = useCallback(() => {
    bitmapRef.current?.close();
    bitmapRef.current = null;
    imageDataRef.current = null;
    linesRef.current = null;
    setFile(null);
    setResult(null);
    setCopied(false);
    setProgress(null);
    setError(null);
  }, []);

  /* ── copy / download ─────────────────────── */

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — fall through to nothing */
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  const downloadText = useCallback(
    (text: string) => {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeName(file?.name ?? "ocr")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [file],
  );

  /* ── derived ─────────────────────────────── */

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const confidence = result?.confidence ?? null;
  const confRounded = confidence == null ? null : Math.round(confidence);

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24"
    >
      {/* ── Dropzone ──────────────────────────────── */}
      <label
        htmlFor={inputId}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col overflow-hidden rounded-2xl",
          "border-2 border-dashed transition-[transform,border-color,background-color] duration-200 ease-out",
          isDragOver
            ? "border-accent scale-[1.008] animate-glow"
            : "border-rule-2 bg-panel hover:border-muted",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
          onChange={onInputChange}
          className="peer sr-only"
          id={inputId}
        />

        <span className="flex items-start gap-3 border-b border-rule px-5 py-3.5">
          <span
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ease-out",
              isDragOver
                ? "bg-accent/10 text-accent"
                : "bg-paper-2 text-muted",
            ].join(" ")}
          >
            <Icon aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink sm:text-base">
              {tool.heading}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              {tool.lede}
            </span>
          </span>
          <span
            className="ml-auto hidden shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted sm:block"
            aria-hidden="true"
          >
            {tool.hint}
          </span>
        </span>

        <span className="relative flex min-h-48 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:min-h-64">
          <span
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-out",
              !isDragOver && "animate-float",
              isDragOver
                ? "bg-accent/10 text-accent"
                : "bg-paper-2 text-muted",
            ].join(" ")}
          >
            <UploadCloud
              aria-hidden="true"
              className="h-6 w-6"
              strokeWidth={1.5}
            />
          </span>
          <span className="space-y-1.5">
            <span className="block text-base font-medium text-ink">
              {isDragOver
                ? "Release to OCR locally"
                : "Drop an image here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Your image never leaves this device."
                : "Scans, screenshots, photos · processed in-browser"}
            </span>
          </span>
          <span
            className="absolute bottom-3 left-0 right-0 text-center font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
            aria-hidden="true"
          >
            {isDragOver ? "target locked" : "Tesseract WASM · no upload"}
          </span>
        </span>
      </label>

      {/* ── Staged file + controls ─────────────────── */}
      {file && (
        <div className="mt-4 space-y-4">
          {/* file info bar */}
          <div className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5">
            <ScanText
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-muted"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="font-mono text-xs text-muted">local · never uploaded</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium",
                pending
                  ? "cursor-not-allowed text-muted/40"
                  : "text-accent transition-colors duration-200 ease-out hover:bg-paper-3 active:translate-y-px",
              ].join(" ")}
            >
              Change
            </button>
            <button
              type="button"
              onClick={removeFile}
              disabled={pending}
              aria-label="Remove file"
              className={[
                "rounded-full p-2 transition-colors duration-200 ease-out",
                pending
                  ? "cursor-not-allowed text-muted/40"
                  : "text-muted hover:bg-paper-3 hover:text-error active:translate-y-px",
              ].join(" ")}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* preview */}
            <div className="overflow-hidden rounded-xl border border-rule bg-panel">
              <div className="flex min-h-48 items-center justify-center p-3">
                <canvas
                  ref={canvasRef}
                  className="max-h-80 w-full object-contain"
                />
              </div>
              <p className="border-t border-rule px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Binarized preview · box overlays = detected lines
              </p>
            </div>

            {/* controls + status */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-panel p-3">
                <label
                  htmlFor={`${inputId}-rotate`}
                  className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
                >
                  Rotate
                </label>
                <select
                  id={`${inputId}-rotate`}
                  value={rotate}
                  onChange={(e) => onRotate(Number(e.target.value) as Rotate)}
                  disabled={pending}
                  className="rounded-lg border border-rule-2 bg-paper-2 px-2 py-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ROTATIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <RotateCw
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-muted"
                  strokeWidth={1.75}
                />

                <label
                  htmlFor={`${inputId}-lang`}
                  className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
                >
                  Language
                </label>
                <select
                  id={`${inputId}-lang`}
                  value={lang}
                  onChange={(e) => setLang(e.target.value as OcrLang)}
                  disabled={pending}
                  className="rounded-lg border border-rule-2 bg-paper-2 px-2 py-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* progress bar */}
              {progress != null && (
                <div className="space-y-1.5" role="status" aria-live="polite">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Loader2
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin"
                      />
                      {(lang === "eng" ? "Reading text" : "Reading text (Indonesia)")}…
                    </span>
                    <span className="font-mono text-[0.625rem] text-muted">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
                    <div
                      className="animate-shimmer h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* run / cancel */}
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => void runOcr()}
                  disabled={pending}
                  className={[
                    "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                    pending
                      ? "cursor-not-allowed bg-paper-3 text-muted"
                      : "bg-accent text-accent-ink hover:brightness-110 active:translate-y-px",
                  ].join(" ")}
                >
                  <ScanText aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  {pending ? "Extracting…" : "Run OCR"}
                </button>
                {pending && (
                  <button
                    type="button"
                    onClick={() => void cancelOcr()}
                    className="flex items-center gap-1.5 rounded-full border border-rule-2 px-4 py-2.5 text-xs font-medium text-muted transition-colors duration-200 ease-out hover:border-error/50 hover:text-error active:translate-y-px"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Cancel
                  </button>
                )}
              </div>

              <p className="text-xs leading-relaxed text-muted">
                Engine and language model run as WebAssembly inside a Web
                Worker — no bytes leave this tab.
              </p>
            </div>
          </div>

          {/* ── Result ──────────────────────────────── */}
          {result && (
            <div className="rounded-2xl border border-rule bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                {confRounded != null && (
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.08em]",
                      confRounded < 60
                        ? "bg-error/15 text-error"
                        : "bg-ok/15 text-ok",
                    ].join(" ")}
                  >
                    {confRounded}% conf
                  </span>
                )}
                <span className="rounded-full border border-rule bg-paper-2 px-2.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                  {result.lines.length} line{result.lines.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(result.text)}
                    aria-label="Copy extracted text"
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-accent active:translate-y-px"
                  >
                    {copied ? (
                      <Check
                        aria-hidden="true"
                        className="check-bounce h-3.5 w-3.5 text-ok"
                        strokeWidth={2}
                      />
                    ) : (
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(result.text)}
                    aria-label="Download extracted text"
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-accent active:translate-y-px"
                  >
                    <Download aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                    .txt
                  </button>
                </span>
              </div>
              <textarea
                value={result.text}
                readOnly
                spellCheck={false}
                aria-label="Extracted text"
                className="mt-3 w-full resize-y rounded-xl border border-rule-2 bg-paper-2 px-3 py-2 font-mono text-sm leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ minHeight: "10rem" }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────── */}
      {error && (
        <div
          className="mt-4 flex items-center gap-3 rounded-xl border border-error/40 bg-paper-2 px-3 py-2.5"
          role="alert"
        >
          <X
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-error"
            strokeWidth={1.5}
          />
          <p className="min-w-0 flex-1 text-sm text-ink">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </section>
  );
}