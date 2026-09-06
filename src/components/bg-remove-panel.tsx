"use client";

import {
  Download,
  Loader2,
  ScanEye,
  Trash2,
  UploadCloud,
  X,
  Check,
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

/* ── Types ─────────────────────────────────────────────── */

type Backdrop = "transparent" | "white" | "black" | "custom";

type ModelLevel = "low" | "medium" | "high";

type ImglyModel = "isnet" | "isnet_fp16" | "isnet_quint8";

const MODEL_MAP: Record<
  ModelLevel,
  { key: ImglyModel; label: string; size: string }
> = {
  low: { key: "isnet_quint8", label: "Low", size: "42MB" },
  medium: { key: "isnet_fp16", label: "Medium", size: "84MB" },
  high: { key: "isnet", label: "High", size: "168MB" },
};

interface StageProgress {
  key: string;
  current: number;
  total: number;
}

/* ── Helpers ───────────────────────────────────────────── */

function sanitizeName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/* ── Component ─────────────────────────────────────────── */

export function BgRemovePanel({ tool }: { tool: Tool }) {
  /* ── file state ─────────────────────── */
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  /* ── processing state ───────────────── */
  const [status, setStatus] = useState<
    "idle" | "downloading" | "processing" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState<StageProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── model quality ──────────────────── */
  const [modelLevel, setModelLevel] = useState<ModelLevel>("low");
  const [downloadedLevels, setDownloadedLevels] = useState<Set<ModelLevel>>(
    () => new Set(["low"]),
  );

  /* ── post-processing ────────────────── */
  const [backdrop, setBackdrop] = useState<Backdrop>("transparent");
  const customColorRef = useRef<HTMLInputElement>(null);
  const [customColor, setCustomColor] = useState("#3b82f6");

  /* ── refs ───────────────────────────── */
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const processedBlobRef = useRef<Blob | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    originalRef.current = originalUrl;
  }, [originalUrl]);
  useEffect(() => {
    resultRef.current = resultUrl;
  }, [resultUrl]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      if (originalRef.current) URL.revokeObjectURL(originalRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  /* ── exit early on SSR-safety hint (client component only) ── */
  /* dynamic import happens inside event handlers, never at module
     scope, so SSR never touches the WASM lib. */

  /* ── apply backdrop to the transparent result ── */
  const applyBackdrop = useCallback(
    (blob: Blob, backdrop: Backdrop): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas unavailable"));
            return;
          }
          if (backdrop === "white") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (backdrop === "black") {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (backdrop === "custom") {
            ctx.fillStyle = customColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (out) => {
              if (out) resolve(out);
              else reject(new Error("toBlob failed"));
            },
            "image/png",
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Decode failed"));
        };
        img.src = url;
      });
    },
    [customColor],
  );

  /* ── run background removal ─────────── */
  const run = useCallback(
    async (target: File) => {
      setError(null);
      setStatus("downloading");
      setProgress({ key: "model", current: 0, total: 1 });
      try {
        /* dynamic import, never executed during SSR */
        const mod = await import("@imgly/background-removal");
        const { removeBackground, preload } = mod;

        /* preload model so subsequent runs are instant */
        const base = `${window.location.origin}/bgremove/`;
        const modelKey = MODEL_MAP[modelLevel].key;

        if (!downloadedLevels.has(modelLevel)) {
          await preload({
            publicPath: base,
            device: "gpu",
            model: modelKey,
            progress: (key, current, total) => {
              setProgress({ key, current, total });
            },
          });
          setDownloadedLevels((prev) => new Set(prev).add(modelLevel));
        }

        setStatus("processing");
        setProgress({ key: "compute", current: 0, total: 1 });

        const blob = await removeBackground(target, {
          publicPath: base,
          device: "gpu",
          model: modelKey,
          progress: (key, current, total) => {
            setProgress({ key, current, total });
          },
        });

        processedBlobRef.current = blob;
        if (backdrop !== "transparent") {
          const recolored = await applyBackdrop(blob, backdrop);
          processedBlobRef.current = recolored;
        }

        if (resultRef.current) URL.revokeObjectURL(resultRef.current);
        const url = URL.createObjectURL(processedBlobRef.current);
        resultRef.current = url;
        setResultUrl(url);
        setStatus("done");
        setProgress(null);
      } catch (err: unknown) {
        setStatus("error");
        setProgress(null);
        setError(
          err instanceof Error
            ? err.message
            : "Background removal failed. Try again.",
        );
      }
    },
    [modelLevel, downloadedLevels, backdrop, applyBackdrop],
  );

  /* ── file staging ───────────────────── */
  const stageFiles = useCallback(
    (incoming: File[]) => {
      const f = Array.from(incoming).find((x) => x.type.startsWith("image/"));
      if (!f) return;
      if (originalRef.current) URL.revokeObjectURL(originalRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
      processedBlobRef.current = null;
      setOriginalUrl(URL.createObjectURL(f));
      setFile(f);
      setStatus("idle");
      setResultUrl(null);
      setError(null);
    },
    [],
  );

  /* ── drag handlers ──────────────────── */
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

  const removeFile = useCallback(() => {
    if (originalRef.current) URL.revokeObjectURL(originalRef.current);
    if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    originalRef.current = null;
    resultRef.current = null;
    processedBlobRef.current = null;
    setFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setStatus("idle");
    setProgress(null);
    setError(null);
  }, []);

  /* ── change backdrop on already-processed result ── */
  const onBackdropChange = useCallback(
    async (next: Backdrop) => {
      setBackdrop(next);
      if (processedBlobRef.current && status === "done") {
        try {
          const recolored = await applyBackdrop(processedBlobRef.current, next);
          if (resultRef.current) URL.revokeObjectURL(resultRef.current);
          const url = URL.createObjectURL(recolored);
          resultRef.current = url;
          setResultUrl(url);
        } catch {
          /* ignore backdrop errors */
        }
      }
    },
    [applyBackdrop, status],
  );

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const processing = status === "downloading" || status === "processing";
  const stagePct = progress
    ? progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0
    : 0;
  const isDownloading = status === "downloading";
  const outName = file ? `${sanitizeName(file.name)}-transparent.png` : "";

  /* backdrop swatches */
  const backdrops: { value: Backdrop; label: string }[] = [
    { value: "transparent", label: "Transparent" },
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
    { value: "custom", label: "Custom" },
  ];

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
          multiple
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
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
                ? "Release to process locally"
                : "Drop a photo here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Images stay on this device."
                : "JPG, PNG, WebP · remove background with in-browser AI"}
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

      {/* ── helper note ───────────────────────────── */}
      <p className="mt-3 flex items-center gap-2 rounded-xl border border-rule bg-paper-2 px-3 py-2 text-xs leading-relaxed text-muted animate-pop">
        <span className="text-accent">⚡</span>
        Powered by OIEL, in-browser ONNX AI. Higher quality models download on
        first use and are cached by your browser.
        {MODEL_MAP[modelLevel] &&
          downloadedLevels.has(modelLevel) && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 font-mono text-[0.625rem] font-semibold text-ok">
              <Check aria-hidden="true" className="check-bounce h-3 w-3" strokeWidth={2} />
            {MODEL_MAP[modelLevel].label} cached
          </span>
          )}
      </p>

      {/* ── Model quality selector ───────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
          Model
        </span>
        {(Object.keys(MODEL_MAP) as ModelLevel[]).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setModelLevel(lvl)}
            disabled={processing}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              modelLevel === lvl
                ? "bg-accent text-accent-ink"
                : "bg-paper-2 text-muted hover:text-ink-2",
            ].join(" ")}
          >
            {MODEL_MAP[lvl].label}
            {downloadedLevels.has(lvl) ? (
              <span className="ml-1.5 font-mono text-[0.625rem] text-ok/80">✓</span>
            ) : (
              <span className="ml-1.5 font-mono text-[0.625rem] text-muted/60">
                {MODEL_MAP[lvl].size}
              </span>
            )}
          </button>
        ))}
        <span className="text-xs text-muted">
          {downloadedLevels.has(modelLevel)
            ? `${MODEL_MAP[modelLevel].label} ready`
            : `${MODEL_MAP[modelLevel].size} will download on use`}
        </span>
      </div>

      {/* ── Staged file ───────────────────────────── */}
      {file && (
        <div className="mt-4 space-y-4">
          {/* preview grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* original */}
            <div className="overflow-hidden rounded-xl border border-rule bg-panel">
              <div
                className="flex items-center justify-center p-3"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(var(--color-paper-3) 0% 25%,var(--color-panel) 0% 50%)",
                  backgroundSize: "1rem 1rem",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl ?? ""}
                  alt="Original"
                  className="max-h-56 w-full object-contain"
                />
              </div>
              <p className="border-t border-rule px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Original
              </p>
            </div>

            {/* result */}
            <div className="overflow-hidden rounded-xl border border-rule bg-panel">
              <div
                className="flex h-full min-h-48 items-center justify-center p-3"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(var(--color-paper-2) 0% 25%,var(--color-paper-3) 0% 50%)",
                  backgroundSize: "1rem 1rem",
                }}
              >
                {resultUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resultUrl}
                    alt="Background removed"
                    className="max-h-56 w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    {processing ? (
                      <>
                        <Loader2
                          aria-hidden="true"
                          className="h-6 w-6 animate-spin text-accent"
                          strokeWidth={1.5}
                        />
                        <span className="text-xs text-muted">
                          {status === "downloading"
                            ? `Downloading ${MODEL_MAP[modelLevel].label} model…`
                            : "Removing background…"}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2 rounded-full border border-rule bg-paper-2 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                        <ScanEye aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Ready to process
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="border-t border-rule px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-ok">
                Result · transparent bg
              </p>
            </div>
          </div>

          {/* progress bar */}
          {progress && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {isDownloading && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />}
                  {isDownloading
                    ? `Downloading ${MODEL_MAP[modelLevel].label} model${progress && progress.key?.startsWith("fetch:") ? ` · ${MODEL_MAP[modelLevel].size}` : ""}…`
                    : "Extracting subject & removing background…"}
                </span>
                <span className="font-mono text-[0.625rem] text-muted">{stagePct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
                <div
                  className="animate-shimmer h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                  style={{ width: `${stagePct}%` }}
                />
              </div>
            </div>
          )}

          {/* process button */}
          {!processing && file && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => run(file)}
                disabled={status === "done"}
                className={[
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                  status === "done"
                    ? "cursor-not-allowed bg-paper-3 text-muted"
                    : "bg-accent text-accent-ink hover:brightness-110 active:translate-y-px",
                ].join(" ")}
              >
                <ScanEye aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                {status === "done" ? "Processed" : "Remove Background"}
              </button>
            </div>
          )}

          {/* backdrop + download */}
          {status === "done" && resultUrl && (
            <div className="animate-pop space-y-3 rounded-2xl border border-rule bg-panel p-4">
              <div>
                <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                  Backdrop
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {backdrops.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => onBackdropChange(b.value)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        backdrop === b.value
                          ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                          : "bg-paper-2/50 text-muted hover:text-ink-2",
                      ].join(" ")}
                    >
                      {b.label}
                    </button>
                  ))}
                  {backdrop === "custom" && (
                    <label className="flex items-center gap-2 rounded-full border border-rule-2 bg-paper-2 px-2 py-1 text-xs text-muted">
                      <input
                        ref={customColorRef}
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="h-6 w-6 cursor-pointer rounded border-none bg-transparent"
                      />
                      <span className="font-mono uppercase">{customColor}</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-rule pt-3">
                <a
                  href={resultUrl}
                  download={outName}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:brightness-110"
                >
                  <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  Download PNG
                </a>
              </div>
            </div>
          )}

          {/* file action bar */}
          <div className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5">
            <ScanEye aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="font-mono text-xs text-muted">
                {file.size > 0 ? `${(file.size / 1048576).toFixed(1)} MB` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-paper-3"
            >
              Change
            </button>
            <button
              type="button"
              onClick={removeFile}
              aria-label="Remove file"
              className="rounded-full p-2 text-muted transition-colors hover:bg-paper-3 hover:text-error"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────── */}
      {error && (
        <div
          className="mt-4 flex items-center gap-3 rounded-xl border border-error/40 bg-paper-2 px-3 py-2.5"
          role="alert"
        >
          <X aria-hidden="true" className="h-5 w-5 shrink-0 text-error" strokeWidth={1.5} />
          <p className="min-w-0 flex-1 text-sm text-ink">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="rounded-full p-2 text-muted transition-colors hover:bg-paper-3 hover:text-error"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </section>
  );
}
