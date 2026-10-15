// lib/sentinel-approvals.cjs — shared, dependency-free helpers for the two RUN-CU / CU4 Sentinel endpoints
// (aria-sentinel-notify.js + aria-sentinel-approval.js): device authentication, HMAC-signed approve/deny
// links, the 'sentinel-approvals' Blobs record shape, and the content-blind guard.
//
// Device auth (header `x-sentinel-key`): the desktop sends sha256(licenseKey) — never the raw key.
// SENTINEL-BACKEND 2026-10-14 (audit B3/B5/B14) — the check is now O(1), three reads at most, no listing:
//   1. 'sentinel-licenses-revocations' <hash>  → the ONE revocation truth (admin revoke + Stripe
//      subscription.deleted write it; sentinel-resolve reads the same entry)        → 401 license-revoked
//   2. 'sentinel-license-keys' <hash>           → the per-customer key index (v2 keys; lib/sentinel-license-
//      records.cjs). Gives the plan, seats, contacts and the per-tenant `disabled` flag → ok via 'sentinel-license-keys'
//   3. 'licenses' <hash>                        → the device check-in registry (legacy no-secret fallback)
//   4. v1 shared plan keys (HMAC(SENTINEL_LICENSE_SECRET, "sentinel-license:v1:<plan>")) are still derived
//      from the secret and compared constant-time — Rule 15: every v1 key keeps working.
// The 2,000-blob 'sentinel-licenses' scan is gone (it ran on every notify + every approval poll).
// An internal / admin token (lib/admin-gate.cjs, fail-closed) is the only other way in.
//
// Approval links: `${id}.${exp36}.${hmac32}` under SENTINEL_APPROVAL_SECRET (falls back to
// SENTINEL_LICENSE_SECRET). No secret → no links are minted (the email says "approve in the app"), never
// an unsigned link. Tokens expire with the record. Every compare is constant-time.
//
// Rule 14: nothing here reports a send, a store write or a decision it did not observe.
'use strict';

const crypto = require('node:crypto');
const { requireAdminToken, constantTimeEqual } = require('./admin-gate.cjs');
const S = require('./sentinel-store.cjs');

// 'admin' is the shared module's name for the owner plan (pricing-tiers.mjs); 'admin-lifetime' is the message the
// emergency sentinel-resolve signed. Both derive (audit B9) so an admin key minted by either generator authenticates.
const PLAN_ORDER = ['admin-lifetime', 'admin', 'personal', 'pro', 'smb', 'midsize', 'enterprise'];
const APPROVALS_STORE = 'sentinel-approvals';
const LICENSES_STORE = 'licenses';
const SENTINEL_LICENSES_STORE = 'sentinel-licenses';
const SENTINEL_LICENSE_KEYS_STORE = 'sentinel-license-keys';
const REVOCATIONS_STORE = 'sentinel-licenses-revocations';
const KEY_RECORD_V = 'sentinel-license-key-v1';
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
/** Test seam: fn(name, event) → store-like { get(key, {type:'json'}), setJSON(key, value), list() }. */
function _setStoreFactory(fn) { _storeFactory = fn; }

/**
 * Open a Blobs store; null when Blobs is unavailable (callers decide whether that is fatal).
 * `event` is the Lambda event: in Lambda-compat mode Blobs must be handed the event's credentials
 * (`connectLambda`) BEFORE the first getStore — lib/sentinel-store.cjs does that (audit B1). Strong
 * consistency is NOT requested any more: it is unavailable in this mode and threw on every read.
 */
async function openStore(name, event) {
  if (_storeFactory) { try { return await _storeFactory(name, event); } catch { return null; } }
  return S.openStore(name, event);
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

async function readJson(open, storeName, key, event) {
  try {
    const store = await open(storeName, event);
    if (!store) return null;
    const rec = await store.get(key, { type: 'json' }).catch(() => null);
    return rec && typeof rec === 'object' ? rec : null;
  } catch { return null; }
}

/**
 * verifyDeviceKey(presentedHash, { env, openStore, event })
 *   → { ok:true, via:'sentinel-license-keys'|'plan-key'|'licenses-store', plan, tenant, record, device, sharedKey }
 *   → { ok:false, reason:'missing'|'bad-format'|'revoked'|'unknown-key' }
 * `tenant` is a 16-hex hash of the presented key hash — safe to store and to key records by.
 * `record` is the per-customer key-index entry (null for a v1 shared plan key with no customer record);
 * `device` is the device check-in registry record (null when the device never registered).
 * Reads: revocation (1) + key index (1) + device registry (1). Never a listing (audit B14).
 */
async function verifyDeviceKey(presented, opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const open = o.openStore || openStore;
  const event = o.event || null;
  const hash = String(presented || '').trim().toLowerCase();
  if (!hash) return { ok: false, reason: 'missing' };
  if (!HEX64.test(hash)) return { ok: false, reason: 'bad-format' };
  const tenant = hash16(hash);

  // 1 — the one revocation truth (what sentinel-resolve reads and admin revoke / Stripe cancellation write).
  const revocation = await readJson(open, REVOCATIONS_STORE, hash, event);
  if (revocation && revocation.revoked !== false) return { ok: false, reason: 'revoked' };

  // 2 — the per-customer key index (v2 keys; admin-minted records).
  const recordRaw = await readJson(open, SENTINEL_LICENSE_KEYS_STORE, hash, event);
  const record = recordRaw && recordRaw.v === KEY_RECORD_V ? recordRaw : null;
  if (record && record.status === 'revoked') return { ok: false, reason: 'revoked' };

  // 3 — the device check-in registry (legacy no-secret fallback; a revoked flag there denies too).
  const device = await readJson(open, LICENSES_STORE, hash, event);
  if (device && (device.status === 'revoked' || device.revoked === true)) return { ok: false, reason: 'revoked' };

  // 4 — v1 shared plan keys derive from the secret (no store round-trip, no key on the wire).
  let plan = null;
  const secret = typeof env.SENTINEL_LICENSE_SECRET === 'string' ? env.SENTINEL_LICENSE_SECRET.trim() : '';
  if (secret) {
    for (const p of PLAN_ORDER) if (constantTimeEqual(hash, planKeyHash(p, secret))) { plan = p === 'admin-lifetime' ? 'admin' : p; break; }
  }
  // REVIEW FIX P1-2: a v1 plan key is SHARED by every customer on its plan, so whoever holds it must never be
  // able to mail a customer's address — even when a legacy record happens to hold that same key. `sharedKey`
  // tells the notify / session-report recipient rule to allow the admin inbox only.
  const sharedKey = Boolean(plan);

  if (record) return { ok: true, via: 'sentinel-license-keys', plan: recordPlan(record, plan), tenant, record, device, sharedKey };
  if (plan) return { ok: true, via: 'plan-key', plan, tenant, record: null, device, sharedKey };
  if (device) return { ok: true, via: 'licenses-store', plan: device.plan || null, tenant, record: null, device, sharedKey };
  return { ok: false, reason: 'unknown-key' };
}

/** The plan a key-index record grants now: a time-boxed trial key (tier 'trial') is Pro until expires_at, then free. */
function recordPlan(record, fallback) {
  const tier = record && record.tier ? String(record.tier) : '';
  if (tier !== 'trial') return tier || fallback;
  const ends = Date.parse(record.expires_at || record.trialEndsAt || '');
  return Number.isFinite(ends) && Date.now() < ends ? 'pro' : 'free';
}

/**
 * authenticate(event, { env, openStore }) — device key first, then an internal/admin token.
 *   → { ok:true, kind:'device'|'internal', tenant, plan?, via, record, device, sharedKey, credential }
 *   → { ok:false, status:401|503, error }
 */
async function authenticate(event, opts) {
  const presented = headerOf(event, 'x-sentinel-key');
  if (presented) {
    const r = await verifyDeviceKey(presented, Object.assign({ event }, opts || {}));
    if (r.ok) return { ok: true, kind: 'device', tenant: r.tenant, plan: r.plan, via: r.via, record: r.record || null, device: r.device || null, sharedKey: r.sharedKey === true, credential: String(presented).trim().toLowerCase() };
    return { ok: false, status: 401, error: r.reason === 'revoked' ? 'license-revoked' : 'unauthorized' };
  }
  const gate = requireAdminToken(event, { envNames: ADMIN_ENV_NAMES, allowBodyToken: false });
  if (gate.ok) return { ok: true, kind: 'internal', tenant: 'internal', plan: null, via: gate.via, record: null, device: null };
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
  PLAN_ORDER, APPROVALS_STORE, LICENSES_STORE, SENTINEL_LICENSES_STORE, SENTINEL_LICENSE_KEYS_STORE, REVOCATIONS_STORE, KEY_RECORD_V,
  APPROVAL_URL, NOTIFY_EVENTS, SEVERITIES,
  EXPIRY_MIN_MS, EXPIRY_MAX_MS, EXPIRY_DEFAULT_MS, ADMIN_ENV_NAMES, TOKEN_RE, HEX64,
  _setStoreFactory, openStore, headerOf, clientIp, approvalSecret, sha256, hash16,
  planKeyHash, verifyDeviceKey, authenticate,
  signApprovalToken, verifyApprovalToken, approvalLinks,
  clampExpiry, newApprovalId, createApprovalRecord, effectiveStatus, decideRecord, pollView,
  contentGuard, json, esc
};
