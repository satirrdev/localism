"use client";

import {
  Download,
  Image as ImageIcon,
  RefreshCw,
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
import { publicUrl } from "@/lib/paths";

const MIME: Record<string, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

const FORMATS = ["webp", "jpeg", "png", "avif"] as const;
type OutputFormat = (typeof FORMATS)[number];

const SCALE_OPTIONS = [25, 50, 75] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const v = bytes / 1024 ** i;
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function outName(original: string, fmt: OutputFormat): string {
  const base = original.replace(/\.[^.]+$/, "");
  return `${base}.${fmt === "jpeg" ? "jpg" : fmt}`;
}

export function ImagePanel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [resizeMode, setResizeMode] = useState<
    "original" | "scale" | "constraint"
  >("original");
  const [scalePercent, setScalePercent] = useState(50);
  const [maxW, setMaxW] = useState(1920);
  const [maxH, setMaxH] = useState(1080);

  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<{
    value: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [resultDims, setResultDims] = useState<{
    w: number;
    h: number;
  } | null>(null);

  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    previewRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(() => {
    resultRef.current = resultUrl;
  }, [resultUrl]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(publicUrl("/image-worker.js"));
    }
    return workerRef.current;
  }, []);

  const resetResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
    }
    setResultUrl(null);
    setResultSize(0);
    setResultDims(null);
    setError(null);
  }, []);

  const stageFiles = useCallback(
    (incoming: File[]) => {
      const imgFile = Array.from(incoming).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!imgFile) return;

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
      resetResult();
      setProgress(null);

      const url = URL.createObjectURL(imgFile);
      setPreviewUrl(url);
      setFile(imgFile);

      const img = new Image();
      img.onload = () =>
        setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    },
    [resetResult],
  );

  const removeFile = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
    setFile(null);
    setDims(null);
    resetResult();
    setProgress(null);
  }, [resetResult]);

  const process = useCallback(async () => {
    if (!file) return;
    resetResult();
    setProgress({ value: 0, label: "Reading file…" });

    const worker = getWorker();
    const id = Math.random().toString(36).slice(2);
    const buffer = await file.arrayBuffer();

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
    };

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        setProgress({ value: msg.value, label: msg.label });
      } else if (msg.type === "done") {
        cleanup();
        setProgress(null);
        const blob: Blob = msg.blob;
        const url = URL.createObjectURL(blob);
        resultRef.current = url;
        setResultUrl(url);
        setResultSize(blob.size);
        setResultDims({ w: msg.width, h: msg.height });
      } else if (msg.type === "error") {
        cleanup();
        setProgress(null);
        setError(msg.message);
      }
    };

    worker.onerror = (e) => {
      cleanup();
      setProgress(null);
      setError(e.message);
    };

    worker.postMessage(
      {
        type: "process",
        id,
        buffer,
        outputMime: MIME[format],
        quality,
        resize: {
          mode: resizeMode,
          percent: scalePercent,
          maxWidth: maxW,
          maxHeight: maxH,
        },
      },
      [buffer],
    );
  }, [
    file,
    format,
    quality,
    resizeMode,
    scalePercent,
    maxW,
    maxH,
    getWorker,
    resetResult,
  ]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);
      stageFiles(Array.from(e.dataTransfer.files));
    },
    [stageFiles],
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
      stageFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [stageFiles],
  );

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const canProcess = !!file && !progress;
  const savings =
    file && resultSize > 0
      ? ((file.size - resultSize) / file.size) * 100
      : null;
  const isLossy = format !== "png";
  const outputName = file ? outName(file.name, format) : "";

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24"
    >
      {/* ── Dropzone ─────────────────────────────────── */}
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
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp"
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
            <UploadCloud aria-hidden="true" className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="space-y-1.5">
            <span className="block text-base font-medium text-ink">
              {isDragOver
                ? "Release to stage image"
                : "Drop an image here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : "JPG, PNG, WebP, GIF, AVIF · Compress and convert locally"}
            </span>
          </span>
          <span
            className="absolute bottom-3 left-0 right-0 text-center font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
            aria-hidden="true"
          >
            {isDragOver ? "target locked" : "dropzone · local"}
          </span>
        </span>
      </label>

      {/* ── Staged file: preview + settings ──────────── */}
      {file && (
        <div className="mt-4 space-y-4">
          {/* Preview card */}
          <div className="overflow-hidden rounded-2xl border border-rule bg-panel">
            {previewUrl && (
              <div
                className="flex items-center justify-center p-4 sm:p-6"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(var(--color-paper-3) 0% 25%,var(--color-panel) 0% 50%)",
                  backgroundSize: "1rem 1rem",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Original"
                  className="max-h-64 rounded-lg object-contain sm:max-h-80"
                />
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-rule px-4 py-3">
              <ImageIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted"
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {file.name}
                </p>
                <p className="font-mono text-xs text-muted">
                  {formatBytes(file.size)}
                  {dims ? ` · ${dims.w} × ${dims.h}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-accent transition-colors duration-200 ease-out hover:bg-paper-3 active:translate-y-px"
              >
                Change
              </button>
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove file"
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Settings card */}
          <div className="rounded-2xl border border-rule bg-panel p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Left column: Format + Quality */}
              <div className="space-y-3">
                <div>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Output Format
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMATS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          format === f
                            ? "bg-accent text-accent-ink"
                            : "bg-paper-2 text-muted hover:text-ink-2",
                        ].join(" ")}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={isLossy ? "" : "opacity-40"}>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Quality · {isLossy ? `${quality}%` : "lossless"}
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    disabled={!isLossy}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </div>

              {/* Right column: Resize + EXIF */}
              <div className="space-y-3">
                <div>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Resize
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(["original", "scale", "constraint"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setResizeMode(m)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          resizeMode === m
                            ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                            : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
                        ].join(" ")}
                      >
                        {m === "original"
                          ? "Original"
                          : m === "scale"
                            ? "Scale %"
                            : "Max Dim"}
                      </button>
                    ))}
                  </div>

                  {resizeMode === "scale" && (
                    <div className="mt-2 flex gap-1.5">
                      {SCALE_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setScalePercent(s)}
                          className={[
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                            scalePercent === s
                              ? "bg-accent text-accent-ink"
                              : "bg-paper-2 text-muted hover:text-ink-2",
                          ].join(" ")}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  )}

                  {resizeMode === "constraint" && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted">
                        W
                        <input
                          type="number"
                          value={maxW}
                          min={1}
                          max={10000}
                          onChange={(e) =>
                            setMaxW(Number(e.target.value) || 1)
                          }
                          className="w-20 rounded-lg border border-rule-2 bg-paper-2 px-2 py-1 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-muted">
                        H
                        <input
                          type="number"
                          value={maxH}
                          min={1}
                          max={10000}
                          onChange={(e) =>
                            setMaxH(Number(e.target.value) || 1)
                          }
                          className="w-20 rounded-lg border border-rule-2 bg-paper-2 px-2 py-1 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    disabled
                    className="accent-accent"
                  />
                  Strip EXIF metadata
                  <span className="text-muted/60">(auto-cleared)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Process button */}
          {!progress && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={process}
                disabled={!canProcess}
                className={[
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                  canProcess
                    ? "bg-accent text-accent-ink hover:brightness-110 active:translate-y-px"
                    : "cursor-not-allowed bg-paper-3 text-muted",
                ].join(" ")}
              >
                <RefreshCw
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.75}
                />
                Compress Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Progress ─────────────────────────────────── */}
      {progress && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{progress.label}</span>
            <span className="font-mono text-[0.625rem] text-muted">
              {progress.value}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
            <div
              className="animate-shimmer h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${progress.value}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Result ───────────────────────────────────── */}
      {resultUrl && file && (
        <div className="animate-pop mt-4 space-y-3">
          {/* Comparison cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="hover-lift rounded-xl border border-rule bg-paper-2 p-3">
              <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Original
              </span>
              <p className="truncate text-sm font-medium text-ink">
                {file.name}
              </p>
              <p className="font-mono text-xs text-muted">
                {formatBytes(file.size)}
                {dims ? ` · ${dims.w} × ${dims.h}` : ""}
              </p>
            </div>
            <div className="hover-lift rounded-xl border border-ok/30 bg-paper-2 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                  Processed
                </span>
                {savings !== null && (
                  <span className="animate-pop rounded-full bg-ok/15 px-2 py-0.5 font-mono text-[0.625rem] font-semibold text-ok">
                    {savings >= 0
                      ? `-${savings.toFixed(1)}%`
                      : `+${Math.abs(savings).toFixed(1)}%`}
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-medium text-ink">
                {outputName}
              </p>
              <p className="font-mono text-xs text-muted">
                {formatBytes(resultSize)}
                {resultDims ? ` · ${resultDims.w} × ${resultDims.h}` : ""}
              </p>
            </div>
          </div>

          {/* Visual comparison */}
          <div className="grid gap-3 sm:grid-cols-2">
            {previewUrl && (
              <div className="overflow-hidden rounded-xl border border-rule bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Before"
                  className="w-full object-contain max-h-48"
                />
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-rule bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="After"
                className="w-full object-contain max-h-48"
              />
            </div>
          </div>

          {/* Download */}
          <div className="flex justify-end">
            <a
              href={resultUrl}
              download={outputName}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-200 ease-out hover:brightness-110 active:translate-y-px"
            >
              <Download
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.75}
              />
              Download {outputName}
            </a>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────── */}
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
