"use client";

import {
  Fingerprint,
  Image as ImageIcon,
  FileText,
  ScanEye,
  ScanText,
  Stamp,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type ToolId =
  | "image"
  | "pdf"
  | "video"
  | "hash"
  | "watermark"
  | "bgremove"
  | "ocr";

export interface Tool {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  accept: string;
  heading: string;
  lede: string;
  hint: string;
}

export const TOOLS: Tool[] = [
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    accept: "image/*",
    heading: "Compress, convert, and strip EXIF",
    lede: "Resize, recompress, transcode, and remove EXIF metadata from images. OffscreenCanvas runs in a Web Worker so the main thread stays responsive.",
    hint: "PNG, JPG, WebP, GIF, AVIF",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    accept: "application/pdf,.pdf",
    heading: "Merge, split, and sign PDFs",
    lede: "Combine pages, extract ranges, and stamp signatures. pdf-lib executes entirely in your browser.",
    hint: "PDF",
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    accept: "video/*",
    heading: "Compress and convert videos",
    lede: "Compress, convert, and extract audio from videos. FFmpeg WASM runs in a Web Worker so the main thread stays responsive.",
    hint: "MP4, WebM, GIF, MP3",
  },
  {
    id: "hash",
    label: "Hash",
    icon: Fingerprint,
    accept: "",
    heading: "Verify file integrity",
    lede: "Compute SHA-256, SHA-1, SHA-512, and MD5 from a streamed read in a Web Worker. Handles huge files without breaking a sweat, nothing is uploaded.",
    hint: "Any file",
  },
  {
    id: "watermark",
    label: "Watermark",
    icon: Stamp,
    accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    heading: "Watermark & redact documents",
    lede: "Stamp a watermark over IDs, KTPs, passports, or invoices and censor sensitive fields. All rendered locally via Canvas, nothing is uploaded.",
    hint: "JPG, PNG, WebP",
  },
  {
    id: "bgremove",
    label: "BG Remove",
    icon: ScanEye,
    accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    heading: "AI background removal",
    lede: "Erase the background of any photo with an in-browser ONNX AI model. Running fully locally via WebAssembly, no upload, no account.",
    hint: "JPG, PNG, WebP",
  },
  {
    id: "ocr",
    label: "OCR",
    icon: ScanText,
    accept: "image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp",
    heading: "Extract text from images",
    lede: "Drop a scan or photo and read its text back. Tesseract SIMD WASM runs in a Web Worker; the engine and language model are bundled and cached for offline use.",
    hint: "JPG, PNG, WebP, BMP",
  },
];

interface ToolTabsProps {
  active: ToolId;
  onChange: (id: ToolId) => void;
}

export function ToolTabs({ active, onChange }: ToolTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );

  const measurePill = useCallback(() => {
    const idx = TOOLS.findIndex((t) => t.id === active);
    const el = btnRefs.current[idx];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill]);

  useEffect(() => {
    window.addEventListener("resize", measurePill);
    return () => window.removeEventListener("resize", measurePill);
  }, [measurePill]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const idx = TOOLS.findIndex((t) => t.id === active);
      let next: ToolId | null = null;
      if (e.key === "ArrowRight") next = TOOLS[(idx + 1) % TOOLS.length].id;
      if (e.key === "ArrowLeft")
        next = TOOLS[(idx - 1 + TOOLS.length) % TOOLS.length].id;
      if (e.key === "Home") next = TOOLS[0].id;
      if (e.key === "End") next = TOOLS[TOOLS.length - 1].id;
      if (next) {
        e.preventDefault();
        onChange(next);
        tabsRef.current
          ?.querySelector<HTMLElement>(`[data-tab="${next}"]`)
          ?.focus();
      }
    },
    [active, onChange],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2 sm:px-6">
      <div
        role="tablist"
        aria-label="Local tools"
        ref={tabsRef}
        className="no-scrollbar relative flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-rule bg-panel/60 p-1"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 rounded-lg bg-paper-3 shadow-sm transition-[left,width] duration-200 ease-out"
          style={
            pill ? { left: pill.left, width: pill.width } : undefined
          }
        />
        {TOOLS.map((tool, i) => {
          const isActive = tool.id === active;
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              data-tab={tool.id}
              role="tab"
              id={`tab-${tool.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tool.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tool.id)}
              onKeyDown={onKeyDown}
              className={[
                "group relative z-10 flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium",
                "transition-colors duration-200 ease-out active:translate-y-px",
                isActive
                  ? "text-ink"
                  : "text-muted hover:bg-paper-2/60 hover:text-ink-2",
              ].join(" ")}
            >
              <Icon
                aria-hidden="true"
                className={[
                  "h-4 w-4 transition-colors duration-200 ease-out",
                  isActive ? "text-accent" : "text-neutral",
                ].join(" ")}
                strokeWidth={1.75}
              />
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
