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
// Recipient binding — SENTINEL REVIEW FIXES 2026-10-14 (P1-2) replaced the B5 rule. The review showed it was
// bypassable: any key holder could register ANY email at device check-in (aria-sentinel-license-register) and
// that address then counted as "vouched for"; a same-domain colleague counted too. Now a device may only have
// mail sent to:
//   1. the Stripe buyer email on the license record (key index `email`),
//   2. a contact an ADMIN approved (setFlags / addManual contacts, or sentinel-licenses action=approve-contact),
//   3. the IIS admin inbox (ADMIN_INBOXES).
// A self-registered check-in email is stored as PENDING and is never a recipient until an admin approves it. A v1
// shared plan key (one key for every customer on a plan) or a credential with no license record gets NO
// caller-named recipient — the admin inbox only. Phones follow the same rule (admin-approved numbers only).
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
  UPDATE_EVENTS: 'update-events',
  // REVIEW FIXES 2026-10-14 — durable limiter counters, one-writer mint claims, server-side trial anchors.
  RATE_LIMITS: 'sentinel-rate-limits',
  MINT_CLAIMS: 'sentinel-mint-claims',
  TRIAL_ANCHORS: 'sentinel-trial-anchors'
});

// The IIS admin inbox(es) a device may always notify. SENTINEL_ADMIN_INBOX (comma list) adds to the two
// IIS-owned defaults (the funnel's ADMIN_EMAIL and the session-report company copy).
const ADMIN_INBOX_DEFAULTS = Object.freeze(['ahmad.wasee@iisupp.net', 'integrateditsupp@gmail.com']);
function adminInboxes(env) {
  const e = env || process.env;
  const extra = String(e.SENTINEL_ADMIN_INBOX || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x));
  return new Set([...ADMIN_INBOX_DEFAULTS, ...extra]);
}

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

/** A phone reduced to its digits with a leading '+' kept ("+1 (416) 555-1234" → "+14165551234"); '' if not a phone. */
function normalizePhone(p) {
  const raw = String(p == null ? '' : p).trim();
  if (!/^\+?[0-9()\-\s.]{7,20}$/.test(raw)) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return (raw.startsWith('+') ? '+' : '') + digits;
}

/** Normalise an approved-phones list to ≤12 unique normalised numbers. */
function normalizePhones(list) {
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    const p = normalizePhone(c && typeof c === 'object' ? c.phone : c);
    if (p && !out.includes(p)) out.push(p);
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
    contact_phones: normalizePhones(r.contact_phones),
    disabled: r.disabled === true,
    walkthroughEntitled: r.walkthroughEntitled === true,
    trialEndsAt: r.trialEndsAt || null,
    // REVIEW FIXES 2026-10-14: a trial key's end (P2-1) and the first unpaid-invoice time (P2-5 → resolve
    // reports status "past_due" 7 days after it) travel with the index so resolve needs one read.
    expires_at: r.expires_at || null,
    payment_failed_at: r.payment_failed_at || null,
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

/** Write a key-index entry under an explicit credential hash (a RETIRED key after a plan change — P2-5). */
async function writeKeyIndexAt(credential, record, event, extra) {
  const h = lower(credential);
  if (!V2.HEX64.test(h) || !record) return false;
  const store = await S.openStore(STORES.KEYS, event);
  if (!store) return false;
  return S.putJson(store, h, keyIndexFromRecord(record, extra));
}

/** The key-index entry for a device credential (sha256(key)), or null. */
async function loadKeyRecord(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return null;
  const store = await S.openStore(STORES.KEYS, event);
  const rec = await S.getJson(store, h);
  return rec && rec.v === KEY_RECORD_V ? rec : null;
}

/** Fail-closed variant: { ok:true, record|null } when the index answered, { ok:false } when it could not be read. */
async function loadKeyRecordStrict(credential, event) {
  const h = lower(credential);
  if (!V2.HEX64.test(h)) return { ok: true, record: null };
  const store = await S.openStore(STORES.KEYS, event);
  if (!store) return { ok: false, record: null };
  const r = await S.readJson(store, h);
  if (!r.ok) return { ok: false, record: null };
  return { ok: true, record: r.value && r.value.v === KEY_RECORD_V ? r.value : null };
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

/**
 * The set of lowercased emails a credential may have mailed (REVIEW FIX P1-2): the admin inbox always; plus, for a
 * per-customer record that is NOT a shared v1 plan key, the record's Stripe buyer email and its admin-approved
 * contacts. A device-registered (self-declared) email is never in it.
 */
function allowedRecipientSet(keyRecord, opts) {
  const set = new Set(adminInboxes(opts && opts.env));
  if (keyRecord && !(opts && opts.sharedKey)) {
    if (keyRecord.email && EMAIL_RE.test(keyRecord.email)) set.add(lower(keyRecord.email));
    for (const c of normalizeContacts(keyRecord.contacts)) set.add(c);
  }
  return set;
}

function domainOf(email) { const e = lower(email); const i = e.lastIndexOf('@'); return i > 0 ? e.slice(i + 1) : ''; }

/**
 * isAllowedRecipient(email, { keyRecord, sharedKey }) → { ok, via }.
 *   via: 'admin-inbox' | 'record-email' | 'approved-contact' | null
 * `sharedKey` = the credential is a v1 plan key (shared by every customer on that plan): admin inbox only, even
 * when a legacy record holds that key. No record → admin inbox only. `deviceRecord` is accepted for call
 * compatibility and deliberately IGNORED: a self-registered email is pending until an admin approves it.
 */
function isAllowedRecipient(email, ctx) {
  const e = lower(email);
  if (!e || !EMAIL_RE.test(e)) return { ok: false, via: null };
  if (adminInboxes(ctx && ctx.env).has(e)) return { ok: true, via: 'admin-inbox' };
  const keyRecord = ctx && ctx.keyRecord;
  if (!keyRecord || (ctx && ctx.sharedKey)) return { ok: false, via: null };
  if (lower(keyRecord.email) === e) return { ok: true, via: 'record-email' };
  if (normalizeContacts(keyRecord.contacts).includes(e)) return { ok: true, via: 'approved-contact' };
  return { ok: false, via: null };
}

/** isAllowedPhone(phone, { keyRecord, sharedKey }) → { ok, via } — admin-approved numbers on a per-customer record only. */
function isAllowedPhone(phone, ctx) {
  const p = normalizePhone(phone);
  if (!p) return { ok: false, via: null };
  const keyRecord = ctx && ctx.keyRecord;
  if (!keyRecord || (ctx && ctx.sharedKey)) return { ok: false, via: null };
  return normalizePhones(keyRecord.contact_phones).includes(p) ? { ok: true, via: 'approved-phone' } : { ok: false, via: null };
}

/**
 * Human copy for the admin console / API: what revoking a key actually does and when the device feels it
 * (REVIEW FIX P2-9). The desktop re-verifies an UNSIGNED resolve verdict within 1 hour and a signed one within 24.
 */
const REVOCATION_EFFECT = 'Notifications and approvals stop at once; the desktop drops to the free tier at its next license check (within 1 hour when the verdict is unsigned, within 24 hours when signed).';

module.exports = {
  STORES, KEY_RECORD_V, EMAIL_RE, PUBLIC_MAIL_DOMAINS, MAX_CONTACTS, REVOCATION_EFFECT, ADMIN_INBOX_DEFAULTS,
  adminInboxes, normalizeContacts, normalizePhone, normalizePhones, keyIndexFromRecord, writeKeyIndex, writeKeyIndexAt, loadKeyRecord, loadKeyRecordStrict, loadDeviceRecord,
  revocationFor, writeRevocation, clearRevocation, allowedRecipientSet, isAllowedRecipient, isAllowedPhone, domainOf
};
