/* paths.ts — basePath-aware public asset URLs.
 *
 * The app is published to GitHub Pages as a project site, so every public
 * asset (workers, WASM cores, traineddata, models) lives under a sub-path.
 * Next inlines NEXT_PUBLIC_BASE_PATH at build time, which keeps local
 * development at the site root while CI builds for /localism.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative public path with the deployment base path. */
export function publicUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
