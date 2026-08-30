"use client";

import { useRef, useState, type ReactNode } from "react";
import { Info, Lock, X } from "lucide-react";

const HOW_IT_WORKS =
  "How it works: All processing runs client-side in your browser's WebAssembly & Web Worker threads. No telemetry, no cloud storage. Open your browser's Network Tab (F12) to verify zero network requests.";

function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How Localism works"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-rule-2 bg-panel-2 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-paper-3 hover:text-ink-2"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Lock aria-hidden="true" className="h-4.5 w-4.5 text-accent" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">
              100% Offline · Local Processing
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{children}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#"
          aria-label="Localism home"
          className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-ink"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-accent"
          />
          localism
        </a>

        <button
          ref={badgeRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-rule bg-paper-2 px-3 py-1.5 transition-colors duration-200 ease-out hover:border-rule-2 hover:bg-panel-2"
        >
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60" />
            <span className="status-dot relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          <Lock
            aria-hidden="true"
            className="h-3 w-3 text-ink-2"
            strokeWidth={1.75}
          />
          <span className="whitespace-nowrap font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-2">
            100% Offline / Local Processing
          </span>
          <Info
            aria-hidden="true"
            className="h-3 w-3 text-muted"
            strokeWidth={1.75}
          />
        </button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        {HOW_IT_WORKS}
      </Dialog>
    </header>
  );
}
