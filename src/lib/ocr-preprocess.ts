/* ocr-preprocess.ts — pure Canvas 2D preprocessing pipeline for OCR.
 *
 * Turns a decoded bitmap into clean grayscale/thresholded ImageData that the
 * OCR worker feeds straight into Tesseract. No DOM at module scope (the panel
 * is SSR'd), and everything stays on the main thread — decode itself happens
 * off-main via createImageBitmap in the panel.
 *
 * Convention: RGB channels all hold the same gray value 0..255, inverted so
 * ink = black on white. The worker reads channel 0 only, never alpha.
 */

export interface OcrPreprocessOptions {
  /** Degrees clockwise, one of 0 / 90 / 180 / 270. */
  rotate?: number;
  /** Longest allowed edge px (downscale only, never up). */
  maxSide?: number;
}

export interface OcrImageDataResult {
  imageData: ImageData;
  width: number;
  height: number;
}

/** A decodable source that exposes its intrinsic dimensions. */
type OcrSource = CanvasImageSource & { width: number; height: number };

function drawToCanvas(source: OcrSource, rotate: number, maxSide: number): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;

  const rotated = rotate % 360 === 90 || rotate % 360 === 270;
  const dw = rotated ? sh : sw;
  const dh = rotated ? sw : sh;

  const scale = Math.min(1, maxSide / Math.max(dw, dh));
  const width = Math.max(1, Math.round(dw * scale));
  const height = Math.max(1, Math.round(dh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);

  return canvas;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function otsuThreshold(hist: number[]): number {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const varBetween = wB * wF * (meanB - meanF) * (meanB - meanF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

export function toOcrImageData(
  source: OcrSource,
  opts: OcrPreprocessOptions = {},
): OcrImageDataResult {
  const maxSide = opts.maxSide ?? 1800;
  const rotate = Math.round(opts.rotate ?? 0) % 360;

  const canvas = drawToCanvas(source, rotate, maxSide);
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const raw = ctx.getImageData(0, 0, width, height);
  const px = raw.data;
  const n = width * height;

  // --- grayscale + histogram ------------------------------------------------
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const g = Math.round(luma(px[o], px[o + 1], px[o + 2]));
    px[o] = px[o + 1] = px[o + 2] = g;
    hist[g]++;
  }

  // --- white balance: stretch the 1st..99th percentile to fill 0..255 -------
  const cum = new Array<number>(256).fill(0);
  for (let i = 1; i < 256; i++) cum[i] = cum[i - 1] + hist[i];
  const loLimit = Math.max(1, Math.floor(n * 0.01));
  const hiLimit = Math.min(n - 1, Math.ceil(n * 0.99));
  let lo = 0;
  let hi = 255;
  while (lo < 255 && cum[lo] < loLimit) lo++;
  while (hi > 0 && cum[hi] > hiLimit) hi--;
  const range = hi - lo || 1;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const g = px[o];
    const stretched = Math.round(((g - lo) * 255) / range);
    px[o] = px[o + 1] = px[o + 2] = stretched;
    hist[stretched]++;
  }

  // --- binarize with Otsu ----------------------------------------------------
  const th = otsuThreshold(hist);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = px[o] >= th ? 255 : 0;
    px[o] = px[o + 1] = px[o + 2] = v;
    px[o + 3] = 255;
  }

  return { imageData: raw, width, height };
}