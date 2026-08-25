"use client";

import {
  Check,
  Download,
  ImageOff,
  ScanLine,
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

interface ScrubbedFile {
  id: string;
  originalName: string;
  originalSize: number;
  mimeType: "image/jpeg" | "image/png";
  previewUrl: string;
  downloadUrl: string;
  scrubbedSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function accepts(name: string, type: string): boolean {
  const lower = name.toLowerCase();
  return (
    type === "image/jpeg" ||
    type === "image/png" ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  );
}

function resolvedMime(file: File): "image/jpeg" | "image/png" {
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) return "image/png";
  return "image/jpeg";
}

function scrubExif(file: File): Promise<{ blob: Blob; mime: "image/jpeg" | "image/png" }> {
  return new Promise((resolve, reject) => {
    const mime = resolvedMime(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas.toBlob returned null"));
            return;
          }
          resolve({ blob, mime });
        },
        mime,
        mime === "image/jpeg" ? 0.95 : undefined,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function stemName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function ExifScrubber({ tool }: { tool: Tool }) {
  const [scrubbed, setScrubbed] = useState<ScrubbedFile[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [processing, setProcessing] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubbedRef = useRef<ScrubbedFile[]>([]);

  useEffect(() => {
    scrubbedRef.current = scrubbed;
  }, [scrubbed]);

  useEffect(() => {
    return () => {
      scrubbedRef.current.forEach((s) => {
        URL.revokeObjectURL(s.previewUrl);
        URL.revokeObjectURL(s.downloadUrl);
      });
    };
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const valid: File[] = [];
    const bad: { name: string; reason: string }[] = [];

    for (const f of files) {
      if (!accepts(f.name, f.type)) {
        bad.push({ name: f.name, reason: "Only JPG and PNG are supported." });
      } else {
        valid.push(f);
      }
    }

    if (bad.length) setRejected((prev) => [...prev, ...bad]);
    if (!valid.length) return;

    setProcessing((prev) => [...prev, ...valid.map((f) => f.name)]);

    const results = await Promise.allSettled(
      valid.map(async (file) => {
        const { blob, mime } = await scrubExif(file);
        const previewUrl = URL.createObjectURL(blob);
        const downloadUrl = URL.createObjectURL(blob);
        const ext = mime === "image/png" ? "png" : "jpg";
        const result: ScrubbedFile = {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          originalName: file.name,
          originalSize: file.size,
          mimeType: mime,
          previewUrl,
          downloadUrl,
          scrubbedSize: blob.size,
        };
        return { result, downloadName: `${stemName(file.name)}-clean.${ext}` };
      }),
    );

    const nextScrubbed: ScrubbedFile[] = [];
    const nextBad: { name: string; reason: string }[] = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        nextScrubbed.push(r.value.result);
      } else {
        nextBad.push({ name: valid[i].name, reason: String(r.reason) });
      }
    }

    setScrubbed((prev) => [...prev, ...nextScrubbed]);
    if (nextBad.length) setRejected((prev) => [...prev, ...nextBad]);
    setProcessing((prev) => prev.filter((n) => !valid.map((f) => f.name).includes(n)));
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles],
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
      processFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [processFiles],
  );

  const removeFile = useCallback((id: string) => {
    setScrubbed((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        URL.revokeObjectURL(target.downloadUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-[72rem] px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <label
        htmlFor={inputId}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col overflow-hidden rounded-2xl",
          "border-2 border-dashed transition-colors duration-200 ease-out",
          isDragOver
            ? "border-accent bg-panel-2"
            : "border-rule-2 bg-panel hover:border-muted",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={tool.accept || undefined}
          onChange={onInputChange}
          className="peer sr-only"
          id={inputId}
        />

        <span className="flex items-start gap-3 border-b border-rule px-5 py-3.5">
          <span
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ease-out",
              isDragOver ? "bg-accent/10 text-accent" : "bg-paper-2 text-muted",
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
              isDragOver ? "bg-accent/10 text-accent" : "bg-paper-2 text-muted",
            ].join(" ")}
          >
            <UploadCloud aria-hidden="true" className="h-6 w-6" strokeWidth={1.5} />
          </span>

          <span className="space-y-1.5">
            <span className="block text-base font-medium text-ink">
              {isDragOver ? "Release to scrub EXIF locally" : "Drop JPG or PNG here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : "EXIF erased in-browser via Canvas · never uploaded · JPG, PNG"}
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

      {processing.length > 0 && (
        <ul className="mx-auto mt-4 max-w-[72rem] space-y-2" aria-live="polite">
          {processing.map((name) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-3">
                <ScanLine
                  aria-hidden="true"
                  className="h-4 w-4 animate-pulse text-accent"
                  strokeWidth={1.5}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                <p className="font-mono text-xs text-muted">Stripping EXIF…</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {scrubbed.length > 0 && (
        <ul className="mx-auto mt-4 max-w-[72rem] space-y-2">
          {scrubbed.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.previewUrl}
                alt=""
                aria-hidden="true"
                className="h-9 w-9 rounded-lg border border-rule object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.originalName}</p>
                <p className="font-mono text-xs text-muted">
                  {formatBytes(s.originalSize)} → {formatBytes(s.scrubbedSize)} · EXIF removed
                </p>
              </div>
              <span
                className="flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-ok"
                role="status"
              >
                <Check aria-hidden="true" className="h-3 w-3" />
                clean
              </span>
              <a
                href={s.downloadUrl}
                download={`${stemName(s.originalName)}-clean.${s.mimeType === "image/png" ? "png" : "jpg"}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-accent active:translate-y-px"
                aria-label={`Download ${s.originalName} (EXIF removed)`}
              >
                <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </a>
              <button
                type="button"
                onClick={() => removeFile(s.id)}
                aria-label={`Remove ${s.originalName}`}
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <ul className="mx-auto mt-4 max-w-[72rem] space-y-2" role="alert">
          {rejected.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-error/40 bg-paper-2 px-3 py-2.5"
            >
              <ImageOff
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-error"
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                <p className="text-xs text-muted">{r.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejected((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Dismiss ${r.name}`}
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
              >
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
