// Bump this version on each deploy to force returning visitors to flush the
// old cache and pick up the new aria-trial widget + kb-index. The fetch
// strategy is network-first, so cache only matters when offline.
const CACHE_NAME = "iisupport-v7";
const PRECACHE = [
  "/",
  "/aria.html",
  "/about.html",
  "/purchase-tech.html",
  "/account.html",
  "/analytics.html",
  "/tenant-admin.html",
  "/status-history.html",
  "/white-label-admin.html",
  "/screenshare-consent.html",
  "/partner-application-checker.html",
  "/platform-readiness.html",
  "/write-gate-history.html",
  "/iso-27001-readiness.html",
  "/pipeda-readiness.html",
  "/cost-dashboard.html",
  "/offline.html",
  "/assets/finish100.css",
  "/assets/finish100-pages.js",
  "/manifest.webmanifest",
  "/favicon.svg"
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

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/offline.html") || caches.match("/")))
  );
});
