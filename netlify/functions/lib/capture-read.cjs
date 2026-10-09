// lib/capture-read.cjs — the admin-gated GET read path for the capture endpoints.
//
// RUN-CU 2026-10-09 (small-tasks close-out, task 2). The three capture functions — aria-lead-capture,
// aria-health-lead, aria-contact-back — persisted every record to Netlify Blobs FIRST (the 2026-10-08
// honesty pass) and then answered `405 POST only` to anything that tried to read it back. The outbound
// and reply lanes have been writing into a channel nobody could read from; the 15th consecutive run
// reported the same block. This module is the one read path for all three:
//
//   GET /.netlify/functions/<capture-fn>?since=<iso>&limit=<n>
//     → 200 { ok:true, store, prefix, count, items:[...], newest_first:true, capped, since }
//
//   - admin only, fail-CLOSED: lib/admin-gate.cjs `requireAdminToken` (503 when no token is configured,
//     401 when the request carries none or the wrong one). A token in the query string is NOT accepted.
//   - newest first, capped at MAX_ITEMS (200). `limit` may lower the cap, never raise it.
//   - `since` is an ISO-8601 timestamp; records at or after it are returned. An unparseable value is a
//     400, not a silent "everything".
//   - no CORS wildcard on this path: admin data is never readable cross-origin from a page. The POST
//     path's CORS headers are untouched.
//   - the store is walked through `list()` + `get(key, {type:'json'})`, bounded by MAX_SCAN, so a store
//     that has grown for months cannot turn one read into a timeout.
//
// POST behaviour in the three functions is byte-for-byte unchanged: each handler consults this module
// ONLY when the method is GET, before its existing `405 POST only` line.
//
// Works for both legacy `event` handlers (returns {statusCode, headers, body}) and Fetch `Request`
// handlers (returns a Response). Test seam: `_setStoreFactory(fn)` — same shape as sentinel-approvals.cjs.
'use strict';

const { requireAdminToken } = require('./admin-gate.cjs');
const { checkRateLimit } = require('../_rate-limit.js');

const MAX_ITEMS = 200;
const MAX_SCAN = 2000;
const GET_RATE = { limit: 60, windowMs: 60 * 1000 };

// ---------------------------------------------------------------- store seam

let _storeFactory = null;
/** Test seam: fn(name) → store-like { get(key, {type:'json'}), setJSON(key, value), list({prefix}?) }. */
function _setStoreFactory(fn) { _storeFactory = fn; }

/** Open a Blobs store; null when Blobs is unavailable (the caller answers 503, never an empty 200). */
async function openStore(name) {
  if (_storeFactory) { try { return await _storeFactory(name); } catch { return null; } }
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name, consistency: 'strong' });
  } catch { return null; }
}

// ---------------------------------------------------------------- request shape helpers

function isFetchRequest(r) { return !!(r && typeof r.url === 'string' && r.headers && typeof r.headers.get === 'function'); }

function methodOf(r) {
  if (!r) return '';
  return String(isFetchRequest(r) ? r.method : r.httpMethod || '').toUpperCase();
}

function queryOf(r) {
  if (!r) return {};
  if (isFetchRequest(r)) {
    try { return Object.fromEntries(new URL(r.url).searchParams.entries()); } catch { return {}; }
  }
  return r.queryStringParameters && typeof r.queryStringParameters === 'object' ? r.queryStringParameters : {};
}

function headerOf(r, name) {
  if (!r || !r.headers) return '';
  if (typeof r.headers.get === 'function') return r.headers.get(name) || '';
  const lower = name.toLowerCase();
  for (const k of Object.keys(r.headers)) if (k.toLowerCase() === lower) return r.headers[k] || '';
  return '';
}

function clientIp(r) {
  const raw = headerOf(r, 'x-nf-client-connection-ip') || headerOf(r, 'client-ip') || headerOf(r, 'x-forwarded-for') || 'unknown';
  return String(raw).split(',')[0].trim() || 'unknown';
}

function respond(r, status, body, extraHeaders) {
  const headers = Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extraHeaders || {});
  const text = JSON.stringify(body);
  if (isFetchRequest(r)) return new Response(text, { status, headers });
  return { statusCode: status, headers, body: text };
}

// ---------------------------------------------------------------- record helpers

/** Best-effort timestamp (ms) for a stored capture record: numeric createdAt → ISO `at` → leading digits of the key. */
function timestampOf(key, record) {
  if (record && typeof record === 'object') {
    for (const f of ['createdAt', 'received_at', 'created_at']) {
      const v = record[f];
      if (Number.isFinite(+v) && +v > 0) return +v;
      if (typeof v === 'string') { const t = Date.parse(v); if (Number.isFinite(t)) return t; }
    }
    if (typeof record.at === 'string') { const t = Date.parse(record.at); if (Number.isFinite(t)) return t; }
  }
  const m = /(?:^|\/)(\d{13})(?:[_.]|$)/.exec(String(key || ''));
  if (m) return +m[1];
  return 0;
}

/** `since` → ms, or null when absent; NaN when present but unparseable. */
function parseSince(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const t = /^\d{13}$/.test(s) ? +s : Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

function parseLimit(raw) {
  if (raw == null || String(raw).trim() === '') return MAX_ITEMS;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return MAX_ITEMS;
  return Math.min(n, MAX_ITEMS);
}

/**
 * readCaptures({ storeName, prefix, since, limit }) — pure read over a store.
 * @returns {{ ok:true, store:string, prefix:string|null, count:number, items:Array, newest_first:true, capped:boolean, scanned:number, since:string|null }}
 *          or {{ ok:false, status:number, error:string }}
 */
async function readCaptures({ storeName, prefix, since, limit }) {
  const store = await openStore(storeName);
  if (!store) return { ok: false, status: 503, error: 'blobs_unavailable', note: `Netlify Blobs store "${storeName}" could not be opened — nothing can be read, and nothing is being invented.` };
  let keys = [];
  try {
    const res = await store.list(prefix ? { prefix } : undefined);
    for (const b of (res && res.blobs) || []) {
      if (!b || typeof b.key !== 'string') continue;
      if (prefix && !b.key.startsWith(prefix)) continue;
      keys.push(b.key);
      if (keys.length >= MAX_SCAN) break;
    }
  } catch (e) {
    return { ok: false, status: 502, error: 'list_failed', note: String((e && e.message) || e) };
  }
  const items = [];
  for (const key of keys) {
    let record = null;
    try { record = await store.get(key, { type: 'json' }); } catch { record = null; }
    if (!record || typeof record !== 'object') continue;
    const ts = timestampOf(key, record);
    if (since != null && ts < since) continue;
    items.push({ key, at: ts ? new Date(ts).toISOString() : null, _ts: ts, record });
  }
  items.sort((a, b) => b._ts - a._ts);
  const cap = Math.min(limit || MAX_ITEMS, MAX_ITEMS);
  const capped = items.length > cap;
  const out = items.slice(0, cap).map(({ key, at, record }) => ({ key, at, ...record }));
  return { ok: true, store: storeName, prefix: prefix || null, count: out.length, items: out, newest_first: true, capped, scanned: keys.length, since: since != null ? new Date(since).toISOString() : null };
}

/**
 * handleCaptureGet(eventOrRequest, { storeName, prefix, scope })
 * The whole GET path for one capture endpoint: method guard → rate limit → admin gate → read.
 * Returns null when the request is not a GET so the caller falls through to its existing code untouched.
 */
async function handleCaptureGet(r, { storeName, prefix, scope }) {
  if (methodOf(r) !== 'GET') return null;
  const rl = checkRateLimit({ headers: {} }, { key: `capture-read:${scope || storeName}:${clientIp(r)}`, scope: `capture-read:${scope || storeName}`, ...GET_RATE });
  if (!rl.ok) return respond(r, 429, { ok: false, error: 'rate_limited', retry_after_sec: rl.retryAfterSec }, { 'Retry-After': String(rl.retryAfterSec) });
  const gate = requireAdminToken(r, { allowBodyToken: false });
  if (!gate.ok) return respond(r, gate.status || 401, { ok: false, error: gate.error || 'unauthorized', hint: gate.hint });
  const q = queryOf(r);
  const since = parseSince(q.since);
  if (Number.isNaN(since)) return respond(r, 400, { ok: false, error: 'bad_since', note: '`since` must be an ISO-8601 timestamp (e.g. 2026-10-01T00:00:00Z) or epoch milliseconds' });
  const result = await readCaptures({ storeName, prefix, since, limit: parseLimit(q.limit) });
  if (!result.ok) return respond(r, result.status, { ok: false, error: result.error, note: result.note });
  return respond(r, 200, { ...result, via: gate.via });
}

module.exports = { handleCaptureGet, readCaptures, timestampOf, parseSince, parseLimit, _setStoreFactory, openStore, MAX_ITEMS, MAX_SCAN, GET_RATE };
