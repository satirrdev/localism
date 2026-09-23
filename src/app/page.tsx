"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { BgRemovePanel } from "@/components/bg-remove-panel";
import { HashPanel } from "@/components/hash-panel";
import { ImagePanel } from "@/components/image-panel";
import { OcrPanel } from "@/components/ocr-panel";
import { PdfPanel } from "@/components/pdf-panel";
import { VideoPanel } from "@/components/video-panel";
import { WatermarkPanel } from "@/components/watermark-panel";
import { FAQ } from "@/components/faq";
import { SiteHeader } from "@/components/site-header";
import { ToolTabs, TOOLS, type ToolId } from "@/components/tool-tabs";
import { ValueProposition } from "@/components/value-proposition";

export default function Home() {
  const [activeTool, setActiveTool] = useState<ToolId>("image");

  const tool = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="relative flex-1">
        <div className="hero-glow" aria-hidden="true" />

        <div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-10 sm:px-6 sm:pt-16">
          <div className="stagger">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-neutral">
              Localism / utility suite
            </p>
            <h1 className="mt-2 max-w-[22ch] min-w-0 text-3xl font-semibold tracking-tight text-ink wrap-anywhere sm:text-5xl">
              Your files, processed on this device.
            </h1>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted sm:text-base">
              Pick a tool, drop a file. Everything runs in your browser, no
              upload, no server, no account.
            </p>
          </div>
        </div>

        <ToolTabs active={activeTool} onChange={setActiveTool} />

        <div key={`${activeTool}-panel`} className="animate-rise">
          {activeTool === "image" ? (
            <ImagePanel key={tool.id} tool={tool} />
          ) : activeTool === "pdf" ? (
            <PdfPanel key={tool.id} tool={tool} />
          ) : activeTool === "video" ? (
            <VideoPanel key={tool.id} tool={tool} />
          ) : activeTool === "watermark" ? (
            <WatermarkPanel key={tool.id} tool={tool} />
          ) : activeTool === "bgremove" ? (
            <BgRemovePanel key={tool.id} tool={tool} />
          ) : activeTool === "ocr" ? (
            <OcrPanel key={tool.id} tool={tool} />
          ) : (
            <HashPanel key={tool.id} tool={tool} />
          )}
        </div>

        <ValueProposition />

        <FAQ />
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <p className="font-mono text-xs text-muted">
            localism, a privacy-first utility suite · AGPL-3.0
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/satirrdev/localism"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper-2 px-3 py-1 font-mono text-xs text-ink-2 transition-colors duration-200 ease-out hover:border-rule-2 hover:bg-panel-2"
            >
              <Code2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Audit on GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}