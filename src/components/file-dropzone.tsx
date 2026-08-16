"use client";

import {
  Check,
  FileText,
  Image as ImageIcon,
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

export interface StagedFile {
  id: string;
  file: File;
  objectUrl: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function accepts(accept: string, name: string, type: string): boolean {
  if (!accept) return true;
  const rules = accept.split(",").map((r) => r.trim()).filter(Boolean);
  if (rules.length === 0) return true;
  const lowerName = name.toLowerCase();
  return rules.some((rule) => {
    if (rule === "*/*") return true;
    if (rule.startsWith(".")) return lowerName.endsWith(rule);
    const [base] = rule.split("/");
    if (rule.endsWith("/*"))
      return type.startsWith(`${base}/`) || base === "image";
    return type === rule;
  });
}

export function FileDropzone({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [rejected, setRejected] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<StagedFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const revokeObjectUrl = useCallback((staged: StagedFile) => {
    if (staged.objectUrl) URL.revokeObjectURL(staged.objectUrl);
  }, []);

  const stageFiles = useCallback(
    (incoming: File[]) => {
      const next: StagedFile[] = [];
      const bad: File[] = [];
      for (const file of incoming) {
        if (!accepts(tool.accept, file.name, file.type)) {
          bad.push(file);
          continue;
        }
        const objectUrl =
          file.type.startsWith("image/") && tool.id === "image"
            ? URL.createObjectURL(file)
            : null;
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          objectUrl,
        });
      }
      setFiles((prev) => [...prev, ...next]);
      setRejected((prev) => [...prev, ...bad]);
    },
    [tool.accept, tool.id],
  );

  // Memory hygiene — revoke every live object URL on unmount only.
  // Per-file revocation happens in removeFile (RULES.md rule 3).
  useEffect(() => {
    return () => filesRef.current.forEach(revokeObjectUrl);
  }, [revokeObjectUrl]);

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

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === id);
        if (target) revokeObjectUrl(target);
        return prev.filter((f) => f.id !== id);
      });
    },
    [revokeObjectUrl],
  );

  const inputId = `file-input-${tool.id}`;
  const Icon = tool.icon;

  return (
    <section
      id={`panel-${tool.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tool.id}`}
      className="mx-auto w-full max-w-[72rem] px-4 pb-16 sm:px-6 sm:pb-24"
    >
      {/* Dropzone — one card, whole surface is a label, fully clickable.
          The tool description lives in the card header; no duplicate page header. */}
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

        {/* Card header — tool identity merged into the dropzone */}
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

        {/* Drop surface */}
        <span className="relative flex min-h-48 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:min-h-64">
          <span
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-out",
              isDragOver ? "bg-accent/10 text-accent" : "bg-paper-2 text-muted",
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
                : "Drop files here or tap to browse"}
            </span>
            <span className="block text-sm text-muted">
              {isDragOver
                ? "Files stay on this device."
                : `Processed in-browser · never uploaded · ${tool.hint.toLowerCase()}`}
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
        <ul className="mx-auto mt-4 max-w-[72rem] space-y-2">
          {files.map((staged) => (
            <li
              key={staged.id}
              className="flex items-center gap-3 rounded-xl border border-rule bg-paper-2 px-3 py-2.5"
            >
              {staged.objectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staged.objectUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-9 w-9 rounded-lg border border-rule object-cover"
                />
              ) : staged.file.type.startsWith("image/") ? (
                <ImageIcon
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted"
                  strokeWidth={1.5}
                />
              ) : (
                <FileText
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted"
                  strokeWidth={1.5}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {staged.file.name}
                </p>
                <p className="font-mono text-xs text-muted">
                  {formatBytes(staged.file.size)} ·{" "}
                  {staged.file.type || "unknown type"}
                </p>
              </div>
              <span
                className="flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-ok"
                role="status"
              >
                <Check aria-hidden="true" className="h-3 w-3" />
                staged
              </span>
              <button
                type="button"
                onClick={() => removeFile(staged.id)}
                aria-label={`Remove ${staged.file.name}`}
                className="rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-paper-3 hover:text-error active:translate-y-px"
              >
                <Trash2
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.5}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Rejected files */}
      {rejected.length > 0 && (
        <ul className="mx-auto mt-4 max-w-[72rem] space-y-2" role="alert">
          {rejected.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3 rounded-xl border border-error/40 bg-paper-2 px-3 py-2.5"
            >
              <X
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-error"
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {file.name}
                </p>
                <p className="text-xs text-muted">
                  File type not supported by {tool.label}. Expected{" "}
                  {tool.hint}.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRejected((prev) =>
                    prev.filter(
                      (f) =>
                        !(
                          f.name === file.name &&
                          f.size === file.size &&
                          f.lastModified === file.lastModified
                        ),
                    ),
                  )
                }
                aria-label={`Dismiss ${file.name}`}
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
