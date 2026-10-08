// lib/admin-gate.cjs — fail-CLOSED, constant-time admin / internal token gate for Netlify functions.
//
// The 2026-10-08 audit (§2, §7) found 25 copies of the same three-line admin check (`!==`, not
// constant-time) and seven gates that PASS when the env var is unset (`undefined === undefined`,
// `if (TOKEN() && …)`, `if (!want) return true`). This helper is the one rule for all of them:
//
//   - no expected token configured  → { ok:false, status:503, error:'not-configured' }   (never fail-open)
//   - token missing on the request  → { ok:false, status:401, error:'unauthorized' }
//   - token present but wrong       → { ok:false, status:401, error:'unauthorized' }
//   - match (crypto.timingSafeEqual) → { ok:true, via:<ENV_NAME>, source:<where it came from> }
//
// Where the token is read from (first non-empty wins, every candidate is compared constant-time):
//   headers: x-admin-token, x-aria-admin-token, x-internal-token, x-sentinel-admin-token,
//            x-aria-tool-secret, authorization: Bearer <token>
//   body (when passed): admin_token, internal_token, token (only if opts.allowBodyToken !== false)
//   query string is NOT accepted (tokens in access logs — audit §2.1).
//
// Works for both legacy `event` objects (event.headers) and Fetch `Request` objects (headers.get).
'use strict';

const crypto = require('node:crypto');

const DEFAULT_ENV_NAMES = ['ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET'];
const HEADER_NAMES = ['x-admin-token', 'x-aria-admin-token', 'x-internal-token', 'x-sentinel-admin-token', 'x-aria-tool-secret'];
const BODY_FIELDS = ['admin_token', 'internal_token', 'token'];

function timingSafeEq(a, b) {
  const ba = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bb = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (ba.length === 0 || bb.length === 0) return false;
  if (ba.length !== bb.length) {
    // Burn comparable time so a length mismatch is not a faster "no".
    try { crypto.timingSafeEqual(ba, ba); } catch {}
    return false;
  }
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

function headerOf(eventOrRequest, name) {
  if (!eventOrRequest) return '';
  const h = eventOrRequest.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(name) || '';
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === lower) return h[k] || '';
  }
  return '';
}

/** Every token the request offers, tagged with its source. */
function presentedTokens(eventOrRequest, body, opts) {
  const out = [];
  for (const name of HEADER_NAMES) {
    const v = headerOf(eventOrRequest, name);
    if (v) out.push({ source: 'header:' + name, value: String(v).trim() });
  }
  const auth = headerOf(eventOrRequest, 'authorization');
  if (auth && /^Bearer\s+/i.test(auth)) out.push({ source: 'header:authorization', value: auth.replace(/^Bearer\s+/i, '').trim() });
  if (body && typeof body === 'object' && (!opts || opts.allowBodyToken !== false)) {
    for (const f of BODY_FIELDS) {
      if (typeof body[f] === 'string' && body[f].trim()) out.push({ source: 'body:' + f, value: body[f].trim() });
    }
  }
  return out;
}

/**
 * requireAdminToken(eventOrRequest, { envNames, body, allowBodyToken })
 * @returns {{ok:boolean, status:number, error?:string, via?:string, source?:string}}
 */
function requireAdminToken(eventOrRequest, opts) {
  const o = opts || {};
  const envNames = Array.isArray(o.envNames) && o.envNames.length ? o.envNames : DEFAULT_ENV_NAMES;
  const expected = [];
  for (const name of envNames) {
    const v = process.env[name];
    if (typeof v === 'string' && v.trim().length >= 8) expected.push({ name, value: v.trim() });
  }
  if (!expected.length) {
    return { ok: false, status: 503, error: 'not-configured', hint: 'set one of: ' + envNames.join(', ') };
  }
  const presented = presentedTokens(eventOrRequest, o.body, o);
  if (!presented.length) return { ok: false, status: 401, error: 'unauthorized' };
  for (const p of presented) {
    for (const e of expected) {
      if (timingSafeEq(p.value, e.value)) return { ok: true, status: 200, via: e.name, source: p.source };
    }
  }
  return { ok: false, status: 401, error: 'unauthorized' };
}

/** Legacy-handler response for a failed gate. Keeps the caller's headers. */
function adminGateResponse(result, headers) {
  return {
    statusCode: result.status || 401,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify({ ok: false, error: result.error || 'unauthorized', hint: result.hint }),
  };
}

/** Fetch-style response for a failed gate (ESM / .mts handlers). */
function adminGateFetchResponse(result, headers) {
  return new Response(JSON.stringify({ ok: false, error: result.error || 'unauthorized', hint: result.hint }), {
    status: result.status || 401,
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
  });
}

/** Constant-time compare for callers that already hold both strings (webhook signatures etc.). */
function constantTimeEqual(a, b) { return timingSafeEq(a, b); }

module.exports = { requireAdminToken, adminGateResponse, adminGateFetchResponse, constantTimeEqual, DEFAULT_ENV_NAMES, HEADER_NAMES };
