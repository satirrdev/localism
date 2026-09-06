"use client";

import {
  ShieldCheck,
  Zap,
  Infinity,
  Code2,
  ExternalLink,
} from "lucide-react";
import { Reveal } from "@/components/reveal";

export function ValueProposition() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <Reveal>
        <div className="pt-16 sm:pt-24">
          <div className="mb-8 sm:mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-neutral">
              Zero Cloud Dependency
            </p>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-ink sm:text-2xl">
              Compute locally. Rely on no one.
            </h2>
            <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted sm:text-base">
              Cloud tools hold your files hostage and charge you for their
              server costs. Localism turns your own browser into a
              high-performance engine, completely offline, private, and
              unlimited.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="hover-lift flex flex-col justify-between gap-6 rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2">
              <div>
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-paper-3">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-muted"
                    strokeWidth={1.75}
                  />
                </span>
                <h3 className="text-base font-medium tracking-tight text-ink">
                  Sandboxed in your browser.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  No data transfers, no remote storage, no tracking pixels.
                  Everything executes in your browser&rsquo;s memory and
                  vanishes when you close the tab.
                </p>
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-neutral">
                Inspect Network Tab&nbsp;:&nbsp;0 Requests
              </p>
            </div>

            <div className="hover-lift flex flex-col justify-between gap-6 rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2">
              <div>
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-paper-3">
                  <Zap
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-muted"
                    strokeWidth={1.75}
                  />
                </span>
                <h3 className="text-base font-medium tracking-tight text-ink">
                  Zero upload, zero wait.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Why upload a 1GB video just to trim 5 seconds? Process at raw
                  RAM and SSD speed, on-device, in a Web Worker.
                </p>
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-neutral">
                Client-Side WASM Engine
              </p>
            </div>

            <div className="hover-lift flex flex-col justify-between gap-6 rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2">
              <div>
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-paper-3">
                  <Infinity
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-muted"
                    strokeWidth={1.75}
                  />
                </span>
                <h3 className="text-base font-medium tracking-tight text-ink">
                  No paywalls on your own compute.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Cloud SaaS charges subscriptions because they pay for
                  servers. Your device does the work, Localism is free.
                </p>
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-neutral">
                Works in Airplane Mode
              </p>
            </div>
          </div>

          <div className="mt-6">
            <a
              href="https://github.com/satirrdev/localism"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-full border border-rule bg-paper-2 py-2 pl-3 pr-4 transition-colors duration-200 ease-out hover:border-rule-2 hover:bg-panel-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10">
                <Code2
                  aria-hidden="true"
                  className="h-4 w-4 text-accent"
                  strokeWidth={1.75}
                />
              </span>
              <span className="font-mono text-xs font-medium text-ink-2">
                Verified open source &amp; auditable
              </span>
              <ExternalLink
                aria-hidden="true"
                className="h-3.5 w-3.5 text-muted transition-colors duration-200 group-hover:text-accent"
                strokeWidth={1.75}
              />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}