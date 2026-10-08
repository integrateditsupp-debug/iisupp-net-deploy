// Edge function: GET /api/portal-check — is the Service Center portal actually answering?
//
// RUN-CU 2026-10-08. The homepage and m.html "Service Center" tiles open an iframe to the
// abacusai portal. That host has answered 404 on every panel (verified 2026-10-08), so every tile
// opened a blank modal. A browser cannot read the portal's HTTP status itself (the host sends no
// CORS headers, and a no-cors fetch returns an opaque 200 even for a 404), so this edge function
// does the read server-side and reports it honestly: { ok, status, ms }. The pages fall back to the
// on-site path (ARIA / contact form / purchase-tech) when ok is false, and keep using the iframe
// when it is true — reviving the portal needs no page change.
//
// Read-only. Never sends anything to the portal beyond one GET of its root. Cached for 60 s at the
// edge so a burst of clicks is one upstream request.

import type { Config } from 'https://edge.netlify.com';

const PORTAL_URL = 'https://ii-support-portal-wd05qh.abacusai.app/';
const TIMEOUT_MS = 3000;

export default async (request: Request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ ok: false, error: 'GET only' }, 405);
  }
  const t0 = Date.now();
  let ok = false;
  let status = 0;
  let error: string | null = null;
  try {
    const r = await fetch(PORTAL_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'iisupp-portal-check/1 (+https://iisupp.net)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = r.status;
    ok = r.ok; // 2xx only — a 404 host is "not answering" for our purposes
    try { await r.body?.cancel(); } catch { /* body already consumed or absent */ }
  } catch (e) {
    error = String((e as Error)?.message || e).slice(0, 160);
  }
  return json({
    ok,
    status,
    ms: Date.now() - t0,
    error,
    portal: PORTAL_URL,
    checked_at: new Date().toISOString(),
  }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short edge cache: repeated tile clicks reuse one upstream probe.
      'cache-control': 'public, max-age=60',
      'x-content-type-options': 'nosniff',
    },
  });
}

export const config: Config = {
  path: '/api/portal-check',
};
