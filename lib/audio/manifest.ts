export type Manifest = {
  version: number;
  clips: Record<string, string>;
};

let cached: Manifest | null = null;

/**
 * Audio manifest: text id -> static file URL. Missing ids use synth.
 * Uses `no-store` so a new deploy is never hidden by the HTTP cache:
 * the service worker is network-first for this file and `next.config`
 * sends `max-age=0, must-revalidate`. Pass `{ reload: true }` to force
 * a re-fetch after a version bump (long-lived PWA session).
 */
export async function loadManifest(opts?: { reload?: boolean }): Promise<Manifest> {
  if (cached && !opts?.reload) return cached;
  try {
    const res = await fetch("/audio/audio-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    cached = (await res.json()) as Manifest;
  } catch {
    // Keep the last good manifest if we already have one; otherwise synth fallback.
    if (!cached) cached = { version: 0, clips: {} };
  }
  return cached;
}

/** Force a manifest re-fetch (e.g. after a deploy). Returns the fresh copy. */
export async function reloadManifest(): Promise<Manifest> {
  return loadManifest({ reload: true });
}

/** Test-only: clear the module manifest cache. */
export function __resetManifestCache(): void {
  cached = null;
}

export function clipUrl(manifest: Manifest, clipId: string): string | null {
  return manifest.clips[clipId] ?? null;
}
