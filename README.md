# Localism

A privacy-first utility suite that runs entirely in your browser. No uploads, no servers, no accounts. Your files never leave your device.

## Tools

| Tool | What it does | Input |
|------|-------------|-------|
| **Image** | Compress, resize, and convert images via OffscreenCanvas in a Web Worker | PNG, JPG, WebP, GIF, AVIF |
| **PDF** | Merge, split, and sign PDFs with pdf-lib | PDF |
| **Video** | Compress, convert, and extract audio via FFmpeg WASM in a Web Worker | MP4, WebM, GIF, MP3 |
| **Hash** | SHA-256, SHA-1, SHA-512, MD5 checksums streamed in a Web Worker | Any file |
| **EXIF Scrubber** | Strip GPS, camera model, timestamps and all metadata via Canvas | JPG, PNG |

## Getting Started

```bash
# Clone
git clone https://github.com/satirrdev/localism.git
cd localism

# Install
npm install

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4** with custom OKLCH design tokens
- **TypeScript 5**
- **Web Workers** for off-main-thread processing
- **FFmpeg WASM** for video
- **pdf-lib** for PDF manipulation
- **Lucide React** for icons

## How It Works

Every tool runs client-side. Files are read from your filesystem into browser memory, processed with Web Workers or WASM modules, and returned as downloadable blobs. Nothing is transmitted over the network.

```
Your file → Browser memory → Web Worker / WASM → Processed file → Download
```

## Project Structure

```
src/
  app/
    page.tsx              # Main page — tool tabs + panels
  components/
    site-header.tsx       # Top bar with offline badge
    tool-tabs.tsx         # Tab bar with keyboard navigation
    image-panel.tsx       # Image compress/convert
    pdf-panel.tsx         # PDF merge/split/sign
    video-panel.tsx       # Video compress/convert (FFmpeg WASM)
    hash-panel.tsx        # File hashing (SHA + MD5)
    exif-scrubber.tsx     # EXIF metadata stripping
    file-dropzone.tsx     # Shared drag-and-drop component
    value-proposition.tsx # Why Localism section
    reveal.tsx            # IntersectionObserver fade-in
public/
  ffmpeg/                 # FFmpeg WASM core
  *.worker.js             # Web Worker scripts
```

## Privacy

- Zero network requests for file processing
- No analytics, no tracking
- No accounts or authentication
- Works fully offline
- Inspect your browser's Network tab — you'll see nothing

## License

MIT
