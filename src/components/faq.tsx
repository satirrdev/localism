"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/reveal";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I know my files never leave my device?",
    a: "Every tool runs in a Web Worker or WASM thread inside your browser. Files are streamed into memory, transformed, and returned as a download. Open DevTools \u2192 Network tab while processing and you\u2019ll see zero upload requests.",
  },
  {
    q: "What happens to my files after I finish?",
    a: "Nothing is stored. Results exist only as in-memory blobs until you download them, and closing the tab wipes everything. There is no server, no database, and no cloud storage to hold anything.",
  },
  {
    q: "Is there any tracking or analytics?",
    a: "None. No analytics scripts, no cookies, no fingerprinting. The page ships static code and operates fully offline \u2014 it even works in airplane mode once loaded and the WASM assets are cached.",
  },
  {
    q: "Which tools run in the browser?",
    a: "Everything. Image processing (Canvas), video (FFmpeg WASM), PDF (pdf-lib), hashing (Web Crypto), watermarking and EXIF scrubbing, and background removal (ONNX WASM). No backend exists.",
  },
  {
    q: "Can I use Localism without an internet connection?",
    a: "After the page has loaded and the FFmpeg/ONNX cores are cached, the entire suite works offline. No account, no install, no upload \u2014 just your browser.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <Reveal>
        <div className="pt-16 sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-neutral">
            Client-Side Integrity
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-ink sm:text-2xl">
            Frequently asked questions
          </h2>

          <div className="mt-6 divide-y divide-rule">
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className="py-4">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-trigger-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-sm font-medium text-ink transition-colors duration-200 ease-out hover:text-ink-2"
                  >
                    {item.q}
                    <ChevronDown
                      aria-hidden="true"
                      className={[
                        "h-4 w-4 shrink-0 text-neutral transition-transform duration-200 ease-out",
                        isOpen ? "rotate-180" : "",
                      ].join(" ")}
                      strokeWidth={1.75}
                    />
                  </button>
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    className={[
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      isOpen
                        ? "[grid-template-rows:1fr]"
                        : "[grid-template-rows:0fr]",
                    ].join(" ")}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <p className="pt-2 text-sm leading-relaxed text-muted">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}