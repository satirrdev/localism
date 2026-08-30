"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Lock, X } from "lucide-react";

const HOW_IT_WORKS =
  "How it works: All processing runs client-side in your browser's WebAssembly & Web Worker threads. No telemetry, no cloud storage. Open your browser's Network Tab (F12) to verify zero network requests.";

function OfflinePopover({
  open,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

  /* anchor to the trigger badge (right-aligned, below it) */
  useEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ right: window.innerWidth - rect.right, top: rect.bottom + 8 });
  }, [open, triggerRef]);

  /* close on outside (click) click */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose, triggerRef]);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="How Localism works"
      className="animate-pop fixed z-50 w-80 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-300 shadow-2xl"
      style={{
        right: pos.right,
        top: pos.top,
        maxWidth: "calc(100vw - 1.5rem)",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <div className="flex items-start gap-2.5 pr-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <Lock
            aria-hidden="true"
            className="h-3.5 w-3.5 text-accent"
            strokeWidth={1.75}
          />
        </span>
        <div>
          <h2 className="text-xs font-semibold text-zinc-100">
            100% Offline · Local Processing
          </h2>
          <p className="mt-1.5 text-zinc-400">{children}</p>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="relative border-b border-rule bg-paper">
      <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#"
          aria-label="Localism home"
          className="group flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-ink"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-accent transition-transform duration-200 ease-out group-hover:scale-125"
          />
          localism
        </a>

        <button
          ref={badgeRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="hover-lift flex cursor-pointer items-center gap-2 rounded-full border border-rule bg-paper-2 px-3 py-1.5 transition-colors duration-200 ease-out hover:border-rule-2 hover:bg-panel-2"
        >
          <span
            aria-hidden="true"
            className="animate-glow relative flex h-2 w-2"
          >
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

      <OfflinePopover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={badgeRef}
      >
        {HOW_IT_WORKS}
      </OfflinePopover>
    </header>
  );
}
