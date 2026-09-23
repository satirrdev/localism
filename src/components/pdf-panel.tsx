"use client";

import {
  Check,
  Download,
  FileText,
  FileMinus2,
  Merge,
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

type Mode = "merge" | "redact";

interface StagedPdf {
  id: string;
  file: File;
}

interface WorkerMessage {
  type: "progress" | "done" | "error";
  id?: string;
  value?: number;
  label?: string;
  bytes?: Uint8Array;
  message?: string;
}

interface Progress {
  value: number;
  label: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / 1024 ** i;
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function useWorker() {
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(publicUrl("/pdf-worker.js"));
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return getWorker;
}

export function PdfPanel({ tool }: { tool: Tool }) {
  const [mode, setMode] = useState<Mode>("merge");
  const [files, setFiles] = useState<StagedPdf[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const resultRef = useRef<string | null>(null);
  const getWorker = useWorker();

  useEffect(() => {
    resultRef.current = resultUrl;
  }, [resultUrl]);

  useEffect(() => {
    return () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  const clearResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
    }
    setResultUrl(null);
    setResultSize(0);
    setError(null);
    setProgress(null);
  }, []);

  const stageFiles = useCallback((incoming: File[]) => {
    const bad: string[] = [];
    const good: StagedPdf[] = [];
    for (const f of incoming) {
      if (!isPdf(f)) {
        bad.push(f.name);
      } else {
        good.push({ id: `${f.name}-${f.size}-${f.lastModified}`, file: f });
      }
    }
    setFiles((prev) => [...prev, ...good]);
    if (bad.length) setRejected((prev) => [...prev, ...bad]);
    clearResult();
  }, [clearResult]);

  const onDrop = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    stageFiles(Array.from(e.dataTransfer.files));
  }, [stageFiles]);

  const onDragEnter = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) { dragDepth.current = 0; setIsDragOver(false); }
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    stageFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }, [stageFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    clearResult();
  }, [clearResult]);

  const run = useCallback(async () => {
    if (files.length === 0) return;
    if (mode === "redact" && files.length !== 1) return;

    clearResult();
    setError(null);
    setProgress({ value: 0, label: "Reading files…" });

    const worker = getWorker();

    const buffers = await Promise.all(files.map((s) => s.file.arrayBuffer()));
    const id = Math.random().toString(36).slice(2);

    const cleanup = () => { worker.onmessage = null; worker.onerror = null; };

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setProgress({ value: msg.value ?? 0, label: msg.label ?? "" });
      } else if (msg.type === "done" && msg.id === id) {
        cleanup();
        setProgress(null);
        const blob = new Blob([msg.bytes!.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setResultSize(blob.size);
      } else if (msg.type === "error" && msg.id === id) {
        cleanup();
        setProgress(null);
        setError(msg.message ?? "Unknown error");
      }
    };

    worker.onerror = (e) => {
      cleanup();
      setProgress(null);
      setError(e.message);
    };

    if (mode === "merge") {
      worker.postMessage({ op: "merge", id, buffers, names: files.map((f) => f.file.name) }, buffers);
    } else {
      worker.postMessage({ op: "redact", id, buffer: buffers[0] }, [buffers[0]]);
    }
  }, [files, mode, clearResult, getWorker]);

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const canRun = files.length > 0 && !progress && (mode === "merge" ? files.length >= 2 : files.length === 1);

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24"
    >
      {/* Mode toggle */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setMode("merge"); clearResult(); }}
          className={[
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
            mode === "merge"
              ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
              : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
          ].join(" ")}
        >
          <Merge aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          Merge
        </button>
        <button
          type="button"
          onClick={() => { setMode("redact"); setFiles((p) => p.slice(0, 1)); clearResult(); }}
          className={[
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
            mode === "redact"
              ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
              : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
          ].join(" ")}
        >
          <FileMinus2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          Blackout
        </button>
      </div>

      {/* Dropzone */}
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
          ref={undefined}
          type="file"
          multiple={mode === "merge"}
          accept="application/pdf,.pdf"
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
              {mode === "merge" ? "Merge PDFs" : "Blackout PDF"}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              {mode === "merge"
                ? "Drop two or more PDFs to merge them into one. pdf-lib runs entirely in a Web Worker, no upload, no server."
                : "Drop one PDF. Every page is covered with solid black on this device; nothing leaves your browser."}
            </span>
          </span>
          <span
            className="ml-auto hidden shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted sm:block"
            aria-hidden="true"
          >
            PDF
          </span>
        </span>

        <span className="relative flex min-h-48 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:min-h-64">
          <span
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-out",
              !isDragOver && "animate-float",
              isDragOver ? "bg-accent/10 text-accent" : "bg-paper-2 text-muted",
            ].join(" ")}
          >
            <UploadCloud aria-hidden="true" className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="space-y-1.5">
            <span className="block text-base font-medium text-ink">
              {isDragOver ? "Release to process locally" : "Drop PDF files here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : mode === "merge"
                ? "Drop 2+ PDFs · merged in a Worker · never uploaded"
                : "Drop 1 PDF · blacked out in a Worker · never uploaded"}
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

      {/* File list */}
      {files.length > 0 && (
        <ul className="mx-auto mt-4 max-w-5xl space-y-2">
          {files.map((staged, i) => (
            <li
              key={staged.id}
              className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-3 font-mono text-[0.625rem] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{staged.file.name}</p>
                <p className="font-mono text-xs text-muted">{formatBytes(staged.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(staged.id)}
                aria-label={`Remove ${staged.file.name}`}
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Run button */}
      {files.length > 0 && !progress && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className={[
              "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
              canRun
                ? "bg-accent text-accent-ink hover:brightness-110 active:translate-y-px"
                : "cursor-not-allowed bg-paper-3 text-muted",
            ].join(" ")}
          >
            {mode === "merge" ? (
              <><Merge aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} /> Merge {files.length} PDFs</>
            ) : (
              <><FileMinus2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} /> Blackout PDF</>
            )}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{progress.label}</span>
            <span className="font-mono text-[0.625rem] text-muted">{progress.value}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
            <div
              className="animate-shimmer h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
              style={{ width: `${progress.value}%` }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-ok/30 bg-paper-2 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ok/10">
            <Check aria-hidden="true" className="check-bounce h-4 w-4 text-ok" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {mode === "merge" ? "Merged PDF ready" : "Blacked-out PDF ready"}
            </p>
            <p className="font-mono text-xs text-muted">{formatBytes(resultSize)}</p>
          </div>
          <a
            href={resultUrl}
            download={mode === "merge" ? "merged.pdf" : "blacked-out.pdf"}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-accent transition-colors duration-200 ease-out hover:bg-paper-3 active:translate-y-px"
          >
            <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            Download
          </a>
        </div>
      )}

      {/* Error */}
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
            aria-label="Dismiss error"
            className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <ul className="mx-auto mt-4 max-w-5xl space-y-2" role="alert">
          {rejected.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-error/40 bg-paper-2 px-3 py-2.5"
            >
              <X aria-hidden="true" className="h-5 w-5 shrink-0 text-error" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                <p className="text-xs text-muted">Only PDF files are supported.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejected((p) => p.filter((_, j) => j !== i))}
                aria-label={`Dismiss ${name}`}
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
