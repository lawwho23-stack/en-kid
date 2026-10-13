import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchEvent = {
  request: Request;
  respondWith(response: Promise<Response>): void;
};

function loadFetchHandler(options: {
  cached: Response | undefined;
  shellCached?: Response;
  network: () => Promise<Response>;
}) {
  const handlers = new Map<string, (event: FetchEvent) => void>();
  const shellCache = {
    match: vi.fn(async () => options.shellCached ?? options.cached),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
  };
  const mediaCache = {
    match: vi.fn(async () => options.cached),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
  };
  const opened: string[] = [];
  const network = vi.fn(options.network);

  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Promise,
    fetch: network,
    caches: {
      open: async (name: string) => {
        opened.push(name);
        return name.includes("shell") ? shellCache : mediaCache;
      },
      keys: async () => [],
      delete: async () => true,
      match: async () => options.shellCached ?? options.cached,
    },
    self: {
      location: { origin: "https://en-kid.test" },
      addEventListener(name: string, handler: (event: FetchEvent) => void) {
        handlers.set(name, handler);
      },
      skipWaiting() {},
      clients: { claim() {} },
    },
  });

  return {
    handler: handlers.get("fetch")!,
    network,
    opened,
    shellCache,
    mediaCache,
  };
}

async function requestManifest(
  handler: (event: FetchEvent) => void,
): Promise<Response> {
  let response: Promise<Response> | undefined;
  handler({
    request: new Request(
      "https://en-kid.test/audio/audio-manifest.json",
    ),
    respondWith(value) {
      response = value;
    },
  });
  return response!;
}

describe("audio service worker", () => {
  it("refreshes the manifest from the network before using its cache", async () => {
    const worker = loadFetchHandler({
      cached: new Response("cached"),
      network: async () => new Response("network"),
    });

    const response = await requestManifest(worker.handler);

    expect(await response.text()).toBe("network");
    expect(worker.network).toHaveBeenCalledOnce();
  });

  it("uses the cached manifest when the network is unavailable", async () => {
    const worker = loadFetchHandler({
      cached: new Response("cached"),
      network: async () => {
        throw new Error("offline");
      },
    });

    const response = await requestManifest(worker.handler);

    expect(await response.text()).toBe("cached");
    expect(worker.network).toHaveBeenCalledOnce();
  });

  it("finds the install-time manifest in the shell cache when offline", async () => {
    const worker = loadFetchHandler({
      cached: undefined,
      shellCached: new Response("installed"),
      network: async () => {
        throw new Error("offline");
      },
    });

    const response = await requestManifest(worker.handler);

    expect(await response.text()).toBe("installed");
  });

  it("stores the fresh manifest in the shell cache and drops the media orphan", async () => {
    const worker = loadFetchHandler({
      cached: new Response("stale-media"),
      shellCached: new Response("stale-shell"),
      network: async () => new Response("network"),
    });

    const response = await requestManifest(worker.handler);

    expect(await response.text()).toBe("network");
    expect(worker.opened[0]).toContain("shell");
    expect(worker.shellCache.put).toHaveBeenCalledOnce();
    expect(worker.mediaCache.delete).toHaveBeenCalledOnce();
  });
});
