"use client";

import { useState } from "react";
import { HashPanel } from "@/components/hash-panel";
import { ImagePanel } from "@/components/image-panel";
import { PdfPanel } from "@/components/pdf-panel";
import { VideoPanel } from "@/components/video-panel";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { ToolTabs, TOOLS, type ToolId } from "@/components/tool-tabs";
import { ValueProposition } from "@/components/value-proposition";

export default function Home() {
  const [activeTool, setActiveTool] = useState<ToolId>("image");

  const tool = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1 py-6 sm:py-10">
        <Reveal>
          <div className="mx-auto w-full max-w-[72rem] px-4 sm:px-6">
            <div className="mb-4 sm:mb-6 stagger">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
                Localism / utility suite
              </p>
              <h1 className="mt-1.5 max-w-[20ch] min-w-0 text-2xl font-semibold tracking-tight text-ink wrap-anywhere sm:mt-2 sm:text-4xl">
                Your files, processed on this device.
              </h1>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted sm:mt-3 sm:text-base">
                Pick a tool, drop a file. Everything runs in your browser — no
                upload, no server, no account.
              </p>
            </div>

            <div className="stagger">
              <ToolTabs active={activeTool} onChange={setActiveTool} />
            </div>
          </div>

          <div key={`${activeTool}-panel`} className="animate-rise">
            {activeTool === "image" ? (
              <ImagePanel key={tool.id} tool={tool} />
            ) : activeTool === "pdf" ? (
              <PdfPanel key={tool.id} tool={tool} />
            ) : activeTool === "video" ? (
              <VideoPanel key={tool.id} tool={tool} />
            ) : (
              <HashPanel key={tool.id} tool={tool} />
            )}
          </div>
        </Reveal>

        <ValueProposition />
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-2 px-4 pb-16 pt-4 font-mono text-xs text-muted sm:px-6 sm:pb-24">
          <p>localism — a privacy-first utility suite</p>
          <p>
            no servers · no accounts · no tracking
          </p>
        </div>
      </footer>
    </div>
  );
}
