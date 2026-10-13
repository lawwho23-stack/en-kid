import { afterEach, describe, expect, it, vi } from "vitest";

async function loadManifestModule(fetcher: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.stubGlobal("fetch", fetcher);
  return import("./manifest");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio manifest freshness", () => {
  it("fetches with no-store so deploys are never hidden by HTTP cache", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ version: 1, clips: {} }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const mod = await loadManifestModule(fetcher);

    await mod.loadManifest();

    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init?.cache).toBe("no-store");
  });

  it("reloads on demand even when a copy is cached", async () => {
    let version = 1;
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ version: version, clips: {} }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const mod = await loadManifestModule(fetcher);

    const first = await mod.loadManifest();
    version = 2;
    const second = await mod.loadManifest();
    // Still cached without reload.
    expect(second.version).toBe(1);
    expect(first.version).toBe(1);

    const fresh = await mod.reloadManifest();
    expect(fresh.version).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good manifest when a reload fails", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error("offline");
      return new Response(
        JSON.stringify({ version: 3, clips: { "word:cat": "/audio/a.mp3" } }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const mod = await loadManifestModule(fetcher);

    const first = await mod.loadManifest();
    fail = true;
    const kept = await mod.reloadManifest();

    expect(kept).toEqual(first);
    expect(kept.version).toBe(3);
  });
});
