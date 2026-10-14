// lib/sentinel-license-v2.cjs — per-customer ARIA Sentinel license keys (key scheme v2) + the one resolver
// that understands every key the server has ever issued. SERVER-SIDE ONLY: needs SENTINEL_LICENSE_SECRET.
//
// SENTINEL-BACKEND 2026-10-14 (audit B3). A v1 key is HMAC(secret, "sentinel-license:v1:<plan>") — exactly six
// keys exist in the world, one per plan, shared by every customer on that plan: a leak unlocks the tier for
// everyone and one customer can never be revoked without revoking all of them. v2 binds the key to a customer.
//
//   v2 key  =  <code2> <cust16> <tag46>          (64 lowercase hex — same shape as a v1 key)
//     code2  = the plan code (01 personal · 02 pro · 03 smb · 04 midsize · 05 enterprise · 06 admin)
//     cust16 = sha256(stripe customer id | email | any stable customer seed).slice(0, 16)
//     tag46  = HMAC_SHA256(secret, "sentinel-license:v2:<plan>:<cust16>").slice(0, 46)   (184-bit tag)
//
// WHY 64 HEX AND NOT `v2.<plan>.<cust16>.<hmac32>`: the shipped desktop gates every key on /^[a-f0-9]{64}$/
// in four places (ARIA Sentinel/src/main/main.mjs — licenseKeyHash, refreshLicense, licenseStatus, enterLicense).
// A dotted key would be refused client-side before it ever reached sentinel-resolve. Keeping the 64-hex shape
// means NO desktop change: the device still POSTs the key to sentinel-resolve and sends sha256(key) as its
// x-sentinel-key credential. The plan, the customer binding and the HMAC tag are all inside the 64 hex.
//
// Verification is constant-time and fail-closed: an unknown code, a short key or a tag mismatch is null,
// never a plan. v1 keys stay valid (Rule 15) through resolveAnyKey, which also accepts the legacy
// "sentinel-license:v1:admin-lifetime" message the emergency sentinel-resolve used for the admin plan.
'use strict';

const crypto = require('node:crypto');

// Plan codes are part of the key format: NEVER renumber (a renumber invalidates every issued key).
const PLAN_CODES = Object.freeze({ personal: '01', pro: '02', smb: '03', midsize: '04', enterprise: '05', admin: '06' });
const CODE_PLANS = Object.freeze(Object.fromEntries(Object.entries(PLAN_CODES).map(([plan, code]) => [code, plan])));
const PLAN_ORDER = Object.freeze(['personal', 'pro', 'smb', 'midsize', 'enterprise', 'admin']);
const KEY_VERSION = 2;
const HEX64 = /^[a-f0-9]{64}$/;
const TAG_LEN = 46;

// Mirrors ARIA Sentinel/src/shared/pricing-tiers.mjs normalizePlan (kept dependency-free so this file loads
// from CJS and ESM alike; tests/sentinel-license-v2.test.mjs pins the two in lockstep).
const ALIASES = Object.freeze({
  personal: 'personal', individual: 'personal',
  pro: 'pro', professional: 'pro',
  smb: 'smb', 'small-business': 'smb', 'small business': 'smb', small_business: 'smb', smallbusiness: 'smb', business: 'smb',
  midsize: 'midsize', mid: 'midsize', 'mid-size': 'midsize', mid_size: 'midsize', 'mid size': 'midsize',
  enterprise: 'enterprise', ent: 'enterprise',
  admin: 'admin', 'admin-lifetime': 'admin', lifetime: 'admin', owner: 'admin'
});

/** Canonical plan name. Unknown → null (fail-closed here — the minting path must name a real plan). */
function canonicalPlan(plan) {
  const raw = String(plan == null ? '' : plan).trim().toLowerCase();
  if (!raw) return null;
  if (PLAN_CODES[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];
  if (/small/.test(raw)) return 'smb';
  if (/mid/.test(raw)) return 'midsize';
  if (/enter/.test(raw)) return 'enterprise';
  if (/admin|lifetime|owner/.test(raw)) return 'admin';
  if (/^pro/.test(raw)) return 'pro';
  if (/person/.test(raw)) return 'personal';
  return null;
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v == null ? '' : v)).digest('hex');

/** sha256(key) — the content-blind identity the device sends as x-sentinel-key, and the revocation/index key. */
function keyHash(key) { return sha256(String(key || '').trim()); }

/** The 16-hex customer component. Seed = Stripe customer id (preferred) or a lowercased email. */
function customerId16(seed) {
  return sha256(String(seed == null ? '' : seed).trim().toLowerCase()).slice(0, 16);
}

function v2Message(plan, cust16) { return `sentinel-license:v2:${plan}:${cust16}`; }

function tagFor(plan, cust16, secret) {
  return crypto.createHmac('sha256', String(secret || '')).update(v2Message(plan, cust16)).digest('hex').slice(0, TAG_LEN);
}

function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bb = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (ba.length === 0 || bb.length === 0) return false;
  if (ba.length !== bb.length) { try { crypto.timingSafeEqual(ba, ba); } catch {} return false; }
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/**
 * issueCustomerKey({ plan, customerId | email | seed, secret }) → 64-hex v2 key.
 * Throws on a missing secret or an unknown plan (minting must never silently produce a Personal key).
 */
function issueCustomerKey({ plan, customerId, email, seed, secret } = {}) {
  const s = typeof secret === 'string' ? secret.trim() : '';
  if (s.length < 16) throw new Error('license-secret-missing');
  const canonical = canonicalPlan(plan);
  if (!canonical) throw new Error('unknown-plan');
  const src = String(customerId || seed || email || '').trim();
  if (!src) throw new Error('customer-seed-missing');
  const cust16 = customerId16(src);
  return `${PLAN_CODES[canonical]}${cust16}${tagFor(canonical, cust16, s)}`;
}

/** Parse the FORMAT of a v2 key (no secret, no verification): { plan, code, cust16, tag } or null. */
function parseKeyV2(key) {
  const k = String(key || '').trim().toLowerCase();
  if (!HEX64.test(k)) return null;
  const code = k.slice(0, 2);
  const plan = CODE_PLANS[code];
  if (!plan) return null;
  return { version: KEY_VERSION, plan, code, cust16: k.slice(2, 18), tag: k.slice(18) };
}

/** Verify a v2 key: { version:2, plan, cust16 } or null. Constant-time; fail-closed. */
function verifyCustomerKey(key, secret) {
  const s = typeof secret === 'string' ? secret.trim() : '';
  if (!s) return null;
  const p = parseKeyV2(key);
  if (!p) return null;
  const expected = tagFor(p.plan, p.cust16, s);
  if (!constantTimeEqual(p.tag, expected)) return null;
  return { version: KEY_VERSION, plan: p.plan, cust16: p.cust16 };
}

/** The six v1 plan keys (HMAC "sentinel-license:v1:<plan>") — Rule 15: every v1 key the world holds stays valid. */
function v1Key(plan, secret) {
  return crypto.createHmac('sha256', String(secret || '')).update(`sentinel-license:v1:${plan}`).digest('hex');
}

/** v1 resolution incl. the legacy "admin-lifetime" message the emergency resolve signed. → { version:1, plan } | null */
function resolveV1Key(key, secret) {
  const s = typeof secret === 'string' ? secret.trim() : '';
  const k = String(key || '').trim().toLowerCase();
  if (!s || !HEX64.test(k)) return null;
  for (const plan of PLAN_ORDER) if (constantTimeEqual(k, v1Key(plan, s))) return { version: 1, plan };
  if (constantTimeEqual(k, v1Key('admin-lifetime', s))) return { version: 1, plan: 'admin', legacyMessage: 'admin-lifetime' };
  return null;
}

/**
 * resolveAnyKey(key, secret, { resolveV1 }) → { version, plan, cust16? } | null.
 * v2 first (one HMAC), then v1 (`resolveV1` may be the app's shared license-features.resolvePlanFromKey so
 * the deployed resolver and the tested module cannot drift — audit B9), then the legacy admin alias.
 */
function resolveAnyKey(key, secret, opts) {
  const v2 = verifyCustomerKey(key, secret);
  if (v2) return v2;
  const ext = opts && typeof opts.resolveV1 === 'function' ? opts.resolveV1 : null;
  if (ext) {
    let plan = null;
    try { plan = ext(String(key || '').trim(), secret); } catch { plan = null; }
    if (plan) return { version: 1, plan: canonicalPlan(plan) || String(plan) };
  }
  return resolveV1Key(key, secret);
}

/** first4…last4 for logs — never the key. */
function maskKey(key) {
  const k = String(key || '');
  return k.length < 12 ? '(short)' : `${k.slice(0, 4)}…${k.slice(-4)}`;
}

module.exports = {
  KEY_VERSION, PLAN_CODES, CODE_PLANS, PLAN_ORDER, HEX64, TAG_LEN, ALIASES,
  canonicalPlan, sha256, keyHash, customerId16, v2Message, issueCustomerKey, parseKeyV2, verifyCustomerKey,
  v1Key, resolveV1Key, resolveAnyKey, constantTimeEqual, maskKey
};
