"use client";

import {
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  Trash2,
  UploadCloud,
  X,
  XCircle,
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

type AlgoKey = "sha256" | "sha1" | "sha512" | "md5";
type Hashes = Record<AlgoKey, string>;
type Status = "idle" | "hashing" | "done" | "cancelled" | "error";

interface ProgressState {
  percentage: number;
  speedMBps: number;
  bytesProcessed: number;
  totalBytes: number;
}

const ALGOS: { key: AlgoKey; label: string }[] = [
  { key: "sha256", label: "SHA-256" },
  { key: "sha1", label: "SHA-1" },
  { key: "sha512", label: "SHA-512" },
  { key: "md5", label: "MD5" },
];

/* ── Helpers ───────────────────────────────────────────── */

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

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ── Component ─────────────────────────────────────────── */

export function HashPanel({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [hashes, setHashes] = useState<Hashes | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [copied, setCopied] = useState<AlgoKey | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker("/hash-worker.js");
    }
    return workerRef.current;
  }, []);

  const resetResult = useCallback(() => {
    setProgress(null);
    setHashes(null);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
    setVerifyInput("");
  }, []);

  const startHash = useCallback(
    (f: File) => {
      resetResult();
      setStatus("hashing");
      setProgress({
        percentage: 0,
        speedMBps: 0,
        bytesProcessed: 0,
        totalBytes: f.size,
      });

      const worker = getWorker();
      const id = Math.random().toString(36).slice(2);
      activeIdRef.current = id;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.id !== activeIdRef.current) return;

        if (msg.type === "progress") {
          setProgress({
            percentage: msg.percentage,
            speedMBps: msg.speedMBps,
            bytesProcessed: msg.bytesProcessed,
            totalBytes: msg.totalBytes,
          });
        } else if (msg.type === "done") {
          setHashes(msg.hashes);
          setElapsedMs(msg.elapsedMs);
          setStatus("done");
          setProgress(null);
        } else if (msg.type === "cancelled") {
          setStatus("cancelled");
          setProgress(null);
        } else if (msg.type === "error") {
          setError(msg.message);
          setStatus("error");
          setProgress(null);
        }
      };

      worker.onerror = (e) => {
        setError(e.message);
        setStatus("error");
        setProgress(null);
      };

      worker.postMessage({ type: "hash", id, file: f });
    },
    [getWorker, resetResult],
  );

  const cancelHash = useCallback(() => {
    if (activeIdRef.current && workerRef.current) {
      workerRef.current.postMessage({ type: "abort", id: activeIdRef.current });
    }
  }, []);

  const stageFiles = useCallback(
    (incoming: File[]) => {
      const f = incoming[0];
      if (!f) return;
      /* abort any in-flight hash before staging the new file */
      if (status === "hashing") cancelHash();
      setFile(f);
      startHash(f);
    },
    [status, cancelHash, startHash],
  );

  const removeFile = useCallback(() => {
    if (status === "hashing") cancelHash();
    setFile(null);
    resetResult();
  }, [status, cancelHash, resetResult]);

  /* ── drag handlers ───────────────────── */

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

  /* ── copy + verify ───────────────────── */

  const copyHash = useCallback(async (algo: AlgoKey, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
    setCopied(algo);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  }, []);

  const trimmedVerify = verifyInput.trim().toLowerCase();
  const matchedAlgo =
    hashes && trimmedVerify
      ? ALGOS.find((a) => hashes[a.key] === trimmedVerify)?.key ?? null
      : null;
  const showNoMatch = Boolean(trimmedVerify) && !matchedAlgo && status === "done";

  /* ── derived ─────────────────────────── */

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const isHashing = status === "hashing";

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-[72rem] px-4 pb-16 sm:px-6 sm:pb-24"
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
            <Icon
              aria-hidden="true"
              className="h-4.5 w-4.5"
              strokeWidth={1.75}
            />
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
                ? "Release to hash locally"
                : "Drop a file here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : "Any file, any size · streamed in 8 MB chunks · never uploaded"}
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

      {/* ── Staged file ───────────────────────────── */}
      {file && (
        <div className="mt-4 space-y-4">
          {/* file info bar */}
          <div className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5">
            <Fingerprint
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-muted"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {file.name}
              </p>
              <p className="font-mono text-xs text-muted">
                {formatBytes(file.size)} ·{" "}
                {isHashing
                  ? "hashing…"
                  : status === "done"
                    ? `hashed in ${formatMs(elapsedMs)}`
                    : status === "cancelled"
                      ? "cancelled"
                      : status === "error"
                        ? "failed"
                        : "ready"}
              </p>
            </div>
            {!isHashing && (
              <button
                type="button"
                onClick={() => startHash(file)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-accent transition-colors duration-200 ease-out hover:bg-paper-3 active:translate-y-px"
              >
                Re-hash
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isHashing}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium",
                isHashing
                  ? "cursor-not-allowed text-muted/40"
                  : "text-accent transition-colors duration-200 ease-out hover:bg-paper-3 active:translate-y-px",
              ].join(" ")}
            >
              Change
            </button>
            <button
              type="button"
              onClick={removeFile}
              disabled={isHashing}
              aria-label="Remove file"
              className={[
                "rounded-full p-2 transition-colors duration-200 ease-out",
                isHashing
                  ? "cursor-not-allowed text-muted/40"
                  : "text-muted hover:bg-paper-3 hover:text-error active:translate-y-px",
              ].join(" ")}
            >
              <Trash2
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.5}
              />
            </button>
          </div>

          {/* ── Progress ─────────────────────────── */}
          {progress && (
            <div
              className="space-y-2 rounded-xl border border-rule bg-panel p-4"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted">
                  {formatBytes(progress.bytesProcessed)} /{" "}
                  {formatBytes(progress.totalBytes)}
                </span>
                <span className="font-mono text-[0.625rem] text-accent">
                  {progress.speedMBps > 0
                    ? `${progress.speedMBps.toFixed(1)} MB/s`
                    : "…"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-3">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  Computing SHA-256 · SHA-1 · SHA-512 · MD5
                </span>
                <span className="font-mono text-[0.625rem] text-muted">
                  {Math.round(progress.percentage)}%
                </span>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={cancelHash}
                  className="flex items-center gap-1.5 rounded-full border border-rule-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 ease-out hover:border-error/50 hover:text-error active:translate-y-px"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Result cards ─────────────────────── */}
          {hashes && (
            <div className="space-y-2">
              {ALGOS.map(({ key, label }) => (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                    matchedAlgo === key
                      ? "border-ok/50 bg-ok/5"
                      : "border-rule bg-paper-2",
                  ].join(" ")}
                >
                  <span className="w-16 shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    {label}
                  </span>
                  <p className="min-w-0 flex-1 wrap-anywhere font-mono text-xs leading-relaxed text-ink-2">
                    {hashes[key]}
                  </p>
                  <span
                    className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-ok"
                    role="status"
                  >
                    {copied === key ? "Copied!" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyHash(key, hashes[key])}
                    aria-label={`Copy ${label} hash`}
                    className="shrink-0 rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-accent active:translate-y-px"
                  >
                    {copied === key ? (
                      <Check
                        aria-hidden="true"
                        className="h-4 w-4 text-ok"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Copy
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Verify / Compare checksum ────────── */}
          {hashes && (
            <div className="rounded-2xl border border-rule bg-panel p-4">
              <label
                htmlFor="verify-checksum"
                className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted"
              >
                Verify / Compare Checksum
              </label>
              <input
                id="verify-checksum"
                type="text"
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                placeholder="Paste expected hash from an external source…"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-rule-2 bg-paper-2 px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />

              {matchedAlgo && (
                <div
                  className="mt-3 flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2"
                  role="status"
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-ok"
                    strokeWidth={2}
                  />
                  <span className="text-sm font-semibold text-ok">
                    Match Found ({ALGOS.find((a) => a.key === matchedAlgo)?.label})
                  </span>
                </div>
              )}

              {showNoMatch && (
                <div
                  className="mt-3 flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2"
                  role="alert"
                >
                  <XCircle
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-error"
                    strokeWidth={2}
                  />
                  <span className="text-sm font-semibold text-error">
                    No Match
                  </span>
                </div>
              )}

              {!trimmedVerify && (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Case-insensitive, whitespace-trimmed comparison against all
                  four computed digests.
                </p>
              )}
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
