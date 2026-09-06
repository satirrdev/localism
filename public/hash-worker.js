/* hash-worker.js, streaming chunked file hashing in a Web Worker.
 * SHA-256/1/512 via js-sha* (incremental), MD5 via SparkMD5 (incremental).
 * Reads the File in 8 MB slices so even 10 GB+ files never blow up memory. */

importScripts(
  "/spark-md5.min.js",
  "/js-sha256.min.js",
  "/js-sha1.min.js",
  "/js-sha512.min.js",
);

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
const PROGRESS_INTERVAL_MS = 100;

let abortedId = null;

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

async function hashFile(id, file) {
  const total = file.size;
  const spark = new SparkMD5.ArrayBuffer();
  const h256 = sha256.create();
  const h1 = sha1.create();
  const h512 = sha512.create();

  const start = performance.now();
  let processed = 0;
  let lastPost = 0;

  while (processed < total) {
    if (abortedId === id) {
      abortedId = null;
      post("cancelled", { id });
      return;
    }

    const end = Math.min(processed + CHUNK_SIZE, total);
    const buf = await file.slice(processed, end).arrayBuffer();

    spark.append(buf);
    h256.update(buf);
    h1.update(buf);
    h512.update(buf);
    processed += buf.byteLength;

    const now = performance.now();
    if (now - lastPost >= PROGRESS_INTERVAL_MS || processed >= total) {
      lastPost = now;
      const secs = (now - start) / 1000;
      post("progress", {
        id,
        bytesProcessed: processed,
        totalBytes: total,
        percentage: total > 0 ? (processed / total) * 100 : 100,
        speedMBps: secs > 0 ? processed / 1048576 / secs : 0,
      });
    }
  }

  post("done", {
    id,
    elapsedMs: performance.now() - start,
    hashes: {
      sha256: h256.hex(),
      sha1: h1.hex(),
      sha512: h512.hex(),
      md5: spark.end(),
    },
  });
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "hash") {
    hashFile(msg.id, msg.file).catch((err) =>
      post("error", { id: msg.id, message: err?.message || String(err) }),
    );
  } else if (msg.type === "abort") {
    abortedId = msg.id;
  }
};
