// lib/sentinel-store.cjs — the ONE way a Sentinel Netlify function opens a Netlify Blobs store.
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B17). Every Sentinel function is a Lambda-compatibility
// handler (`export const handler = async (event) => …`). In that mode @netlify/blobs is NOT configured
// automatically: the credentials arrive on the Lambda `event` (`event.blobs`, `x-nf-site-id`) and must be
// handed over with `connectLambda(event)` BEFORE the first `getStore()`. Without it every store call threw
// `MissingBlobsEnvironmentError` — live: 502 with a stack trace (sentinel-licenses, license-register), 500
// (sentinel-crash), silent fail-open (resolve), 204 (update-manifest), 'approval-store-unavailable' (notify)
// and a 500 on every real Stripe event. The repo already documented the cause + fix in
// lib/content-assurance.mjs (initBlobs); this module is that fix, shared.
//
//   const S = require('./lib/sentinel-store.cjs');
//   const store = await S.openStore('sentinel-licenses', event);   // null when Blobs is unreachable
//   if (!store) return S.unavailable();                            // 503 {ok:false, reason:'store-unavailable'}
//
// Rules this module enforces:
//   - `connectLambda(event)` runs (once per event object) before any getStore — never after.
//   - NO `consistency:'strong'`: Lambda-compat mode never gets the `uncachedEdgeURL` strong reads need, so
//     a strong store throws on every read. Default (eventual) consistency only.
//   - Nothing here throws to the caller: a missing module, a bad event or a getStore failure returns null,
//     and the caller answers 503 JSON — never a stack trace with /var/task paths (B17).
//   - Test seam: `_setStoreFactory(fn)` → fn(name, event) returns an in-memory store-like object. Tests mock
//     Blobs this way (the repo root has no node_modules; `mock.module` is not available on this Node).
'use strict';

const crypto = require('node:crypto');

let _storeFactory = null;
/** Test seam: fn(name, event) → store-like { get(key,{type:'json'}), set, setJSON, list(), delete? }. */
function _setStoreFactory(fn) { _storeFactory = typeof fn === 'function' ? fn : null; }

let _blobsModule;
/** Test seam: inject a fake { connectLambda, getStore } so the real connect-then-open path can be asserted. */
function _setBlobsModule(mod) { _blobsModule = mod === null || (mod && typeof mod === 'object') ? mod : undefined; }
/** The real @netlify/blobs module (loaded once, lazily — a missing module is a null, not a crash). */
async function blobsModule() {
  if (_blobsModule !== undefined) return _blobsModule;
  let mod = null;
  try {
    // Dynamic so this file loads without the dependency installed (tests inject a factory instead).
    mod = await import('@netlify/blobs');
  } catch {
    try { mod = require('@netlify/blobs'); } catch { mod = null; }
  }
  // Bundler interop: a CJS entry reached through an ESM namespace may sit under `default`.
  if (mod && typeof mod.getStore !== 'function' && mod.default && typeof mod.default.getStore === 'function') mod = mod.default;
  _blobsModule = mod && typeof mod.getStore === 'function' ? mod : null;
  return _blobsModule;
}

const connected = new WeakSet();

/**
 * connectBlobs(event) — hand the Lambda event's Blobs credentials to @netlify/blobs. Idempotent per event.
 * Safe to call with a Fetch Request or no event at all (v2 functions get their context automatically):
 * those calls are no-ops. Returns true when a connect actually happened.
 */
async function connectBlobs(event) {
  if (!event || typeof event !== 'object' || typeof event.blobs !== 'string' || !event.blobs) return false;
  if (connected.has(event)) return true;
  const m = await blobsModule();
  if (!m || typeof m.connectLambda !== 'function') return false;
  try {
    m.connectLambda(event);
    connected.add(event);
    return true;
  } catch {
    // Already connected, or a context that configures Blobs itself. Non-fatal — getStore decides.
    return false;
  }
}

/**
 * openStore(name, event) — a Blobs store, or null when Blobs is unreachable.
 * `event` is the Lambda event (needed in Lambda-compat mode). Pass it from every v1 handler.
 */
async function openStore(name, event) {
  const storeName = String(name || '').trim();
  if (!storeName) return null;
  if (_storeFactory) {
    try { return (await _storeFactory(storeName, event)) || null; } catch { return null; }
  }
  const m = await blobsModule();
  if (!m || typeof m.getStore !== 'function') return null;
  await connectBlobs(event);
  try {
    return m.getStore(storeName); // default consistency — strong is unavailable in Lambda-compat mode
  } catch (e) {
    // MissingBlobsEnvironmentError or a malformed context. Logged without the stack (no /var/task paths).
    console.error(`[sentinel-store] getStore(${storeName}) failed: ${String((e && e.name) || 'Error')}: ${String((e && e.message) || e).slice(0, 160)}`);
    return null;
  }
}

/** Open several stores at once → { name: store|null }; `allOk` is true only when every one opened. */
async function openStores(names, event) {
  const out = {};
  let allOk = true;
  for (const n of names || []) {
    out[n] = await openStore(n, event);
    if (!out[n]) allOk = false;
  }
  return { stores: out, allOk };
}

/** The honest 503 every Sentinel function answers when its store cannot be opened (legacy handler shape). */
function unavailable(extra, headers) {
  return {
    statusCode: 503,
    headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store', 'retry-after': '30' }, headers || {}),
    body: JSON.stringify(Object.assign({ ok: false, reason: 'store-unavailable', error: 'store-unavailable' }, extra || {}))
  };
}

/** get(key, {type:'json'}) that never throws (null on any failure). */
async function getJson(store, key) {
  if (!store || !key) return null;
  try { const v = await store.get(String(key), { type: 'json' }); return v == null ? null : v; } catch { return null; }
}

/** setJSON that reports success honestly (true only when the write did not throw). */
async function putJson(store, key, value) {
  if (!store || !key) return false;
  try { await store.setJSON(String(key), value); return true; } catch (e) {
    console.error(`[sentinel-store] setJSON failed: ${String((e && e.message) || e).slice(0, 160)}`);
    return false;
  }
}

/**
 * readJson(store, key) → { ok:true, value } (value null when the blob is absent) | { ok:false } on a store error.
 * Unlike getJson it tells "absent" apart from "unreachable" — what a fail-closed caller needs.
 */
async function readJson(store, key) {
  if (!store || !key || typeof store.get !== 'function') return { ok: false, value: null };
  try {
    const v = await store.get(String(key), { type: 'json' });
    return { ok: true, value: v == null ? null : v };
  } catch { return { ok: false, value: null }; }
}

// ------------------------------------------------------------------ durable rate limit (REVIEW FIX P1-2 / P2-3)
//
// SENTINEL REVIEW FIXES 2026-10-14. `_rate-limit.js` is a per-warm-instance Map: a cold start, a second instance
// or a rotated caller-chosen id resets it. This limiter keeps its counter in Blobs, one blob per
// (scope, window, id) — `rl/<scope>/<window#>/<id>` — so it holds across instances and cold starts.
//   - FAILS CLOSED: no store, a read error or a write error → { ok:false, unavailable:true } and the caller
//     answers 503. An unmetered endpoint is what the review found; "the limiter is down" must not reopen it.
//   - Read-modify-write without a conditional write: two truly concurrent calls can both read N and both write
//     N+1, so the bound is approximate under a burst (Blobs' eventual consistency widens that to the update
//     propagation delay). The in-memory per-instance limiter stays in front as the burst guard; this one is
//     the cross-instance hourly ceiling.
//   - Keys hold only a scope name, a window number and an already-hashed id (never a key, never an address).
const HOUR_MS = 60 * 60 * 1000;

/**
 * durableLimit(store, { scope, id, limit, windowMs = 1h, now })
 *   → { ok:true, count, limit, remaining, resetAt, retryAfterSec }
 *   → { ok:false, limited:true, count, limit, resetAt, retryAfterSec }      (over the limit — nothing written)
 *   → { ok:false, unavailable:true, reason:'limiter-unavailable' }           (fail closed)
 */
async function durableLimit(store, opts) {
  const o = opts || {};
  const scope = String(o.scope || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const id = String(o.id || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
  const limit = Math.max(1, Math.floor(Number(o.limit) || 0));
  const windowMs = Math.max(1000, Math.floor(Number(o.windowMs) || HOUR_MS));
  const now = Number(o.now) || Date.now();
  const down = { ok: false, unavailable: true, reason: 'limiter-unavailable' };
  if (!scope || !id || !store || typeof store.get !== 'function' || typeof store.setJSON !== 'function') return down;
  const bucket = Math.floor(now / windowMs);
  const resetAt = (bucket + 1) * windowMs;
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const key = `rl/${scope}/${bucket}/${id}`;
  const cur = await readJson(store, key);
  if (!cur.ok) return down;
  const count = cur.value && Number.isFinite(Number(cur.value.count)) ? Number(cur.value.count) : 0;
  if (count >= limit) return { ok: false, limited: true, count, limit, resetAt, retryAfterSec };
  try {
    await store.setJSON(key, { count: count + 1, window_start: new Date(bucket * windowMs).toISOString(), expires: new Date(resetAt + windowMs).toISOString() });
  } catch { return down; }
  return { ok: true, count: count + 1, limit, remaining: limit - count - 1, resetAt, retryAfterSec };
}

/** Apply several durable limits in order; the first refusal wins. → the first non-ok result, or the last ok one. */
async function durableLimits(store, checks, now) {
  let last = { ok: true };
  for (const c of checks || []) {
    last = await durableLimit(store, Object.assign({ now }, c));
    if (!last.ok) return Object.assign({ scope: c.scope }, last);
  }
  return last;
}

/** The legacy-handler answer for a refused durableLimit result: 429 (limited) or 503 (limiter down — fail closed). */
function limitResponse(result, headers) {
  const h = Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, headers || {});
  if (result && result.limited) {
    return { statusCode: 429, headers: Object.assign({ 'retry-after': String(result.retryAfterSec || 60) }, h), body: JSON.stringify({ ok: false, error: 'rate_limited', scope: result.scope || null, retry_after_sec: result.retryAfterSec || 60 }) };
  }
  return { statusCode: 503, headers: Object.assign({ 'retry-after': '30' }, h), body: JSON.stringify({ ok: false, error: 'rate-limiter-unavailable', reason: 'store-unavailable' }) };
}

// ------------------------------------------------------------------ one-writer claim (REVIEW FIX P2-5)
//
// Stripe delivers checkout.session.completed and customer.subscription.created for the same purchase within
// milliseconds of each other, and redelivers on any timeout. claimOnce lets exactly one invocation do the
// mint + email. It uses the store's conditional write when it has one (@netlify/blobs ≥ 8:
// setJSON(key, value, { onlyIfNew:true }) → { modified }) and otherwise (the 7.x client this repo pins has no
// conditional write) writes a random claim id, waits `settleMs`, and reads it back: only the invocation whose
// claim survived (last writer wins) proceeds. Without a conditional write this narrows the race to the
// store's read-after-write window — it cannot close it; the per-subscription key is deterministic, so the
// worst case is the SAME key mailed twice, never two different keys.
let _claimSettleMs = null;
/** Test seam: override the settle delay of the verify-mode claim (ms). null → env / default. */
function _setClaimSettleMs(ms) { _claimSettleMs = ms == null ? null : Math.max(0, Number(ms) || 0); }
function claimSettleMs() {
  if (_claimSettleMs != null) return _claimSettleMs;
  const env = Number(process.env.SENTINEL_CLAIM_SETTLE_MS);
  return Number.isFinite(env) && env >= 0 ? env : 250;
}

/**
 * claimOnce(store, key, { ttlMs = 10 min, now, info }) →
 *   { claimed:true, mode:'conditional'|'verify', claim }      — this invocation owns the work
 *   { claimed:false, mode, holder }                           — another invocation holds a fresh claim
 *   { claimed:false, unavailable:true }                       — the store failed (caller answers 503)
 * A claim older than ttlMs (a crashed run) is taken over.
 */
async function claimOnce(store, key, opts) {
  const o = opts || {};
  const now = Number(o.now) || Date.now();
  const ttlMs = Math.max(1000, Number(o.ttlMs) || 10 * 60 * 1000);
  if (!store || !key || typeof store.setJSON !== 'function') return { claimed: false, unavailable: true };
  const cur = await readJson(store, key);
  if (!cur.ok) return { claimed: false, unavailable: true };
  const held = cur.value && cur.value.claim && (now - Date.parse(cur.value.at || 0)) < ttlMs;
  if (held && cur.value.state !== 'released') return { claimed: false, mode: 'existing', holder: { at: cur.value.at, state: cur.value.state || 'claimed' } };
  const claim = crypto.randomBytes(12).toString('hex');
  const marker = Object.assign({}, o.info || {}, { claim, at: new Date(now).toISOString(), state: 'claimed' });
  let res;
  try {
    res = await store.setJSON(String(key), marker, cur.value ? {} : { onlyIfNew: true });
  } catch { return { claimed: false, unavailable: true }; }
  if (res && typeof res === 'object' && typeof res.modified === 'boolean') {
    return res.modified ? { claimed: true, mode: 'conditional', claim } : { claimed: false, mode: 'conditional', holder: { state: 'claimed' } };
  }
  const settle = claimSettleMs();
  if (settle > 0) await new Promise((r) => setTimeout(r, settle));
  const back = await readJson(store, key);
  if (!back.ok) return { claimed: false, unavailable: true };
  return back.value && back.value.claim === claim
    ? { claimed: true, mode: 'verify', claim }
    : { claimed: false, mode: 'verify', holder: { at: back.value && back.value.at, state: (back.value && back.value.state) || 'claimed' } };
}

/** Mark a claim finished (state 'done', kept as an audit row) or released (state 'released' — retakable). Best-effort. */
async function finishClaim(store, key, state, info) {
  if (!store || !key) return false;
  try { await store.setJSON(String(key), Object.assign({}, info || {}, { state: state === 'released' ? 'released' : 'done', at: new Date().toISOString() })); return true; } catch { return false; }
}

module.exports = {
  _setStoreFactory, _setBlobsModule, _setClaimSettleMs, blobsModule, connectBlobs, openStore, openStores, unavailable, getJson, putJson,
  readJson, HOUR_MS, durableLimit, durableLimits, limitResponse, claimOnce, finishClaim
};
