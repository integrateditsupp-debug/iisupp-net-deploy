// lib/sentinel-approvals.cjs — shared, dependency-free helpers for the two RUN-CU / CU4 Sentinel endpoints
// (aria-sentinel-notify.js + aria-sentinel-approval.js): device authentication, HMAC-signed approve/deny
// links, the 'sentinel-approvals' Blobs record shape, and the content-blind guard.
//
// Device auth (header `x-sentinel-key`): the desktop sends sha256(licenseKey) — never the raw key. A license
// key is HMAC(SENTINEL_LICENSE_SECRET, "sentinel-license:v1:<plan>") (sentinel-resolve / sentinel-license-
// funnel), so with the secret the server derives every plan key, hashes it and compares constant-time: no
// store round-trip, no key on the wire. Without the secret it falls back to the license stores
// ('licenses' keyed by hash, then a 'sentinel-licenses' scan). A revoked record denies. An internal /
// admin token (lib/admin-gate.cjs, fail-closed) is the only other way in.
//
// Approval links: `${id}.${exp36}.${hmac32}` under SENTINEL_APPROVAL_SECRET (falls back to
// SENTINEL_LICENSE_SECRET). No secret → no links are minted (the email says "approve in the app"), never
// an unsigned link. Tokens expire with the record. Every compare is constant-time.
//
// Rule 14: nothing here reports a send, a store write or a decision it did not observe.
'use strict';

const crypto = require('node:crypto');
const { requireAdminToken, constantTimeEqual } = require('./admin-gate.cjs');

const PLAN_ORDER = ['admin-lifetime', 'personal', 'pro', 'smb', 'midsize', 'enterprise'];
const APPROVALS_STORE = 'sentinel-approvals';
const LICENSES_STORE = 'licenses';
const SENTINEL_LICENSES_STORE = 'sentinel-licenses';
const APPROVAL_URL = 'https://iisupp.net/.netlify/functions/aria-sentinel-approval';
const NOTIFY_EVENTS = ['issue-detected', 'approval-requested', 'fix-executed', 'fix-failed', 'report'];
const SEVERITIES = ['green', 'yellow', 'red'];
const EXPIRY_MIN_MS = 60 * 1000;
const EXPIRY_MAX_MS = 24 * 60 * 60 * 1000;
const EXPIRY_DEFAULT_MS = 30 * 60 * 1000;
const ADMIN_ENV_NAMES = ['SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET'];
const HEX64 = /^[a-f0-9]{64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{1,64}$/;

const sha256 = (v) => crypto.createHash('sha256').update(String(v == null ? '' : v)).digest('hex');
const hash16 = (v) => sha256(String(v == null ? '' : v).toLowerCase().trim()).slice(0, 16);

// ---------------------------------------------------------------- store seam

let _storeFactory = null;
/** Test seam: fn(name) → store-like { get(key, {type:'json'}), setJSON(key, value), list() }. */
function _setStoreFactory(fn) { _storeFactory = fn; }

/** Open a Blobs store; null when Blobs is unavailable (callers decide whether that is fatal). */
async function openStore(name) {
  if (_storeFactory) { try { return await _storeFactory(name); } catch { return null; } }
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name, consistency: 'strong' });
  } catch { return null; }
}

// ---------------------------------------------------------------- headers / env

function headerOf(event, name) {
  const h = (event && event.headers) || {};
  const lower = String(name).toLowerCase();
  for (const k of Object.keys(h)) if (k.toLowerCase() === lower) return h[k] == null ? '' : String(h[k]);
  return '';
}

function clientIp(event) {
  return headerOf(event, 'x-nf-client-connection-ip') || headerOf(event, 'client-ip') || String(headerOf(event, 'x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
}

function approvalSecret(env) {
  const e = env || process.env;
  const s = e.SENTINEL_APPROVAL_SECRET || e.SENTINEL_LICENSE_SECRET || '';
  return typeof s === 'string' && s.trim().length >= 16 ? s.trim() : '';
}

// ---------------------------------------------------------------- device auth

function planKeyHash(plan, secret) {
  const key = crypto.createHmac('sha256', String(secret)).update(`sentinel-license:v1:${plan}`).digest('hex');
  return sha256(key);
}

/**
 * verifyDeviceKey(presentedHash, { env, openStore })
 *   → { ok:true, via:'plan-key'|'licenses-store'|'sentinel-licenses', plan, tenant }
 *   → { ok:false, reason:'missing'|'bad-format'|'revoked'|'unknown-key' }
 * `tenant` is a 16-hex hash of the presented key hash — safe to store and to key records by.
 */
async function verifyDeviceKey(presented, opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const open = o.openStore || openStore;
  const hash = String(presented || '').trim().toLowerCase();
  if (!hash) return { ok: false, reason: 'missing' };
  if (!HEX64.test(hash)) return { ok: false, reason: 'bad-format' };
  const tenant = hash16(hash);

  let plan = null;
  const secret = typeof env.SENTINEL_LICENSE_SECRET === 'string' ? env.SENTINEL_LICENSE_SECRET.trim() : '';
  if (secret) {
    for (const p of PLAN_ORDER) if (constantTimeEqual(hash, planKeyHash(p, secret))) { plan = p; break; }
  }

  // Revocation (and the no-secret fallback) come from the license stores. Plan keys are shared by every
  // customer on that plan, so "revoked" means: records with this hash exist and NONE of them is active.
  let found = 0, active = 0, storeHit = null;
  try {
    const store = await open(LICENSES_STORE);
    const rec = store ? await store.get(hash, { type: 'json' }).catch(() => null) : null;
    if (rec && typeof rec === 'object') { found++; if (rec.status !== 'revoked' && rec.revoked !== true) { active++; storeHit = storeHit || 'licenses-store'; } }
  } catch { /* store unavailable → rely on the other paths */ }
  try {
    const store = await open(SENTINEL_LICENSES_STORE);
    if (store && typeof store.list === 'function') {
      const listing = await store.list().catch(() => ({ blobs: [] }));
      const keys = ((listing && listing.blobs) || []).map((b) => b.key).slice(0, 2000);
      for (const k of keys) {
        const rec = await store.get(k, { type: 'json' }).catch(() => null);
        if (!rec || typeof rec !== 'object' || !rec.key) continue;
        if (!constantTimeEqual(sha256(rec.key), hash)) continue;
        found++;
        if (rec.status !== 'revoked') { active++; storeHit = storeHit || 'sentinel-licenses'; }
      }
    }
  } catch { /* store unavailable → rely on the other paths */ }

  if (found > 0 && active === 0) return { ok: false, reason: 'revoked' };
  if (plan) return { ok: true, via: 'plan-key', plan, tenant };
  if (storeHit) return { ok: true, via: storeHit, plan: null, tenant };
  return { ok: false, reason: 'unknown-key' };
}

/**
 * authenticate(event, { env, openStore }) — device key first, then an internal/admin token.
 *   → { ok:true, kind:'device'|'internal', tenant, plan?, via }
 *   → { ok:false, status:401|503, error }
 */
async function authenticate(event, opts) {
  const presented = headerOf(event, 'x-sentinel-key');
  if (presented) {
    const r = await verifyDeviceKey(presented, opts);
    if (r.ok) return { ok: true, kind: 'device', tenant: r.tenant, plan: r.plan, via: r.via };
    return { ok: false, status: 401, error: r.reason === 'revoked' ? 'license-revoked' : 'unauthorized' };
  }
  const gate = requireAdminToken(event, { envNames: ADMIN_ENV_NAMES, allowBodyToken: false });
  if (gate.ok) return { ok: true, kind: 'internal', tenant: 'internal', plan: null, via: gate.via };
  // A missing admin token on a device endpoint is "unauthorized", not "not configured": the device path is
  // the normal one and it needs no admin env. 503 only when the caller tried an admin header and none is set.
  const triedAdmin = ['x-admin-token', 'x-internal-token', 'x-sentinel-admin-token', 'authorization'].some((h) => headerOf(event, h));
  if (triedAdmin && gate.status === 503) return { ok: false, status: 503, error: 'not-configured' };
  return { ok: false, status: 401, error: 'unauthorized' };
}

// ---------------------------------------------------------------- approval tokens

function tokenMessage(id, exp36) { return `sentinel-approval:v1:${id}:${exp36}`; }

/** signApprovalToken(id, expiresAtMs, secret) → "id.exp36.hmac32" or '' when no secret. */
function signApprovalToken(id, expiresAtMs, secret) {
  if (!secret || !TOKEN_RE.test(String(id || ''))) return '';
  const exp36 = Math.floor(Number(expiresAtMs) / 1000).toString(36);
  const sig = crypto.createHmac('sha256', String(secret)).update(tokenMessage(id, exp36)).digest('hex').slice(0, 32);
  return `${id}.${exp36}.${sig}`;
}

/** verifyApprovalToken(token, secret, nowMs) → { ok, id, expiresAt, reason } — constant-time signature compare. */
function verifyApprovalToken(token, secret, nowMs) {
  const t = String(token || '').trim();
  if (!secret) return { ok: false, reason: 'no-secret' };
  const m = t.match(/^([A-Za-z0-9_-]{1,64})\.([0-9a-z]{1,12})\.([a-f0-9]{32})$/);
  if (!m) return { ok: false, reason: 'malformed' };
  const [, id, exp36, sig] = m;
  const expected = crypto.createHmac('sha256', String(secret)).update(tokenMessage(id, exp36)).digest('hex').slice(0, 32);
  if (!constantTimeEqual(sig, expected)) return { ok: false, reason: 'bad-signature' };
  const expiresAt = parseInt(exp36, 36) * 1000;
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' };
  if ((Number(nowMs) || Date.now()) > expiresAt) return { ok: false, reason: 'expired', id, expiresAt };
  return { ok: true, id, expiresAt };
}

function approvalLinks(id, expiresAtMs, secret, base) {
  const token = signApprovalToken(id, expiresAtMs, secret);
  if (!token) return null;
  const b = base || APPROVAL_URL;
  return { approveUrl: `${b}?t=${encodeURIComponent(token)}&a=approve`, denyUrl: `${b}?t=${encodeURIComponent(token)}&a=deny` };
}

// ---------------------------------------------------------------- records

function clampExpiry(expiresAt, nowMs) {
  const now = Number(nowMs) || Date.now();
  const parsed = expiresAt ? Date.parse(String(expiresAt)) : NaN;
  if (!Number.isFinite(parsed)) return now + EXPIRY_DEFAULT_MS;
  return Math.min(now + EXPIRY_MAX_MS, Math.max(now + EXPIRY_MIN_MS, parsed));
}

function newApprovalId() { return crypto.randomBytes(8).toString('hex'); }

/** The stored approval record — catalog facts only (title/recipe/severity/platform), hashes for who/where. */
function createApprovalRecord({ tenant, device, recipe, title, severity, platform, clientApprovalId, expiresAt, now } = {}) {
  const at = Number(now) || Date.now();
  return {
    v: 'sentinel-approval-v1',
    id: newApprovalId(),
    tenant: String(tenant || 'unknown').slice(0, 32),
    device: device && TOKEN_RE.test(String(device)) ? String(device) : null,
    recipe: recipe && TOKEN_RE.test(String(recipe)) ? String(recipe) : null,
    title: String(title || 'A vetted fix').replace(/[^\w .,:;'()\-\/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
    severity: SEVERITIES.includes(severity) ? severity : 'yellow',
    platform: String(platform || '').replace(/[^a-z0-9-]/gi, '').slice(0, 16) || null,
    clientApprovalId: clientApprovalId && TOKEN_RE.test(String(clientApprovalId)) ? String(clientApprovalId) : null,
    createdAt: new Date(at).toISOString(),
    expiresAt: new Date(clampExpiry(expiresAt, at)).toISOString(),
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decidedVia: null
  };
}

/** Effective status: a pending record past its expiry reads as 'expired' (never silently approvable). */
function effectiveStatus(rec, nowMs) {
  if (!rec) return 'missing';
  if (rec.status !== 'pending') return rec.status;
  return (Number(nowMs) || Date.now()) > Date.parse(rec.expiresAt || 0) ? 'expired' : 'pending';
}

/** Apply a decision once; returns { ok, record, reason }. Never re-decides. */
function decideRecord(rec, action, { decidedBy, via, now } = {}) {
  const at = Number(now) || Date.now();
  const status = effectiveStatus(rec, at);
  if (status !== 'pending') return { ok: false, record: rec, reason: status === 'missing' ? 'missing' : `already-${status}` };
  if (action !== 'approve' && action !== 'deny') return { ok: false, record: rec, reason: 'bad-action' };
  const by = String(decidedBy || '').replace(/[^\w .'\-@]/g, '').trim().slice(0, 40) || 'email-link';
  return {
    ok: true,
    record: { ...rec, status: action === 'approve' ? 'approved' : 'denied', decidedBy: by, decidedAt: new Date(at).toISOString(), decidedVia: String(via || 'link').slice(0, 20) }
  };
}

/** The content-blind view a poll returns — never the tenant, never the client id of another device. */
function pollView(rec, nowMs) {
  return { id: rec.id, status: effectiveStatus(rec, nowMs), decidedBy: rec.decidedBy, decidedAt: rec.decidedAt, expiresAt: rec.expiresAt, recipe: rec.recipe, title: rec.title };
}

// ---------------------------------------------------------------- content-blind guard

let _guardModule = null;
/** The Sentinel's own telemetry-safe guard (one definition for desktop + server). null when unavailable. */
async function contentGuard() {
  if (_guardModule) return _guardModule;
  try {
    _guardModule = await import('../../../ARIA Sentinel/src/shared/notify-channels.mjs');
  } catch { _guardModule = null; }
  return _guardModule;
}

/** Fetch-style or legacy json response. */
function json(statusCode, body, extraHeaders) {
  return { statusCode, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, extraHeaders || {}), body: JSON.stringify(body) };
}

function esc(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = {
  PLAN_ORDER, APPROVALS_STORE, LICENSES_STORE, SENTINEL_LICENSES_STORE, APPROVAL_URL, NOTIFY_EVENTS, SEVERITIES,
  EXPIRY_MIN_MS, EXPIRY_MAX_MS, EXPIRY_DEFAULT_MS, ADMIN_ENV_NAMES, TOKEN_RE, HEX64,
  _setStoreFactory, openStore, headerOf, clientIp, approvalSecret, sha256, hash16,
  planKeyHash, verifyDeviceKey, authenticate,
  signApprovalToken, verifyApprovalToken, approvalLinks,
  clampExpiry, newApprovalId, createApprovalRecord, effectiveStatus, decideRecord, pollView,
  contentGuard, json, esc
};
