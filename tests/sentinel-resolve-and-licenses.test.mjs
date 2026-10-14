#!/usr/bin/env node
// sentinel-resolve-and-licenses.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B1 / B3 / B4 / B9 / B17).
// Runs the DEPLOYED handlers (netlify/functions/sentinel-resolve.mjs + sentinel-licenses.mjs) against an
// in-memory Blobs store — the thing the audit found nobody tested:
//   - an admin key minted by the SHARED module (issuePlanKey('admin')) resolves to plan admin (B9), and the
//     emergency resolve's "admin-lifetime" key still does too;
//   - a v2 per-customer key resolves with keyVersion 2; a forged key is 401; a malformed one 400;
//   - admin Revoke writes the revocation entry sentinel-resolve reads → the SAME key then resolves
//     status:"revoked" (B4 — the gap that let revoked customers keep full access);
//   - a shared v1 plan key with another ACTIVE record is NOT cut off and the response says so (Rule 14);
//   - store unreachable → 503 JSON {reason:'store-unavailable'}, no stack; resolve stays fail-open;
//   - addManual mints a v2 key, writes the key index, and reports email delivery honestly.
// fetch is stubbed (nothing leaves the process); Resend is "configured" only where the test says so.
//   node tests/sentinel-resolve-and-licenses.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { issuePlanKey, keyHash } from '../ARIA Sentinel/src/shared/license-features.mjs';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.SENTINEL_ADMIN_TOKEN = 'admin-token-0123456789';
const SECRET = process.env.SENTINEL_LICENSE_SECRET;

const mails = [];
let resendMode = 'ok';
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify(resendMode === 'ok' ? { id: 'msg_' + mails.length } : { message: 'nope' }), { status: resendMode === 'ok' ? 200 : 500 });
  }
  throw new Error('unexpected network call in test: ' + u);
};

// ---- in-memory Blobs (get without type returns the raw string; set/setJSON/list/delete)
const stores = new Map();
let blobsDown = false;
function memStore(name) {
  if (blobsDown) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async set(k, v) { m.set(k, String(v)); },
      async delete(k) { m.delete(k); },
      async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const S = require_('../netlify/functions/lib/sentinel-store.cjs');
S._setStoreFactory((name) => memStore(name));
require_('../netlify/functions/lib/sentinel-approvals.cjs')._setStoreFactory((name) => memStore(name)); // one-process registry safety
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const resolve = await import('../netlify/functions/sentinel-resolve.mjs');
const licenses = await import('../netlify/functions/sentinel-licenses.mjs');

let ipSeq = 0;
const post = async (key, email, extra = {}) => {
  const r = await resolve.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': extra.ip || `203.0.113.${++ipSeq % 250}` }, body: JSON.stringify(email ? { key, email } : { key }) });
  return { status: r.statusCode, json: JSON.parse(r.body), headers: r.headers };
};
const admin = async (action, { method = 'GET', body, query = {}, token = process.env.SENTINEL_ADMIN_TOKEN } = {}) => {
  const r = await licenses.handler({ httpMethod: method, headers: { 'content-type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }, queryStringParameters: { action, ...query }, body: body ? JSON.stringify(body) : '' });
  let json = null; try { json = JSON.parse(r.body); } catch { json = null; }
  return { status: r.statusCode, json, raw: r.body, headers: r.headers };
};

console.log('[resolve] contract shapes');
{
  ok('OPTIONS → 204', (await resolve.handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode === 204);
  ok('GET → 405 method-not-allowed', (await resolve.handler({ httpMethod: 'GET', headers: {} })).statusCode === 405);
  const bad = await post('not-a-key');
  ok('malformed key → 400 bad-key-format', bad.status === 400 && bad.json.status === 'bad-key-format');
  const forged = await post('f'.repeat(64));
  ok('forged 64-hex → 401 invalid', forged.status === 401 && forged.json.status === 'invalid');
  const saved = process.env.SENTINEL_LICENSE_SECRET; delete process.env.SENTINEL_LICENSE_SECRET;
  ok('no secret → 500 server-misconfigured', (await post('a'.repeat(64))).status === 500);
  process.env.SENTINEL_LICENSE_SECRET = saved;
}

console.log('[resolve] the shared key scheme (B9) + v2 keys (B3)');
{
  const adminKey = issuePlanKey('admin', SECRET);
  const r = await post(adminKey);
  ok('shared-module admin key ("sentinel-license:v1:admin") → plan admin, active, keyVersion 1', r.status === 200 && r.json.plan === 'admin' && r.json.status === 'active' && r.json.keyVersion === 1);
  const legacy = crypto.createHmac('sha256', SECRET).update('sentinel-license:v1:admin-lifetime').digest('hex');
  const l = await post(legacy);
  ok('emergency "admin-lifetime" admin key still → plan admin (alias kept)', l.status === 200 && l.json.plan === 'admin');
  for (const plan of ['personal', 'pro', 'smb', 'midsize', 'enterprise']) {
    const x = await post(issuePlanKey(plan, SECRET));
    assert.equal(x.json.plan, plan, `v1 ${plan} key resolves`);
  }
  ok('all five v1 client plan keys still resolve (Rule 15)', true);
  const v2 = V2.issueCustomerKey({ plan: 'pro', customerId: 'sub_v2_1', secret: SECRET });
  const v = await post(v2);
  ok('a v2 per-customer key → plan pro, active, keyVersion 2, response shape kept (verified_at, walkthroughEntitled, trialEndsAt)', v.status === 200 && v.json.plan === 'pro' && v.json.status === 'active' && v.json.keyVersion === 2 && typeof v.json.verified_at === 'string' && v.json.walkthroughEntitled === false && v.json.trialEndsAt === null);
  ok('CORS/cache headers unchanged', v.headers['cache-control'] === 'no-store' && v.headers['access-control-allow-origin'] === '*');
  ok('the raw key never appears in the response', !JSON.stringify(v.json).includes(v2));
  // walkthrough entitlement by email (unchanged behaviour)
  await memStore('sentinel-walkthrough-entitlements').setJSON('buyer@example.com', { walkthroughEntitled: true, trialEndsAt: new Date(Date.now() + 10 * 86400000).toISOString() });
  const wt = await post(issuePlanKey('personal', SECRET), 'Buyer@Example.com');
  ok('Concierge entitlement by email still lifts Personal → Pro during the trial', wt.json.plan === 'pro' && wt.json.walkthroughEntitled === true && wt.json.trialEndsAt);
}

console.log('[licenses] store unreachable → 503 JSON, never a stack (B1/B17)');
{
  blobsDown = true;
  const r = await admin('is-revoked', { query: { 'key-hash': 'a'.repeat(64) } });
  ok('is-revoked with Blobs down → 503 {ok:false, reason:store-unavailable}', r.status === 503 && r.json.ok === false && r.json.reason === 'store-unavailable');
  ok('no stack trace / internal path in the body', !/var\/task|errorType|at /.test(r.raw));
  const l = await admin('list');
  ok('admin list with Blobs down → 503 (not 502)', l.status === 503);
  const rr = await post(issuePlanKey('pro', SECRET));
  ok('resolve stays fail-open while Blobs is down (active, revocationChecked:false)', rr.status === 200 && rr.json.status === 'active' && rr.json.revocationChecked === false);
  blobsDown = false;
}

console.log('[licenses] admin gate + addManual mints a v2 key');
{
  ok('no token → 401', (await admin('list', { token: null })).status === 401);
  ok('wrong token → 401', (await admin('list', { token: 'wrong-token-0123456789' })).status === 401);
  const bearer = await licenses.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer ' + process.env.SENTINEL_ADMIN_TOKEN }, queryStringParameters: { action: 'list' } });
  ok('Bearer token works too', bearer.statusCode === 200);
  ok('unknown action → 400', (await admin('nope')).status === 400);
  const noEmail = await admin('addManual', { method: 'POST', body: { tier: 'pro' } });
  ok('addManual without email → 400', noEmail.status === 400);
  const a = await admin('addManual', { method: 'POST', body: { email: 'Org@Acme.example', name: 'Acme', tier: 'small_business', seats: 25, contacts: ['it@acme.example'] } });
  ok('addManual → 200 with subscription_id, keyVersion 2, key NOT echoed, emailed honestly {customer:false, admin:false} (Resend unset)', a.status === 200 && a.json.subscription_id.startsWith('manual_') && a.json.keyVersion === 2 && a.json.record.key === undefined && a.json.emailed.customer === false && a.json.emailed.admin === false);
  const rec = await memStore('sentinel-licenses').get(a.json.subscription_id, { type: 'json' });
  ok('the stored record holds a 64-hex v2 key for tier smb with seats 25 + contacts', /^[a-f0-9]{64}$/.test(rec.key) && rec.key_version === 2 && rec.tier === 'smb' && rec.seats === 25 && rec.contacts[0] === 'it@acme.example' && rec.status === 'active');
  ok('the key really is a v2 key bound to this record', V2.verifyCustomerKey(rec.key, SECRET).plan === 'smb');
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('the O(1) key index is written under sha256(key) with email/tier/seats/contacts and no key', idx && idx.v === 'sentinel-license-key-v1' && idx.email === 'org@acme.example' && idx.tier === 'smb' && idx.seats === 25 && idx.contacts[0] === 'it@acme.example' && !JSON.stringify(idx).includes(rec.key));
  const r = await post(rec.key);
  ok('the minted v2 key resolves: plan smb, seats 25', r.status === 200 && r.json.plan === 'smb' && r.json.seats === 25);
  // with Resend configured the customer email carries the key and the admin email a masked one
  process.env.RESEND_API_KEY = 're_test'; process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';
  mails.length = 0;
  const b = await admin('addManual', { method: 'POST', body: { email: 'solo@example.com', tier: 'personal' } });
  ok('with Resend configured → emailed {customer:true, admin:true}', b.json.emailed.customer === true && b.json.emailed.admin === true);
  const recB = await memStore('sentinel-licenses').get(b.json.subscription_id, { type: 'json' });
  ok('customer mail carries the full key; admin mail only a masked key', mails[0].to === 'solo@example.com' && mails[0].text.includes(recB.key) && mails[1].to === 'ahmad.wasee@iisupp.net' && !mails[1].text.includes(recB.key));
  ok('personal defaults to 1 seat', recB.seats === 1);
  const list = await admin('list', { query: { q: 'acme' } });
  ok('list filters by email/name (record email kept as given; the index lowercases it)', list.status === 200 && list.json.records.length === 1 && list.json.records[0].email.toLowerCase() === 'org@acme.example');
  const csv = await admin('exportCsv');
  ok('CSV export masks keys', csv.status === 200 && csv.headers['content-type'] === 'text/csv' && !csv.raw.includes(rec.key) && /org@acme\.example/i.test(csv.raw));
  resendMode = 'fail';
  const rs = await admin('resend', { method: 'POST', body: { subscription_id: b.json.subscription_id } });
  ok('resend with a Resend failure → 500 registry error (never "resent")', rs.status === 500);
  resendMode = 'ok';
  delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM;
  const rs2 = await admin('resend', { method: 'POST', body: { subscription_id: b.json.subscription_id } });
  ok('resend with email unconfigured → 503 {resent:false, reason:email-not-configured} (Rule 14)', rs2.status === 503 && rs2.json.resent === false);
}

console.log('[B4] revoke writes what resolve reads');
{
  const a = await admin('addManual', { method: 'POST', body: { email: 'rev@example.com', tier: 'pro' } });
  const rec = await memStore('sentinel-licenses').get(a.json.subscription_id, { type: 'json' });
  ok('before revoke: active', (await post(rec.key)).json.status === 'active');
  const rv = await admin('revoke', { method: 'POST', body: { subscription_id: a.json.subscription_id } });
  ok('revoke → 200, record revoked, key not echoed, enforced:true with the honest effect copy', rv.status === 200 && rv.json.record.status === 'revoked' && rv.json.record.key === undefined && rv.json.enforced === true && /24 hours/.test(rv.json.enforcement));
  const entry = await memStore('sentinel-licenses-revocations').get(keyHash(rec.key), { type: 'json' });
  ok('the revocation entry exists under sha256(key) in the store sentinel-resolve reads', entry && entry.revoked === true && entry.reason === 'admin-revoke');
  const after = await post(rec.key);
  ok('the SAME key now resolves status:"revoked" (plan still named)', after.status === 200 && after.json.status === 'revoked' && after.json.plan === 'pro');
  const isRev = await admin('is-revoked', { query: { 'key-hash': keyHash(rec.key) } });
  ok('is-revoked (public, O(1)) → {revoked:true}', isRev.status === 200 && isRev.json.revoked === true);
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('key index status flipped to revoked', idx.status === 'revoked');
  const again = await admin('revoke', { method: 'POST', body: { subscription_id: a.json.subscription_id } });
  ok('revoking twice is idempotent', again.status === 200 && again.json.record.status === 'revoked');
  const un = await admin('unrevoke', { method: 'POST', body: { subscription_id: a.json.subscription_id } });
  ok('unrevoke → active again, revocation cleared', un.status === 200 && un.json.record.status === 'active' && un.json.revocationCleared === true && (await post(rec.key)).json.status === 'active');
  ok('revoke of an unknown id → 404', (await admin('revoke', { method: 'POST', body: { subscription_id: 'sub_nope' } })).status === 404);
  // uppercase paste of a revoked key must not slip past revocation
  await admin('revoke', { method: 'POST', body: { subscription_id: a.json.subscription_id } });
  ok('an UPPER-cased paste of a revoked key still resolves revoked', (await post(rec.key.toUpperCase())).json.status === 'revoked');
}

console.log('[B4] shared v1 plan keys: honest, not silent');
{
  const planKey = issuePlanKey('pro', process.env.SENTINEL_LICENSE_SECRET);
  await memStore('sentinel-licenses').setJSON('sub_legacy_1', { email: 'one@example.com', name: 'One', tier: 'pro', key: planKey, subscription_id: 'sub_legacy_1', status: 'active', issued_at: '2026-01-01T00:00:00.000Z' });
  await memStore('sentinel-licenses').setJSON('sub_legacy_2', { email: 'two@example.com', name: 'Two', tier: 'pro', key: planKey, subscription_id: 'sub_legacy_2', status: 'active', issued_at: '2026-01-02T00:00:00.000Z' });
  const r1 = await admin('revoke', { method: 'POST', body: { subscription_id: 'sub_legacy_1' } });
  ok('revoking ONE of two records on the shared v1 Pro key → record revoked but enforced:false, reason names the active sibling', r1.status === 200 && r1.json.record.status === 'revoked' && r1.json.enforced === false && r1.json.activeSiblings === 1 && /shared-plan-key/.test(r1.json.enforcement));
  ok('…and the shared key keeps resolving active (the other customer is not cut off)', (await post(planKey)).json.status === 'active');
  const r2 = await admin('revoke', { method: 'POST', body: { subscription_id: 'sub_legacy_2' } });
  ok('revoking the last active holder → enforced:true, the key is cut off', r2.json.enforced === true && (await post(planKey)).json.status === 'revoked');
  memStore('sentinel-licenses-revocations')._m.clear();
  await memStore('sentinel-licenses').setJSON('sub_legacy_2', { email: 'two@example.com', name: 'Two', tier: 'pro', key: planKey, subscription_id: 'sub_legacy_2', status: 'active', issued_at: '2026-01-02T00:00:00.000Z' });
  const kh = await admin('revokeKeyHash', { method: 'POST', body: { key_hash: keyHash(planKey), reason: 'leaked on a forum' } });
  ok('revokeKeyHash cuts a credential off explicitly and marks every record holding it', kh.status === 200 && kh.json.enforced === true && kh.json.recordsMarked === 1 && (await post(planKey)).json.status === 'revoked');
  ok('revokeKeyHash with a bad hash → 400', (await admin('revokeKeyHash', { method: 'POST', body: { key_hash: 'zz' } })).status === 400);
  // legacy is-revoked scan still answers for a record with no revocation entry
  memStore('sentinel-licenses-revocations')._m.clear();
  const legacyScan = await admin('is-revoked', { query: { 'key-hash': keyHash(planKey) } });
  ok('is-revoked legacy scan fallback still works (record-level status) — Rule 15', legacyScan.json.revoked === true);
  ok('is-revoked with a bad hash → 400', (await admin('is-revoked', { query: { 'key-hash': 'nope' } })).status === 400);
}

console.log('[licenses] setFlags (disabled / contacts / seats)');
{
  const a = await admin('addManual', { method: 'POST', body: { email: 'flags@example.com', tier: 'midsize' } });
  const f = await admin('setFlags', { method: 'POST', body: { subscription_id: a.json.subscription_id, disabled: true, contacts: ['ops@flags.example', 'not-an-email', 'ops@flags.example'], seats: 40 } });
  ok('setFlags → disabled:true, deduped valid contacts, seats 40, indexed', f.status === 200 && f.json.record.disabled === true && f.json.record.contacts.length === 1 && f.json.record.seats === 40 && f.json.indexed === true);
  const rec = await memStore('sentinel-licenses').get(a.json.subscription_id, { type: 'json' });
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('the key index carries the flags the heartbeat / notify read', idx.disabled === true && idx.contacts[0] === 'ops@flags.example' && idx.seats === 40);
  ok('setFlags on an unknown id → 404', (await admin('setFlags', { method: 'POST', body: { subscription_id: 'nope', disabled: true } })).status === 404);
}

console.log('[resolve] rate limit (Blobs-backed, fail-open)');
{
  const key = issuePlanKey('personal', process.env.SENTINEL_LICENSE_SECRET);
  let last = null;
  for (let i = 0; i < 11; i++) last = await post(key, '', { ip: '198.51.100.7' });
  ok('11th POST from one IP in 5 minutes → 429 rate-limited', last.status === 429 && last.json.status === 'rate-limited');
}

console.log(`sentinel-resolve-and-licenses: ${pass} checks green — shared key scheme (admin + admin-lifetime), v2 keys, revoke→resolve revoked, honest shared-key enforcement, 503 JSON on store loss, addManual v2 + key index + honest email results.`);
