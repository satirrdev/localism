"use client";

import {
  Fingerprint,
  Image as ImageIcon,
  FileText,
  ScanLine,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useRef } from "react";

export type ToolId = "image" | "pdf" | "video" | "hash" | "exif";

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
    heading: "Compress and convert images",
    lede: "Resize, recompress, and transcode images. OffscreenCanvas runs in a Web Worker so the main thread stays responsive.",
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
    lede: "Compute SHA-256, SHA-1, SHA-512, and MD5 from a streamed read in a Web Worker. Handles huge files without breaking a sweat — nothing is uploaded.",
    hint: "Any file",
  },
  {
    id: "exif",
    label: "EXIF Scrubber",
    icon: ScanLine,
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    heading: "Strip EXIF metadata from images",
    lede: "Drop a JPG or PNG and all embedded metadata — GPS, camera model, timestamps — is erased on-device via Canvas. Nothing leaves your browser.",
    hint: "JPG, PNG",
  },
];

interface ToolTabsProps {
  active: ToolId;
  onChange: (id: ToolId) => void;
}

export function ToolTabs({ active, onChange }: ToolTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);

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
    <div
      role="tablist"
      aria-label="Local tools"
      ref={tabsRef}
      className="no-scrollbar flex items-stretch gap-1 overflow-x-auto border-b border-rule py-2"
    >
      {TOOLS.map((tool) => {
        const isActive = tool.id === active;
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            data-tab={tool.id}
            role="tab"
            id={`tab-${tool.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tool.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tool.id)}
            onKeyDown={onKeyDown}
            className={[
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
              "transition-colors duration-200 ease-out active:translate-y-px",
              isActive
                ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--color-rule-2)]"
                : "text-muted hover:bg-paper-2/50 hover:text-ink-2",
            ].join(" ")}
          >
            <Icon
              aria-hidden="true"
              className={
                isActive ? "h-4 w-4 text-accent" : "h-4 w-4 text-muted"
              }
              strokeWidth={1.75}
            />
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}
