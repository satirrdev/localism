import { Lock } from "lucide-react";

export function SiteHeader() {
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

        <div
          role="status"
          aria-label="Processing status: fully offline and local"
          className="flex items-center gap-2 rounded-full border border-rule bg-paper-2 px-3 py-1.5"
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
        </div>
      </div>
    </header>
  );
}
