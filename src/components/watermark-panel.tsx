"use client";

import {
  Brush,
  Download,
  Stamp,
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
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Tool } from "./tool-tabs";

/* ── Types ─────────────────────────────────────────────── */

type WatermarkColor = "white" | "black" | "red";
type PatternMode = "center" | "tiled";

interface Redaction {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Preset {
  text: string;
  color: WatermarkColor;
  opacity: number;
  fontSize: number;
  rotation: number;
  pattern: PatternMode;
}

const PRESETS: Record<string, Preset> = {
  ktp: {
    text: "FOR VERIFICATION ONLY",
    color: "red",
    opacity: 35,
    fontSize: 32,
    rotation: 30,
    pattern: "tiled",
  },
  employment: {
    text: "EMPLOYMENT PROOF · NOT FOR REUSE",
    color: "white",
    opacity: 40,
    fontSize: 28,
    rotation: -25,
    pattern: "tiled",
  },
  rental: {
    text: "RENTAL AGREEMENT COPY",
    color: "black",
    opacity: 35,
    fontSize: 30,
    rotation: 45,
    pattern: "tiled",
  },
};

const COLOR_HEX: Record<WatermarkColor, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff3b30",
};

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultText(): string {
  return `FOR VERIFICATION ONLY - ${todayLabel()}`;
}

/* ── Component ─────────────────────────────────────────── */

export function WatermarkPanel({ tool }: { tool: Tool }) {
  /* ── file state ─────────────────────── */
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  /* ── watermark settings ─────────────── */
  const [text, setText] = useState(defaultText);
  const [color, setColor] = useState<WatermarkColor>("white");
  const [opacity, setOpacity] = useState(40);
  const [fontSize, setFontSize] = useState(32);
  const [rotation, setRotation] = useState(-30);
  const [pattern, setPattern] = useState<PatternMode>("tiled");

  /* ── redaction ──────────────────────── */
  const [redactMode, setRedactMode] = useState(false);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [activeRedact, setActiveRedact] = useState<Redaction | null>(null);

  /* ── ui state ───────────────────────── */
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  /* ── refs ───────────────────────────── */
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    resultRef.current = resultUrl;
  }, [resultUrl]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  /* ── draw watermark + redactions ────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    /* redactions */
    for (const r of redactions) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (activeRedact) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(activeRedact.x, activeRedact.y, activeRedact.w, activeRedact.h);
    }

    /* watermark */
    if (!text) return;
    const W = canvas.width;
    const H = canvas.height;
    const base = Math.max(16, (fontSize / 100) * Math.min(W, H));

    ctx.font = `600 ${base}px Geist, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = COLOR_HEX[color];

    if (pattern === "center") {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.globalAlpha = opacity / 150; // lighter for tiled
      const step = base * 3;
      const span = Math.ceil(Math.hypot(W, H) / step) + 2;
      for (let i = -span; i <= span; i++) {
        for (let j = -span; j <= span; j++) {
          ctx.fillText(
            text,
            i * step,
            j * step,
          );
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }, [img, text, color, opacity, fontSize, rotation, pattern, redactions, activeRedact]);

  /* trigger redraw whenever settings / shape change */
  useEffect(() => {
    draw();
  }, [draw]);

  /* ── scale helpers (CSS px → canvas px) ── */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect || rect.width === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    [],
  );

  /* ── redaction pointer handlers ─────── */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!redactMode) return;
      e.preventDefault();
      const p = toCanvas(e.clientX, e.clientY);
      dragStartRef.current = p;
      setActiveRedact({ x: p.x, y: p.y, w: 0, h: 0 });
    },
    [redactMode, toCanvas],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!redactMode || !dragStartRef.current) return;
      const p = toCanvas(e.clientX, e.clientY);
      const s = dragStartRef.current;
      setActiveRedact({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
    },
    [redactMode, toCanvas],
  );

  const onPointerUp = useCallback(() => {
    if (!redactMode) return;
    if (dragStartRef.current && activeRedact && activeRedact.w > 4 && activeRedact.h > 4) {
      setRedactions((prev) => [...prev, activeRedact]);
    }
    dragStartRef.current = null;
    setActiveRedact(null);
  }, [redactMode, activeRedact]);

  /* handlers need current drag state re-rendered each move; pointermove
     updates activeRedact → redraw via effect. Good. */

  /* ── file staging ───────────────────── */
  const stageFiles = useCallback(
    (incoming: File[]) => {
      const f = Array.from(incoming).find((x) => x.type.startsWith("image/"));
      if (!f) return;
      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current);
        resultRef.current = null;
      }
      setResultUrl(null);
      setRedactions([]);
      setActiveRedact(null);
      setError(null);

      const url = URL.createObjectURL(f);
      const image = new Image();
      image.onload = () => {
        setImg(image);
        setNatural({ w: image.naturalWidth, h: image.naturalHeight });
        setFile(f);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Failed to decode image.");
      };
      image.src = url;
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

  /* ── presets ────────────────────────── */
  const applyPreset = useCallback((key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setText(p.text);
    setColor(p.color);
    setOpacity(p.opacity);
    setFontSize(p.fontSize);
    setRotation(p.rotation);
    setPattern(p.pattern);
  }, []);

  const removeFile = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
    }
    setResultUrl(null);
    setFile(null);
    setImg(null);
    setNatural(null);
    setRedactions([]);
    setActiveRedact(null);
  }, []);

  /* ── export ─────────────────────────── */
  const exportImage = useCallback(
    (type: "image/png" | "image/jpeg") => {
      const canvas = canvasRef.current;
      if (!canvas || !file) return;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (resultRef.current) URL.revokeObjectURL(resultRef.current);
          const url = URL.createObjectURL(blob);
          resultRef.current = url;
          setResultUrl(url);
        },
        type,
        type === "image/jpeg" ? 1 : undefined,
      );
    },
    [file],
  );

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;

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
                ? "Release to watermark locally"
                : "Drop a document image here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : "JPG, PNG, WebP · KTP, IDs, passports, invoices"}
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

      {/* ── Editor ────────────────────────────────── */}
      {img && natural && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Canvas preview */}
          <div
            ref={wrapRef}
            className="overflow-hidden rounded-2xl border border-rule bg-panel"
          >
            <div
              className="flex items-center justify-center p-4 sm:p-6"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(var(--color-paper-3) 0% 25%,var(--color-panel) 0% 50%)",
                backgroundSize: "1rem 1rem",
              }}
            >
              <canvas
                ref={canvasRef}
                width={natural.w}
                height={natural.h}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                className={[
                  "max-h-[70vh] w-full touch-none rounded-lg object-contain",
                  redactMode
                    ? "cursor-crosshair"
                    : "cursor-default",
                ].join(" ")}
              />
            </div>
            <div className="flex items-center gap-3 border-t border-rule px-4 py-2.5">
              <p className="truncate text-xs text-muted">
                {file?.name} · {natural.w} × {natural.h}
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-auto rounded-full px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-paper-3"
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

          {/* Control panel */}
          <div className="space-y-4 rounded-2xl border border-rule bg-panel p-4">
            {/* Presets */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(PRESETS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink-2"
                  >
                    {key === "ktp"
                      ? "KTP Verification"
                      : key === "employment"
                        ? "Employment Proof"
                        : "Rental Agreement"}
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark text */}
            <div>
              <label
                htmlFor="wm-text"
                className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
              >
                Watermark Text
              </label>
              <input
                id="wm-text"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-lg border border-rule-2 bg-paper-2 px-3 py-2 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {/* Color */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Color
              </span>
              <div className="flex gap-1.5">
                {(["white", "black", "red"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={[
                      "h-7 w-7 rounded-full border transition-transform",
                      color === c ? "scale-110 ring-2 ring-accent" : "hover:scale-105",
                    ].join(" ")}
                    style={{
                      backgroundColor: COLOR_HEX[c],
                      borderColor: c === "white" ? "var(--color-rule-2)" : "transparent",
                    }}
                    aria-label={`Watermark color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Opacity · {opacity}%
              </span>
              <input
                type="range"
                min={10}
                max={90}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            {/* Font size */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Font Size · {fontSize}
              </span>
              <input
                type="range"
                min={12}
                max={90}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            {/* Rotation */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Rotation · {rotation}°
              </span>
              <input
                type="range"
                min={-45}
                max={45}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            {/* Pattern mode */}
            <div>
              <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                Pattern
              </span>
              <div className="flex gap-1.5">
                {(["center", "tiled"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPattern(m)}
                    className={[
                      "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      pattern === m
                        ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                        : "bg-paper-2/50 text-muted hover:text-ink-2",
                    ].join(" ")}
                  >
                    {m === "center" ? "Single Stamp" : "Tiled"}
                  </button>
                ))}
              </div>
            </div>

            {/* Redaction */}
            <div className="rounded-lg border border-rule bg-paper-2 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Brush
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    strokeWidth={1.75}
                  />
                  Redact Mode
                </span>
                <button
                  type="button"
                  onClick={() => setRedactMode((v) => !v)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    redactMode
                      ? "bg-error/20 text-error"
                      : "bg-paper-3 text-muted hover:text-ink-2",
                  ].join(" ")}
                >
                  {redactMode ? "On" : "Off"}
                </button>
              </div>
              <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">
                Drag to draw black boxes over sensitive fields (NIK, signature).
              </p>
              {redactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRedactions([])}
                  className="mt-2 text-[0.6875rem] font-medium text-error hover:underline"
                >
                  Clear all boxes
                </button>
              )}
            </div>

            {/* Export */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => exportImage("image/png")}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:brightness-110"
              >
                <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                Export PNG
              </button>
              <button
                type="button"
                onClick={() => exportImage("image/jpeg")}
                className="w-full rounded-full border border-rule-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2"
              >
                Export JPEG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Result banner ─────────────────────────── */}
      {resultUrl && file && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-ok/30 bg-paper-2 px-3 py-2.5 animate-pop">
          <Stamp aria-hidden="true" className="h-5 w-5 shrink-0 text-ok" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              Watermarked image ready
            </p>
            <p className="font-mono text-xs text-muted">
              {file.name.replace(/\.[^.]+$/, "")}-watermarked.png
            </p>
          </div>
          <a
            href={resultUrl}
            download={file.name.replace(/\.[^.]+$/, "") + "-watermarked.png"}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-xs font-medium text-accent-ink transition-colors hover:brightness-110"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Download
          </a>
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
