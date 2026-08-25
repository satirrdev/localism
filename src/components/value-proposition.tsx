"use client";

import { ShieldCheck, Zap, Infinity } from "lucide-react";
import { Reveal } from "@/components/reveal";

export function ValueProposition() {
  return (
    <section className="mx-auto w-full max-w-[72rem] px-4 sm:px-6">
      <Reveal>
        <div className="mt-16 sm:mt-24">
          <div className="mb-8 sm:mb-10">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
              Zero Cloud Dependency
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-4xl">
              Compute locally. Rely on no one.
            </h2>
            <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted sm:text-base">
              Cloud tools hold your files hostage and charge you for their
              server costs. Localism turns your own browser into a
              high-performance engine&nbsp;\u2014 completely offline, private, and
              unlimited.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-5 sm:gap-4">
            <div className="flex flex-col justify-between gap-6 rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2 sm:col-span-3 sm:p-8">
              <div>
                <p className="mb-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-neutral">
                  01
                </p>
                <h3 className="text-lg font-medium tracking-tight text-ink sm:text-xl">
                  <ShieldCheck
                    className="mr-1.5 inline-block align-[-0.15em] text-accent"
                    strokeWidth={1.8}
                  />
                  Your files never leave your hands.
                </h3>
                <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
                  No data transfers, no remote storage, no tracking pixels.
                  Everything executes in your browser&rsquo;s memory and
                  vanishes when you close the tab.
                </p>
              </div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-neutral">
                Inspect Network Tab&nbsp;:&nbsp;0 Requests
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:col-span-2 sm:gap-4">
              <div className="flex flex-col justify-between rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2 sm:flex-1 sm:p-6">
                <div>
                  <p className="mb-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-neutral">
                    02
                  </p>
                  <h3 className="text-base font-medium tracking-tight text-ink sm:text-lg">
                    <Zap
                      className="mr-1.5 inline-block align-[-0.15em] text-accent"
                      strokeWidth={1.8}
                    />
                    Zero upload, zero wait.
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Why upload a 1GB video just to trim 5 seconds? Process at
                    raw RAM and SSD speed.
                  </p>
                </div>
                <p className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-neutral">
                  Client-Side WASM Engine
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-rule bg-panel/40 p-6 transition-colors duration-200 hover:border-rule-2 sm:flex-1 sm:p-6">
                <div>
                  <p className="mb-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-neutral">
                    03
                  </p>
                  <h3 className="text-base font-medium tracking-tight text-ink sm:text-lg">
                    <Infinity
                      className="mr-1.5 inline-block align-[-0.15em] text-accent"
                      strokeWidth={1.8}
                    />
                    No paywalls on your own compute.
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Cloud SaaS charges subscriptions because they pay for
                    servers. Your device does the work&nbsp;\u2014 Localism is
                    free.
                  </p>
                </div>
                <p className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-neutral">
                  Works in Airplane Mode
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 font-mono text-xs text-neutral">
            Verified open source &amp; auditable on{" "}
            <a
              href="https://github.com/satirrdev/localism"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-rule-2 underline-offset-2 transition-colors hover:text-ink"
            >
              GitHub
            </a>
            . Read the code yourself.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
