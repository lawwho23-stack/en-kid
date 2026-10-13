/* Minimal service worker: cache the shell + audio/art for offline play. */
const SHELL = "kids-english-shell-v5";
const MEDIA = "kids-english-media-v5";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      cache.addAll(["/select", "/audio/audio-manifest.json", "/manifest.webmanifest"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL && k !== MEDIA)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The manifest changes when clips are added. Refresh it first so an old
  // service-worker cache cannot keep pointing a new release at stale URLs.
  // Single-source: the manifest lives only in SHELL. Older installs may
  // still have a copy in MEDIA, so a fresh fetch deletes that orphan.
  if (url.pathname === "/audio/audio-manifest.json") {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            void cache.put(request, res.clone());
            void caches.open(MEDIA).then((media) => media.delete(request));
          }
          return res;
        } catch (error) {
          const hit =
            (await cache.match(request)) ?? (await caches.match(request));
          if (hit) return hit;
          throw error;
        }
      }),
    );
    return;
  }

  // Media + static: cache-first so play works offline after first load.
  // /api/audio/* responses are immutable (content-hashed ids), safe to cache.
  if (
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/api/audio/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) void cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: network-first, fall back to cache.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
