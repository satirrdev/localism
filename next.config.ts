import type { NextConfig } from "next";

/* GitHub Pages serves the app from a project sub-path (/localism). CI sets
   NEXT_PUBLIC_BASE_PATH so client-side asset URLs resolve under that prefix;
   locally it is empty, which keeps dev at the site root. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // GitHub Pages is static hosting: emit a plain `out/` directory.
  output: "export",
  basePath,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
