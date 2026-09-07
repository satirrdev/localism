/* pdf-worker.js, runs in a Web Worker, never on main thread */
importScripts("/pdf-lib.min.js");

const { PDFDocument, rgb } = PDFLib;

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

async function merge(buffers, names) {
  const merged = await PDFDocument.create();
  const total = buffers.length;

  for (let i = 0; i < total; i++) {
    post("progress", { value: Math.round((i / total) * 90), label: `Merging ${names[i]}…` });
    const src = await PDFDocument.load(buffers[i]);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  post("progress", { value: 95, label: "Saving…" });
  const bytes = await merged.save();
  post("progress", { value: 100, label: "Done" });
  return bytes;
}

async function redact(buffer) {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    post("progress", { value: Math.round((i / total) * 90), label: `Blacking out page ${i + 1}/${total}…` });
    const page = pages[i];
    const { width, height } = page.getSize();
    // Always opaque. A transparent fill would silently ship unchanged
    // content (fail-open redaction).
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0), opacity: 1 });
  }

  post("progress", { value: 95, label: "Saving…" });
  const bytes = await doc.save();
  post("progress", { value: 100, label: "Done" });
  return bytes;
}

self.onmessage = async (e) => {
  const { op, id } = e.data;
  try {
    let bytes;
    if (op === "merge") {
      bytes = await merge(e.data.buffers, e.data.names);
    } else if (op === "redact") {
      bytes = await redact(e.data.buffer);
    } else {
      throw new Error(`Unknown op: ${op}`);
    }
    post("done", { id, bytes });
  } catch (err) {
    post("error", { id, message: err?.message ?? String(err) });
  }
};
/* ponytail: full-page fill covers content but leaves it in the content stream;
 * true destructive redaction needs pdf.js rasterization — add when the
 * product requires un-recoverable removal rather than visual blackout. */
