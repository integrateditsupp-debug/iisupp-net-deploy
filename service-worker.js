/*!
 * service-worker.js — IIS PWA cache-first for static + offline shell
 *  Cache key bumped per release. Runtime cache for /aria + /scorecard + /plans + /assets/*.
 *  Cat 11 — Mobile + responsive.
 */
const CACHE_VERSION = 'iis-cache-v1.20260618b';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const STATIC_ASSETS = [
  '/',
  '/aria',
  '/plans',
  '/scorecard',
  '/health-check',
  '/status',
  '/docs/api',
  '/cost-calculator',
  '/compliance-gap',
  '/verticals/',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache: Netlify functions, Stripe, Anthropic API, analytics
  if (url.pathname.startsWith('/.netlify/') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('anthropic.com') ||
      url.hostname.includes('resend.com')) {
    return; // network-only
  }

  // Stale-while-revalidate for assets
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const fetched = fetch(req).then((resp) => {
            if (resp.ok) cache.put(req, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // Cache-first for HTML pages
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
          }
          return resp;
        }).catch(() => caches.match('/'));
      })
    );
  }
});
