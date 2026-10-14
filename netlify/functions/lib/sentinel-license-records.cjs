// lib/sentinel-license-records.cjs — the server-side license data model shared by every Sentinel function.
//
// SENTINEL-BACKEND 2026-10-14 (audit B3 / B4 / B5 / B14). One place that knows the stores and the record shapes:
//
//   sentinel-licenses              <subscription_id>  → the admin-visible license record (email, name, tier, key,
//                                                       status, seats, key_version …) — what the admin console lists.
//   sentinel-license-keys          <sha256(key)>      → the O(1) KEY INDEX: { subscription_id, tier, status, seats,
//                                                       email, contacts, disabled … }. The device credential
//                                                       (x-sentinel-key = sha256(key)) IS this store's key, so
//                                                       notify / session-report / heartbeat / register find the
//                                                       customer in one read. No listing, no scan.
//   sentinel-licenses-revocations  <sha256(key)>      → { revoked:true, at, subscription_id, reason }. The ONE
//                                                       revocation truth: written by admin revoke + the Stripe
//                                                       subscription.deleted path, read by sentinel-resolve and by
//                                                       device auth (lib/sentinel-approvals.cjs).
//   licenses                       <sha256(key)>      → the device check-in registry (license-register): devices[],
//                                                       version_pin, rollout_override, the email the device gave.
//
// Recipient binding (B5): a device may only have mail sent to addresses the LICENSE RECORD vouches for — the
// Stripe customer email, admin-set contacts, or a colleague at the same private company domain. A public
// mailbox domain (gmail.com, outlook.com …) never counts as "same company". Where no record exists (a legacy
// v1 shared plan key with no customer record) the caller keeps its previous, caller-supplied behaviour.
'use strict';

const S = require('./sentinel-store.cjs');
const V2 = require('./sentinel-license-v2.cjs');

const STORES = Object.freeze({
  LICENSES: 'sentinel-licenses',
  KEYS: 'sentinel-license-keys',
  REVOCATIONS: 'sentinel-licenses-revocations',
  DEVICES: 'licenses',
  WALKTHROUGH: 'sentinel-walkthrough-entitlements',
  VERSIONS: 'versions',
  HEARTBEATS: 'heartbeats',
  UPDATE_EVENTS: 'update-events'
});

const KEY_RECORD_V = 'sentinel-license-key-v1';
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.ca', 'live.com', 'live.ca', 'msn.com',
  'yahoo.com', 'yahoo.ca', 'ymail.com', 'rogers.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'pm.me', 'mail.com', 'gmx.com', 'zoho.com', 'yandex.com', 'fastmail.com'
]);
const MAX_CONTACTS = 12;

const lower = (v) => String(v == null ? '' : v).trim().toLowerCase();
const nowIso = () => new Date().toISOString();

/** Normalise a contacts list to ≤12 lowercased valid emails (strings or {email}). Anything else is dropped. */
function normalizeContacts(list) {
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    const e = lower(c && typeof c === 'object' ? c.email : c);
    if (e && EMAIL_RE.test(e) && !out.includes(e)) out.push(e);
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}

/** Build the key-index entry for a license record (never stores the key — only facts needed at runtime). */
function keyIndexFromRecord(rec, extra) {
  const r = rec || {};
  return Object.assign({
    v: KEY_RECORD_V,
    subscription_id: String(r.subscription_id || ''),
    customer_id: String(r.customer_id || ''),
    tier: String(r.tier || ''),
    status: r.status === 'revoked' ? 'revoked' : 'active',
    seats: r.seats == null ? null : Number(r.seats) || null,
    key_version: Number(r.key_version) || 1,
    email: lower(r.email),
    contacts: normalizeContacts(r.contacts),
    disabled: r.disabled === true,
    walkthroughEntitled: r.walkthroughEntitled === true,
    trialEndsAt: r.trialEndsAt || null,
    issued_at: r.issued_at || '',
    revoked_at: r.revoked_at || null,
    updated_at: nowIso()
  }, extra || {});
}

/** Write (or refresh) the key-index entry for a record. Returns true only when the write succeeded. */
async function writeKeyIndex(record, event, extra) {
  if (!record || !record.key) return false;
  const store = await S.openStore(STORES.KEYS, event);
  if (!store) return false;
  return S.putJson(store, V2.keyHash(record.key), keyIndexFromRecord(record, extra));
}

/** The key-index entry for a device credential (sha256(key)), or null. */
async function loadKeyRecord(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return null;
  const store = await S.openStore(STORES.KEYS, event);
  const rec = await S.getJson(store, h);
  return rec && rec.v === KEY_RECORD_V ? rec : null;
}

/** The device-registry record (licenses store, keyed by credential), or null. */
async function loadDeviceRecord(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return null;
  const store = await S.openStore(STORES.DEVICES, event);
  const rec = await S.getJson(store, h);
  return rec && typeof rec === 'object' ? rec : null;
}

/** { revoked, record } from the revocation store for a credential. Store unreachable → { revoked:false, unknown:true }. */
async function revocationFor(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return { revoked: false, record: null, unknown: false };
  const store = await S.openStore(STORES.REVOCATIONS, event);
  if (!store) return { revoked: false, record: null, unknown: true };
  let raw = null;
  try { raw = await store.get(h, { type: 'json' }); } catch {
    try { raw = await store.get(h); } catch { raw = null; }
  }
  if (raw == null) return { revoked: false, record: null, unknown: false };
  const record = typeof raw === 'object' ? raw : { revoked: true, legacy: String(raw) };
  return { revoked: record.revoked !== false, record, unknown: false };
}

/** Write the revocation entry for a credential. Returns true only when the write succeeded. */
async function writeRevocation(credential, info, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return false;
  const store = await S.openStore(STORES.REVOCATIONS, event);
  if (!store) return false;
  return S.putJson(store, h, Object.assign({ revoked: true, at: nowIso() }, info || {}));
}

/** Remove a revocation entry (admin un-revoke). True when removed or absent; false when the store is down. */
async function clearRevocation(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return false;
  const store = await S.openStore(STORES.REVOCATIONS, event);
  if (!store) return false;
  try { if (typeof store.delete === 'function') await store.delete(h); else await store.setJSON(h, { revoked: false, at: nowIso() }); return true; } catch { return false; }
}

/** The set of lowercased emails a license record vouches for (record email + admin contacts + device-registered email). */
function allowedRecipientSet(keyRecord, deviceRecord) {
  const set = new Set();
  if (keyRecord) {
    if (keyRecord.email && EMAIL_RE.test(keyRecord.email)) set.add(lower(keyRecord.email));
    for (const c of normalizeContacts(keyRecord.contacts)) set.add(c);
  }
  if (deviceRecord && deviceRecord.email && EMAIL_RE.test(String(deviceRecord.email))) set.add(lower(deviceRecord.email));
  return set;
}

function domainOf(email) { const e = lower(email); const i = e.lastIndexOf('@'); return i > 0 ? e.slice(i + 1) : ''; }

/**
 * isAllowedRecipient(email, { keyRecord, deviceRecord }) → { ok, via }.
 *   via: 'record-email' | 'contact' | 'device-email' | 'same-domain' | null
 * Same-domain applies ONLY to a private (non-public-mailbox) domain of the record's Stripe email.
 */
function isAllowedRecipient(email, ctx) {
  const e = lower(email);
  if (!e || !EMAIL_RE.test(e)) return { ok: false, via: null };
  const keyRecord = ctx && ctx.keyRecord;
  const deviceRecord = ctx && ctx.deviceRecord;
  if (keyRecord && lower(keyRecord.email) === e) return { ok: true, via: 'record-email' };
  if (keyRecord && normalizeContacts(keyRecord.contacts).includes(e)) return { ok: true, via: 'contact' };
  if (deviceRecord && lower(deviceRecord.email) === e) return { ok: true, via: 'device-email' };
  const recDomain = keyRecord ? domainOf(keyRecord.email) : '';
  if (recDomain && !PUBLIC_MAIL_DOMAINS.has(recDomain) && domainOf(e) === recDomain) return { ok: true, via: 'same-domain' };
  return { ok: false, via: null };
}

/** Human copy for the admin console / API: what revoking a key actually does and when the device feels it. */
const REVOCATION_EFFECT = 'Notifications, approvals, session reports and device check-ins stop immediately; the desktop drops to the free tier at its next license re-check (within 24 hours), or at once when it is relaunched.';

module.exports = {
  STORES, KEY_RECORD_V, EMAIL_RE, PUBLIC_MAIL_DOMAINS, MAX_CONTACTS, REVOCATION_EFFECT,
  normalizeContacts, keyIndexFromRecord, writeKeyIndex, loadKeyRecord, loadDeviceRecord,
  revocationFor, writeRevocation, clearRevocation, allowedRecipientSet, isAllowedRecipient, domainOf
};
