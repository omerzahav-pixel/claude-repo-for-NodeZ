/* =============================================================================
 * NodeZ v2 · service worker.
 *
 * Strategy: stale-while-revalidate for same-origin shell assets (HTML / CSS /
 * JS / icons), network-first (with cache fallback) for the HTML entry so a
 * deploy is visible on first reload. Cross-origin font + KaTeX CDN requests
 * are cache-first (they're content-addressed, so they don't drift).
 *
 * Cache naming: bump VERSION on every deploy. Old caches are swept in
 * `activate`. We call skipWaiting() + clients.claim() so a new SW takes
 * control without a refresh cycle — iOS Safari is especially picky about
 * this, a lingering old SW can leave users on the old bundle indefinitely.
 *
 * NodeZ data (IndexedDB `ideaVault`, localStorage) is NOT managed here —
 * the app reads/writes it directly via ws_d2.js / app.js. The SW only
 * caches static shell assets.
 * ============================================================================= */

const VERSION = "nodez-v2.phase2.1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const CDN = `${VERSION}-cdn`;

// Shell assets to pre-cache. Relative paths so they work whether we're
// served from `/` or `/some/subpath/` (e.g. Cloudflare Pages preview URLs).
// NOTE: `/app.js` lives in /public at dev time and root of dist after build.
const SHELL_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Best-effort: individual failures must not abort install (e.g. in dev
    // the Vite-served app.css is a hashed asset, not at ./app.css).
    await Promise.all(SHELL_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) await cache.put(url, res);
      } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => !k.startsWith(VERSION))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isNavigationRequest(req) {
  return req.mode === "navigate" || (req.method === "GET" && req.headers.get("accept")?.includes("text/html"));
}

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

function isCdnFontOrKatex(url) {
  const u = new URL(url);
  return u.hostname === "fonts.googleapis.com"
      || u.hostname === "fonts.gstatic.com"
      || u.hostname === "cdn.jsdelivr.net";
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback to the cached index.html for SPA navigations so the app can
    // still boot offline and read its IndexedDB copy of workspaces.
    const shell = await caches.open(SHELL);
    const indexCached = await shell.match("./index.html");
    if (indexCached) return indexCached;
    throw new Error("offline and no cached response");
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only GET. POST/PUT must go to network.
  if (req.method !== "GET") return;
  const url = req.url;
  // Skip SW traffic the browser generates for uncommon schemes.
  if (!url.startsWith("http")) return;
  if (isNavigationRequest(req)) {
    event.respondWith(networkFirst(req, RUNTIME));
    return;
  }
  if (isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
    return;
  }
  if (isCdnFontOrKatex(url)) {
    event.respondWith(cacheFirst(req, CDN));
    return;
  }
  // Other cross-origin: network only.
});

// Allow the app to force an SW upgrade via postMessage — used by the
// "Update available" flow if we add one later.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
