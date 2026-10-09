/* ffmpeg.ts — lazy singleton loader for @ffmpeg/ffmpeg v0.12.
 *
 * Keeps all binary cores same-origin and offline-first: wasm and ESM glue are
 * fetched under the deployment basePath and cached via the Cache Storage API
 * (`localism-ffmpeg-v1`) so repeat visits work 100% offline in Airplane Mode.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { publicUrl } from "./paths";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const FFMPEG_CACHE = "localism-ffmpeg-v1";

/**
 * Fetch asset with Cache Storage fallback so subsequent visits work 100% offline.
 * Converts response buffer into a local blob URL required by @ffmpeg/ffmpeg.
 */
async function toBlobURLWithCache(
  url: string,
  mimeType: string,
): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(FFMPEG_CACHE);
      const match = await cache.match(url);
      if (match) {
        buffer = await match.arrayBuffer();
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
        await cache.put(url, res.clone());
        buffer = await res.arrayBuffer();
      }
    } catch {
      const res = await fetch(url);
      buffer = await res.arrayBuffer();
    }
  } else {
    const res = await fetch(url);
    buffer = await res.arrayBuffer();
  }

  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = window.location.origin + publicUrl("/ffmpeg");

    ffmpeg.on("log", ({ message }) => {
      if (typeof console !== "undefined") console.debug("[ffmpeg]", message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURLWithCache(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript",
      ),
      wasmURL: await toBlobURLWithCache(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })().catch((err) => {
    loadingPromise = null;
    throw err;
  });

  return loadingPromise;
}

export function terminateFFmpeg(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  loadingPromise = null;
}
