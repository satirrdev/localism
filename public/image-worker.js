/* image-worker.js — OffscreenCanvas-based image processing in a Web Worker */

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

self.onmessage = async (e) => {
  const { type, id } = e.data;
  if (type !== "process") return;

  const { buffer, outputMime, quality, resize } = e.data;

  try {
    post("progress", { id, value: 10, label: "Decoding…" });
    const bitmap = await createImageBitmap(new Blob([buffer]));

    const origW = bitmap.width;
    const origH = bitmap.height;
    let targetW = origW;
    let targetH = origH;

    if (resize.mode === "scale") {
      const s = resize.percent / 100;
      targetW = Math.round(origW * s);
      targetH = Math.round(origH * s);
    } else if (resize.mode === "constraint") {
      const mw = resize.maxWidth || Infinity;
      const mh = resize.maxHeight || Infinity;
      if (mw < Infinity || mh < Infinity) {
        const ratio = Math.min(mw / origW, mh / origH, 1);
        targetW = Math.round(origW * ratio);
        targetH = Math.round(origH * ratio);
      }
    }

    post("progress", { id, value: 40, label: "Resizing…" });

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    post("progress", { id, value: 70, label: "Encoding…" });

    const blob = await canvas.convertToBlob({
      type: outputMime,
      quality: quality / 100,
    });

    post("progress", { id, value: 100, label: "Done" });
    post("done", { id, blob, width: targetW, height: targetH });
  } catch (err) {
    post("error", { id, message: err?.message || String(err) });
  }
};
