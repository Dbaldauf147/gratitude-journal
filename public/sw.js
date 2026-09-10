/* Gratitude Journal service worker.
 *
 * Hand-written rather than generated: the 273MB of meditation audio in
 * /meditations needs a caching policy no off-the-shelf preset gets right, and
 * the auth flow needs certain requests to never be cached at all.
 *
 * Versioned by the ?v= on the registration URL (see ServiceWorkerRegistrar),
 * so every deploy installs a fresh worker and drops the previous caches.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
// Audio is deliberately NOT version-scoped. The files are immutable and
// expensive to fetch; re-downloading 2MB per meditation on every deploy is the
// exact thing this cache exists to prevent.
const AUDIO_CACHE = "meditation-audio";

// How many meditation tracks to keep offline. ~2.3MB each, so 20 is ~46MB —
// enough for the ones actually in rotation without eating the device.
const AUDIO_CACHE_LIMIT = 20;

// Enough to boot the app with no network. Everything else fills in as it's used.
const SHELL_URLS = ["/dashboard", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one failure (a redirect to /login, say) can't abort
      // the whole install.
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== AUDIO_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const isAudio = (url) => url.pathname.startsWith("/meditations/") && url.pathname.endsWith(".mp3");
const isImmutableAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/splash/") ||
  url.pathname.startsWith("/fonts/");

/* Trim the audio cache back to the limit, oldest first. Cache.keys() returns
 * insertion order, so this is FIFO — good enough, and it avoids the bookkeeping
 * a true LRU would need. */
async function trimAudioCache() {
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - AUDIO_CACHE_LIMIT))) {
    await cache.delete(key);
  }
}

/* Safari requests media with a Range header, and the Cache API refuses to store
 * the resulting 206. So: always fetch and store the FULL file, then slice the
 * requested range out of it ourselves. Without this, meditation audio would
 * never cache on iOS — which is the only platform that matters here. */
async function handleAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const range = request.headers.get("range");
  // Strip the Range header so we always fetch and cache the whole file.
  const fullRequest = new Request(request.url, { credentials: "same-origin" });

  let response = await cache.match(fullRequest);
  if (!response) {
    response = await fetch(fullRequest);
    if (response.ok) {
      await cache.put(fullRequest, response.clone());
      // Don't make playback wait on eviction.
      trimAudioCache();
    }
  }

  if (!range || !response.ok) return response;

  const buffer = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(buffer, { status: 200, headers: response.headers });

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : buffer.byteLength - 1;
  if (start >= buffer.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${buffer.byteLength}` },
    });
  }

  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/* Navigations go to the network first so a deploy is picked up on the next
 * refresh and so middleware can still redirect an expired session to /login.
 * The cache is only a fallback for when there's genuinely no network. */
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/dashboard")) ||
      (await cache.match("/offline")) ||
      Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Anything that isn't ours — Supabase in particular — is left completely
  // alone. Caching an auth or Postgrest response would serve stale or
  // cross-account data, which is far worse than a slow load.
  if (url.origin !== self.location.origin) return;

  // Server routes are live by definition; /api/version is what drives the
  // update pill and must never come from a cache.
  if (url.pathname.startsWith("/api/")) return;

  if (isAudio(url)) {
    event.respondWith(handleAudio(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
  }
});
