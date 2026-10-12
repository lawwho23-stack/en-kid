export type Manifest = {
  version: number;
  clips: Record<string, string>;
};

let cached: Manifest | null = null;

/** Audio manifest: text id -> static file URL. Missing ids use synth. */
export async function loadManifest(): Promise<Manifest> {
  if (cached) return cached;
  try {
    const res = await fetch("/audio/audio-manifest.json", { cache: "force-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    cached = (await res.json()) as Manifest;
  } catch {
    cached = { version: 0, clips: {} };
  }
  return cached;
}

export function clipUrl(manifest: Manifest, clipId: string): string | null {
  return manifest.clips[clipId] ?? null;
}
