"use client";

import {
  Download,
  FileVideo,
  Play,
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
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

/* ── Constants ─────────────────────────────────────────── */

type OutputFormat = "mp4" | "webm" | "gif" | "mp3";
type Resolution = "original" | "1080" | "720" | "480";
type Speed = "ultrafast" | "veryfast" | "fast";

const FORMATS: { value: OutputFormat; label: string; ext: string; mime: string }[] = [
  { value: "mp4", label: "MP4 (H.264)", ext: "mp4", mime: "video/mp4" },
  { value: "webm", label: "WebM (VP9)", ext: "webm", mime: "video/webm" },
  { value: "gif", label: "GIF", ext: "gif", mime: "image/gif" },
  { value: "mp3", label: "MP3 (Audio)", ext: "mp3", mime: "audio/mpeg" },
];

const CRF_PRESETS = [
  { value: 23, label: "High Quality", sub: "CRF 23" },
  { value: 28, label: "Balanced", sub: "CRF 28 · Recommended" },
  { value: 34, label: "Max Compression", sub: "CRF 34" },
] as const;

const RESOLUTIONS = [
  { value: "original", label: "Original" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
] as const;

const SPEEDS = [
  { value: "ultrafast", label: "Ultra Fast" },
  { value: "veryfast", label: "Very Fast" },
  { value: "fast", label: "Fast" },
] as const;

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

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function isVideo(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mkv|avi|mov|webm)$/i.test(file.name)
  );
}

function outName(original: string, fmt: OutputFormat): string {
  const base = original.replace(/\.[^.]+$/, "");
  const prefix = fmt === "mp3" ? "localism_audio_" : "localism_compressed_";
  const ext = FORMATS.find((f) => f.value === fmt)!.ext;
  return `${prefix}${base}.${ext}`;
}

function buildArgs(
  input: string,
  output: string,
  fmt: OutputFormat,
  crf: number,
  resolution: Resolution,
  muteAudio: boolean,
  speed: Speed,
): string[] {
  if (fmt === "mp3") {
    return ["-i", input, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", "-y", output];
  }

  const a: string[] = ["-i", input];

  /* ── video codec ─────────────────────── */
  if (fmt === "mp4") {
    a.push("-vcodec", "libx264", "-crf", String(crf), "-preset", speed);
  } else if (fmt === "webm") {
    a.push("-vcodec", "libvpx-vp9", "-crf", String(crf), "-b:v", "0");
  }

  /* ── scale ───────────────────────────── */
  if (fmt === "gif") {
    const h = resolution === "original" ? "480" : resolution;
    a.push("-vf", `fps=10,scale=-2:${h}:flags=lanczos`);
  } else if (resolution !== "original") {
    a.push("-vf", `scale=-2:${resolution}`);
  }

  /* ── audio ───────────────────────────── */
  if (muteAudio || fmt === "gif") {
    a.push("-an");
  } else if (fmt === "mp4") {
    a.push("-acodec", "aac", "-b:a", "128k");
  } else if (fmt === "webm") {
    a.push("-acodec", "libopus", "-b:a", "128k");
  }

  a.push("-y", output);
  return a;
}

/* ── Component ─────────────────────────────────────────── */

export function VideoPanel({ tool }: { tool: Tool }) {
  /* ── file state ──────────────────────── */
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ── settings ────────────────────────── */
  const [format, setFormat] = useState<OutputFormat>("mp4");
  const [crf, setCrf] = useState(28);
  const [resolution, setResolution] = useState<Resolution>("original");
  const [muteAudio, setMuteAudio] = useState(false);
  const [speed, setSpeed] = useState<Speed>("veryfast");

  /* ── ui state ────────────────────────── */
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<{
    value: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── result ──────────────────────────── */
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);

  /* ── elapsed timer ───────────────────── */
  const [now, setNow] = useState(0);
  const [startTime, setStartTime] = useState(0);

  /* ── refs for cleanup ────────────────── */
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);

  /* sync refs */
  useEffect(() => {
    previewRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(() => {
    resultRef.current = resultUrl;
  }, [resultUrl]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  /* elapsed timer — ticks every second while processing */
  useEffect(() => {
    if (!progress) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [progress]);

  /* ── callbacks ───────────────────────── */

  const resetResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current);
      resultRef.current = null;
    }
    setResultUrl(null);
    setResultSize(0);
    setError(null);
    setProgress(null);
    setStartTime(0);
    setNow(0);
  }, []);

  const stageFiles = useCallback(
    (incoming: File[]) => {
      const vf = Array.from(incoming).find((f) => isVideo(f));
      if (!vf) return;

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
      resetResult();

      const url = URL.createObjectURL(vf);
      setPreviewUrl(url);
      setFile(vf);
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
    resetResult();
  }, [resetResult]);

  const process = useCallback(async () => {
    if (!file) return;
    resetResult();
    setError(null);
    setStartTime(Date.now());
    setProgress({ value: 0, label: "Initializing FFmpeg…" });

    try {
      const ffmpeg = await getFFmpeg();
      const inputName = "input_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = FORMATS.find((f) => f.value === format)!.ext;
      const outputName = `output.${ext}`;

      setProgress({ value: 5, label: "Writing file to sandbox…" });
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      ffmpeg.on("progress", ({ progress: p }) => {
        const clamped = Math.min(Math.max(p, 0), 1);
        const label =
          format === "mp3"
            ? "Extracting audio…"
            : `Encoding ${format.toUpperCase()}…`;
        setProgress({ value: Math.round(clamped * 100), label });
      });

      const args = buildArgs(
        inputName,
        outputName,
        format,
        crf,
        resolution,
        muteAudio,
        speed,
      );
      setProgress({ value: 8, label: `Starting ${format.toUpperCase()} encode…` });
      await ffmpeg.exec(args);

      setProgress({ value: 95, label: "Reading output…" });
      const data = await ffmpeg.readFile(outputName);
      const arr =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
      const mime = FORMATS.find((f) => f.value === format)!.mime;
      const blob = new Blob([arr.buffer as ArrayBuffer], { type: mime });
      const url = URL.createObjectURL(blob);

      resultRef.current = url;
      setResultUrl(url);
      setResultSize(blob.size);
      setProgress(null);

      /* cleanup WASM virtual filesystem */
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    } catch (err: unknown) {
      setProgress(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [file, format, crf, resolution, muteAudio, speed, resetResult]);

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

  /* ── derived ─────────────────────────── */

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;
  const canProcess = !!file && !progress;
  const savings =
    file && resultSize > 0
      ? ((file.size - resultSize) / file.size) * 100
      : null;
  const outputName = file ? outName(file.name, format) : "";
  const isAudio = format === "mp3";
  const isGif = format === "gif";
  const disableSpeed = isGif || isAudio;
  const disableResolution = isAudio;
  const disableMute = isGif || isAudio;
  const elapsed =
    progress && startTime > 0
      ? Math.floor((now - startTime) / 1000)
      : 0;

  const buttonLabel: Record<OutputFormat, string> = {
    mp4: "Compress Video",
    webm: "Convert to WebM",
    gif: "Create GIF",
    mp3: "Extract Audio",
  };

  /* ── JSX ─────────────────────────────── */

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
          accept="video/mp4,video/quicktime,video/x-matroska,video/x-msvideo,video/webm,.mp4,.mov,.mkv,.avi,.webm"
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
                ? "Release to process locally"
                : "Drop a video here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : "MP4, MOV, MKV, AVI, WebM · Compress, convert, extract audio"}
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
            {previewUrl && (
              <video
                src={previewUrl}
                className="h-9 w-16 shrink-0 rounded-lg object-cover"
                preload="metadata"
                muted
              />
            )}
            {!previewUrl && (
              <FileVideo
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-muted"
                strokeWidth={1.5}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {file.name}
              </p>
              <p className="font-mono text-xs text-muted">
                {formatBytes(file.size)}
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
              <Trash2
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.5}
              />
            </button>
          </div>

          {/* ── Settings card ──────────────────────── */}
          <div className="rounded-2xl border border-rule bg-panel p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* left: format + CRF + speed */}
              <div className="space-y-3">
                {/* format */}
                <div>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Output Format
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMATS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFormat(f.value)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          format === f.value
                            ? "bg-accent text-accent-ink"
                            : "bg-paper-2 text-muted hover:text-ink-2",
                        ].join(" ")}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CRF preset */}
                <div>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Compression
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CRF_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setCrf(p.value)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          crf === p.value
                            ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                            : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <span className="mt-1 block font-mono text-[0.625rem] text-muted/60">
                    {CRF_PRESETS.find((p) => p.value === crf)?.sub}
                  </span>
                </div>

                {/* speed */}
                <div className={disableSpeed ? "opacity-40" : ""}>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Speed
                    {disableSpeed && (
                      <span className="ml-1 text-muted/50">
                        (n/a for {isGif ? "GIF" : "MP3"})
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={disableSpeed}
                        onClick={() => setSpeed(s.value)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          speed === s.value
                            ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                            : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
                          disableSpeed
                            ? "cursor-not-allowed"
                            : "",
                        ].join(" ")}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* right: resolution + mute */}
              <div className="space-y-3">
                {/* resolution */}
                <div className={disableResolution ? "opacity-40" : ""}>
                  <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                    Resolution
                    {disableResolution && (
                      <span className="ml-1 text-muted/50">
                        (n/a for MP3)
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {RESOLUTIONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        disabled={disableResolution}
                        onClick={() => setResolution(r.value)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out",
                          resolution === r.value
                            ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                            : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
                          disableResolution
                            ? "cursor-not-allowed"
                            : "",
                        ].join(" ")}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* mute audio */}
                <div className={disableMute ? "opacity-40" : ""}>
                  <label
                    className={[
                      "flex items-center gap-2 text-xs",
                      disableMute
                        ? "cursor-not-allowed text-muted/50"
                        : "cursor-pointer text-muted",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={muteAudio}
                      disabled={disableMute}
                      onChange={() => !disableMute && setMuteAudio(!muteAudio)}
                      className="accent-accent"
                    />
                    Mute audio track
                  </label>
                  <span className="mt-1 block font-mono text-[0.625rem] text-muted/60">
                    {isGif
                      ? "GIF has no audio"
                      : isAudio
                        ? "Audio-only output"
                        : "Drastically reduces file size"}
                  </span>
                </div>

                {/* info note */}
                <div className="rounded-lg border border-rule bg-paper-2 px-3 py-2">
                  <p className="text-[0.6875rem] leading-relaxed text-muted">
                    {isAudio
                      ? "Extracts the audio track as MP3. Video is discarded."
                      : isGif
                        ? "Creates an animated GIF at 10 fps. No audio."
                        : `Encodes with ${
                            format === "mp4" ? "H.264 + AAC" : "VP9 + Opus"
                          }. All processing happens locally via FFmpeg WASM.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Process button ─────────────────────── */}
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
                <Play
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.75}
                />
                {buttonLabel[format]}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Progress ──────────────────────────────── */}
      {progress && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{progress.label}</span>
            <span className="font-mono text-[0.625rem] text-muted">
              {elapsed > 0 && `${formatElapsed(elapsed)} · `}
              {Math.round(progress.value)}%
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

      {/* ── Result ────────────────────────────────── */}
      {resultUrl && file && (
        <div className="animate-pop mt-4 space-y-3">
          {/* stats comparison */}
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
              </p>
            </div>
          </div>

          {/* preview */}
          {!isAudio && (
            <div className="overflow-hidden rounded-xl border border-rule bg-panel">
              {isGif ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultUrl}
                  alt="Processed GIF"
                  className="w-full max-h-64 object-contain"
                />
              ) : (
                <video
                  src={resultUrl}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              )}
            </div>
          )}

          {isAudio && (
            <div className="rounded-xl border border-rule bg-panel p-4">
              <audio src={resultUrl} controls className="w-full" />
            </div>
          )}

          {/* download */}
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
