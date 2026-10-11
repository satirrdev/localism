# Changelog

## v1.1.1 — October 11, 2026

This release focuses on UI polish, compact screen responsiveness, and watermark precision, ensuring repeated security stamps layout cleanly across ID documents without overlapping.

### Added
* **Launch Video Pipeline**: Added a Remotion-based programmatic composition pipeline and capture script for generating launch demos and showcase assets directly from code.

### Changed
* **Header Responsiveness**: Updated the site header layout so the wordmark and offline badge remain side-by-side on low-DPI and narrow screens, preventing unwanted line breaks or overlapping elements.
* **Header Status Badge**: Simplified the offline indicator badge by removing redundant iconography and glowing halos, keeping the status display unobtrusive.
* **Branding & Copy**: Cleaned up section subtitles, document metadata, and footer labels by removing repetitive "utility suite" phrasing in favor of direct, concise descriptions.
* **Dropzone Motion**: Removed idle floating animations from upload dropzones across all tool panels, creating a calmer, more utilitarian workspace.
* **Status Icons**: Replaced raw text symbols and emojis in the background removal tool with consistent vector icons.

### Fixed
* **Watermark Tiling**: Resolved an issue where tiled text watermarks stacked horizontally on top of each other without margins, producing solid smudged bars across ID cards and documents. Repeated watermarks now calculate layout bounds from measured text width with balanced horizontal padding and staggered rows.
* **FAQ Punctuation**: Fixed stray em dashes in the offline connectivity explanation for cleaner copy flow.

## v1.1.0 — October 9, 2026

This release hardens the offline toolkit: clearer and more accurate documentation, more resilient media processing, and a set of memory-leak and error-recovery fixes surfaced by an internal audit. Everything still runs entirely in your browser, and privacy claims now match reality.

### Added
* **Analytics**: Added Cloudflare Web Analytics for aggregate, cookie-free visit counts. No personal data, no cross-site tracking, no effect on files — which never leave your device.
* **PDF Merge Guard**: Added an aggregate 250 MB size check before a merge begins, so oversized batches fail with a clear message instead of exhausting browser memory.

### Changed
* **Security Headers**: Added `X-Content-Type-Options: nosniff` and a `no-referrer` policy via `<head>` metadata, reducing the risk of content-sniffing and referrer leakage on the static site.
* **PDF Redaction Wording**: Corrected the README to describe the tool as "merge and blackout" — a fail-closed full-page visual overlay — rather than implying true text-layer redaction.
* **Landing Page Privacy Copy**: Updated the value proposition to "No file uploads" and "0 File Uploads," matching how the tools actually process files locally.
* **PDF Tool Labeling**: Retitled the PDF tools section to "Merge and blackout PDFs," so the heading reflects the features that exist.

### Fixed
* **OCR (Rotation)**: Resolved an issue where rotating an image could re-run OCR with a stale rotation value, producing results for the wrong orientation. Rotation now applies immediately.
* **Image & PDF Tools (Errors)**: Fixed a case where an unexpected processing error left the progress indicator stuck and the tool unresponsive. Failed runs now reset cleanly and surface the error.
* **Video (Progress)**: Fixed progress listeners accumulating across multiple FFmpeg runs; listeners are now removed when a job finishes, preventing duplicated or drifting progress updates.
* **FFmpeg Loader**: Fixed a state where a single transient load failure would permanently break all future video jobs. The loader now recovers and can retry.
* **Background Removal**: Resolved a quality issue where transparency in the cutout was being flattened onto a backdrop, destroying the alpha channel.
* **Watermark**: Fixed a leaked staged preview URL that persisted after staging, removal, or leaving the panel.
* **Image Worker**: Fixed an `ImageBitmap` that was not released after processing, which held memory until the worker was torn down.
* **OCR Worker**: Fixed Tesseract result iterators not being destroyed, preventing memory buildup across repeated OCR runs.

### Removed
* **PDF Split & Sign Claims**: Retired the advertised "split" and "sign" capabilities from the PDF tool description, as they were never implemented. Use **Merge** and **Blackout** for these PDFs today.
