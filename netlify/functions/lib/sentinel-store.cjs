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

module.exports = { _setStoreFactory, _setBlobsModule, blobsModule, connectBlobs, openStore, openStores, unavailable, getJson, putJson };
