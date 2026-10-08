// Bump this version on each deploy to force returning visitors to flush the
// old cache and pick up the new aria-trial widget + kb-index. The fetch
// strategy is network-first, so cache only matters when offline.
//
// RUN-CU 2026-10-08 (site audit, Top-10 #10): the precache list is trimmed to paths that exist and
// are served as-is. Removed from PRECACHE (the pages themselves are untouched — they are simply
// cached on first visit instead of pre-fetched for everyone):
//   /docs/api                      force-404 in netlify.toml (never resolved)
//   /compare/aria-vs-msp-x/        301 → /compare/ (killed page)
//   /analytics.html                301 → /aperture-learning.html
//   /tenant-admin.html, /white-label-admin.html, /cost-dashboard.html, /write-gate-history.html
//                                  operator/admin shells (noindex) — no reason to pre-fetch for visitors
//   /  and  /aria.html             320 KB + 504 KB on every first visit; both are cached at runtime
//                                  by the fetch handler the first time they are actually opened
// Also: cache.put is now guarded with res.ok so a 404/500 body never replaces a good cached copy.
const CACHE_NAME = "iisupport-v13";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/assets/finish100.css",
  "/assets/finish100-pages.js",
  "/assets/xo-elite-theme.css",
  "/assets/aria-core.css",
  "/about.html",
  "/purchase-tech.html",
  "/account.html",
  "/status-history.html",
  "/screenshare-consent.html",
  "/partner-application-checker.html",
  "/platform-readiness.html",
  "/compare/",
  "/compare/aria-vs-retell/",
  "/compare/aria-vs-vapi/",
  "/compare/compare.css",
  "/iso-27001-readiness.html",
  "/pipeda-readiness.html"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (!event || !event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/.netlify/")) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only a good, basic (same-origin, non-opaque) response is worth keeping: a 404 or 500
        // page must never overwrite a previously cached working copy.
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/offline.html") || caches.match("/")))
  );
});
