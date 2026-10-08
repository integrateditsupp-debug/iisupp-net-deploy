// lib/cors.cjs — origin allow-list for functions whose responses are sensitive.
//
// Audit §4: 76 functions answer with `Access-Control-Allow-Origin: *`; that is harmless on token-gated
// admin endpoints but harmful where the body is customer data. This helper echoes the request Origin only
// when it is the production site, www, or the current Netlify deploy/preview URL — otherwise it falls back
// to https://iisupp.net (so a cross-origin page cannot read the response).
'use strict';

const PROD = 'https://iisupp.net';

function allowedOrigins() {
  const set = new Set([PROD, 'https://www.iisupp.net']);
  for (const name of ['URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'SITE_BASE_URL', 'APP_URL']) {
    const v = process.env[name];
    if (v && /^https?:\/\//.test(v)) set.add(v.replace(/\/$/, ''));
  }
  const extra = process.env.ARIA_CORS_EXTRA_ORIGINS;
  if (extra) extra.split(',').map((s) => s.trim()).filter(Boolean).forEach((o) => set.add(o.replace(/\/$/, '')));
  return set;
}

function requestOrigin(eventOrRequest) {
  const h = eventOrRequest && eventOrRequest.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get('origin') || '';
  return h.origin || h.Origin || '';
}

/** The single origin to put in Access-Control-Allow-Origin for this request. */
function corsOrigin(eventOrRequest) {
  const o = String(requestOrigin(eventOrRequest) || '').replace(/\/$/, '');
  return allowedOrigins().has(o) ? o : PROD;
}

/** Standard header set for a sensitive JSON endpoint. */
function corsHeaders(eventOrRequest, extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': corsOrigin(eventOrRequest),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ARIA-Session-Token, X-Admin-Token, X-Internal-Token',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }, extra || {});
}

module.exports = { corsOrigin, corsHeaders, allowedOrigins, PROD };
