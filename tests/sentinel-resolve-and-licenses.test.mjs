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

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET', 'SENTINEL_RESOLVE_SIGNING_KEY', 'SENTINEL_ADMIN_INBOX']) delete process.env[k];
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

// ---- in-memory Blobs (get without type returns the raw string; set/setJSON/list/delete) + read/list counters
const stores = new Map();
let blobsDown = false;
let downOnly = null; // a single store name that is unreachable
const io = { reads: 0, lists: 0 };
function memStore(name) {
  if (blobsDown || name === downOnly) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { io.reads++; const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async set(k, v) { m.set(k, String(v)); },
      async delete(k) { m.delete(k); },
      async list() { io.lists++; return { blobs: [...m.keys()].map((key) => ({ key })) }; },
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
  const r = await resolve.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': extra.ip || `203.0.113.${++ipSeq % 250}`, ...(extra.headers || {}) }, body: JSON.stringify(email ? { key, email } : { key }) });
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
}

console.log('[review P2-2] resolve never reads a caller-supplied email: no entitlement, no buyer oracle');
{
  // a real Concierge buyer's entitlement record, exactly as the webhook writes it (keyed by lowercased email)
  await memStore('sentinel-walkthrough-entitlements').setJSON('ceo@victim-corp.example', { walkthroughEntitled: true, trialEndsAt: new Date(Date.now() + 20 * 86400000).toISOString(), email: 'ceo@victim-corp.example' });
  const shared = issuePlanKey('personal', SECRET); // the v1 key every Personal customer holds
  const norm = (j) => { const c = JSON.parse(JSON.stringify(j)); delete c.verified_at; if (c.verdict) delete c.verdict.verified_at; return JSON.stringify(c); };
  const none = await post(shared, '');
  const victim = await post(shared, 'CEO@Victim-Corp.example');
  const nobody = await post(shared, 'nobody@nowhere.example');
  ok('the shared Personal key + a Concierge buyer\'s email → still personal, walkthroughEntitled:false, trialEndsAt:null', victim.status === 200 && victim.json.plan === 'personal' && victim.json.walkthroughEntitled === false && victim.json.trialEndsAt === null);
  ok('known email, unknown email and no email get byte-identical answers (timestamps aside) — the endpoint is not a buyer oracle', norm(none.json) === norm(victim.json) && norm(victim.json) === norm(nobody.json));
  // the KEY's own record still carries a Walk-Through (legacy Concierge record on a v2 Personal key)
  const own = V2.issueCustomerKey({ plan: 'personal', seed: 'cs_legacy_wt', secret: SECRET });
  await memStore('sentinel-license-keys').setJSON(keyHash(own), { v: 'sentinel-license-key-v1', subscription_id: 'cs_legacy_wt', tier: 'personal', status: 'active', walkthroughEntitled: true, trialEndsAt: new Date(Date.now() + 5 * 86400000).toISOString() });
  const mine = await post(own, 'someone-else@example.com');
  ok('…entitlement comes only from the key\'s own record: its Walk-Through + Pro window, whatever email is sent', mine.json.walkthroughEntitled === true && mine.json.plan === 'pro' && mine.json.trialEndsAt);
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
  // no revocation entry, but the key's own index entry says revoked (what revokeKeyHash / revoke write) → still revoked
  memStore('sentinel-licenses-revocations')._m.clear();
  const viaIndex = await admin('is-revoked', { query: { 'key-hash': keyHash(planKey) } });
  ok('is-revoked also answers from the key index (O(1), no record scan) — a revoked index entry → {revoked:true}', viaIndex.json.revoked === true);
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

// ===================================================================== SENTINEL REVIEW FIXES 2026-10-14
const { verifyResolveSignature, verdictPayload, VERDICT_KEYS } = await import('../ARIA Sentinel/src/shared/sentinel-resolve-pubkey.mjs');
const R = require_('../netlify/functions/lib/sentinel-license-records.cjs');

console.log('[review P1-3] every 200 carries the verdict; signed with SENTINEL_RESOLVE_SIGNING_KEY, unsigned (and says so) without');
{
  const key = V2.issueCustomerKey({ plan: 'pro', seed: 'sub_sig_1', secret: SECRET });
  await memStore('sentinel-license-keys').setJSON(keyHash(key), { v: 'sentinel-license-key-v1', subscription_id: 'sub_sig_1', tier: 'pro', status: 'active', seats: 5 });
  const DEV = 'abcdef0123456789abcdef0123456789';
  const unsigned = await post(key, '', { headers: { 'X-Sentinel-Device': DEV } });
  const v = unsigned.json.verdict;
  ok('verdict = {key_sha256, plan, status, seats, expires_at, verified_at, device} in EXACTLY that order', JSON.stringify(Object.keys(v)) === JSON.stringify(VERDICT_KEYS) && JSON.stringify(v) === verdictPayload(v));
  ok('…with the real values: sha256 of the key as sent, pro, active, seats 5, expires_at null, the device header', v.key_sha256 === keyHash(key) && v.plan === 'pro' && v.status === 'active' && v.seats === 5 && v.expires_at === null && v.verified_at === unsigned.json.verified_at && v.device === DEV);
  ok('no SENTINEL_RESOLVE_SIGNING_KEY → no sig, signing:"unconfigured" (the desktop treats it as short-lived)', !('sig' in unsigned.json) && unsigned.json.signing === 'unconfigured');
  ok('no device header → verdict.device ""', (await post(key)).json.verdict.device === '');
  // A THROWAWAY pair — the real private key lives only in Netlify env and is never in this repo or this test.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  process.env.SENTINEL_RESOLVE_SIGNING_KEY = pkcs8;
  const logs = [];
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => { logs.push(a.join(' ')); }; console.error = (...a) => { logs.push(a.join(' ')); };
  let signed;
  try { signed = await post(key, '', { headers: { 'x-sentinel-device': DEV } }); } finally { console.log = origLog; console.error = origErr; }
  ok('with the signing key: sig present, no "signing" flag', typeof signed.json.sig === 'string' && signed.json.sig.length === 86 && !('signing' in signed.json));
  ok('the sig verifies with the app verifier (sentinel-resolve-pubkey.mjs) under the matching public key', verifyResolveSignature(signed.json.verdict, signed.json.sig, spki) === true);
  ok('…and is the Ed25519 signature of JSON.stringify(verdict) (crypto.verify directly)', crypto.verify(null, Buffer.from(JSON.stringify(signed.json.verdict)), crypto.createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signed.json.sig, 'base64url')));
  ok('a verdict edited after signing (plan → admin) does not verify', verifyResolveSignature({ ...signed.json.verdict, plan: 'admin' }, signed.json.sig, spki) === false);
  ok('the private key never appears in the response or the logs', !JSON.stringify(signed.json).includes(pkcs8) && !logs.join('\n').includes(pkcs8) && logs.some((l) => /signed\)/.test(l)));
  const revokedKey = V2.issueCustomerKey({ plan: 'smb', seed: 'sub_sig_rev', secret: SECRET });
  await memStore('sentinel-licenses-revocations').setJSON(keyHash(revokedKey), { revoked: true });
  const rv = await post(revokedKey);
  ok('a revoked key gets a signed verdict too (status revoked) — the desktop can trust the downgrade', rv.json.status === 'revoked' && rv.json.verdict.status === 'revoked' && verifyResolveSignature(rv.json.verdict, rv.json.sig, spki));
  downOnly = 'sentinel-licenses-revocations';
  const errs0 = [];
  console.error = (...a) => { errs0.push(a.join(' ')); };
  let withheld;
  try { withheld = await post(key); } finally { console.error = origErr; }
  ok('revocation store unreadable → still 200 but UNSIGNED, signing:"withheld" (never a 24 h signed "active" for an unchecked key)', withheld.status === 200 && !('sig' in withheld.json) && withheld.json.signing === 'withheld' && withheld.json.revocationChecked === false && errs0.some((l) => /left UNSIGNED/.test(l)));
  downOnly = null;
  process.env.SENTINEL_RESOLVE_SIGNING_KEY = 'bm90LWEta2V5'; // set but not a PKCS#8 Ed25519 key
  const errs = [];
  console.error = (...a) => { errs.push(a.join(' ')); };
  let bad;
  try { bad = await post(key); } finally { console.error = origErr; }
  ok('a set-but-unparseable signing key → 500 server-misconfigured, signing:"misconfigured" (fail closed), the value never echoed', bad.status === 500 && bad.json.status === 'server-misconfigured' && bad.json.signing === 'misconfigured' && !JSON.stringify(bad.json).includes('bm90LWEta2V5') && !errs.join(' ').includes('bm90LWEta2V5'));
  delete process.env.SENTINEL_RESOLVE_SIGNING_KEY;
}

console.log('[review P1-3] server-anchored trial: first sight of a device is recorded once and returned as trialStartedAt');
{
  const key = V2.issueCustomerKey({ plan: 'personal', seed: 'sub_anchor', secret: SECRET });
  const DEV = '0123456789abcdef0123456789abcdef';
  const first = await post(key, '', { headers: { 'x-sentinel-device': DEV } });
  const anchors = memStore('sentinel-trial-anchors')._m;
  ok('first resolve from a device → trialStartedAt (ISO) and one anchor trial-anchor/<device>', typeof first.json.trialStartedAt === 'string' && Number.isFinite(Date.parse(first.json.trialStartedAt)) && anchors.has('trial-anchor/' + DEV));
  ok('the anchor stores ONLY first_seen_at (content-blind: the device hash is the only identifier)', JSON.stringify(Object.keys(JSON.parse(anchors.get('trial-anchor/' + DEV)))) === JSON.stringify(['first_seen_at']));
  const again = await post(key, '', { headers: { 'x-sentinel-device': DEV } });
  ok('a later resolve returns the SAME first-seen time', again.json.trialStartedAt === first.json.trialStartedAt);
  anchors.set('trial-anchor/' + DEV, JSON.stringify({ first_seen_at: '2026-01-02T03:04:05.000Z' }));
  ok('an existing anchor is never overwritten (an older anchor stays the answer)', (await post(key, '', { headers: { 'x-sentinel-device': DEV } })).json.trialStartedAt === '2026-01-02T03:04:05.000Z');
  const nAnchors = anchors.size;
  ok('no device header → trialStartedAt null, nothing stored', (await post(key)).json.trialStartedAt === null && anchors.size === nAnchors);
  const fallback = await post(key, '', { headers: { 'x-sentinel-device': 'device' } });
  ok('a non-hash device value ("device", the desktop\'s fallback) → echoed in the verdict but never anchored', fallback.json.trialStartedAt === null && fallback.json.verdict.device === 'device' && anchors.size === nAnchors);
  downOnly = 'sentinel-trial-anchors';
  const blip = await post(key, '', { headers: { 'x-sentinel-device': 'ffffffffffffffffffffffffffffffff' } });
  ok('anchor store unreachable → trialStartedAt null (never an invented date), the license answer still 200', blip.status === 200 && blip.json.trialStartedAt === null && blip.json.status === 'active');
  downOnly = null;
}

console.log('[review P2-3] is-revoked: O(1) by key hash, no scan on a miss, durable per-IP / per-key limit');
{
  const lic = memStore('sentinel-licenses');
  for (let i = 0; i < 2000; i++) lic._m.set('sub_bulk_' + i, JSON.stringify({ subscription_id: 'sub_bulk_' + i, key: i.toString(16).padStart(64, '0'), status: 'active' }));
  io.reads = 0; io.lists = 0;
  const miss = await admin('is-revoked', { query: { 'key-hash': 'f'.repeat(64) }, token: null });
  ok('a miss at 2,000 records → {revoked:false} with ≤ 4 Blobs reads and ZERO listings (was 2,002 reads)', miss.status === 200 && miss.json.revoked === false && io.reads <= 4 && io.lists === 0);
  for (const k of [...lic._m.keys()].filter((k) => k.startsWith('sub_bulk_'))) lic._m.delete(k);
  const kh = 'e'.repeat(64);
  let last = null;
  for (let i = 0; i < 61; i++) last = await admin('is-revoked', { query: { 'key-hash': kh }, token: null });
  ok('the 61st check of one key-hash in an hour → 429 (durable Blobs counter, not per instance)', last.status === 429 && last.json.error === 'rate_limited');
  downOnly = 'sentinel-rate-limits';
  const closed = await admin('is-revoked', { query: { 'key-hash': 'd'.repeat(64) }, token: null });
  ok('limiter store unreachable → 503 rate-limiter-unavailable (fail closed)', closed.status === 503 && closed.json.error === 'rate-limiter-unavailable');
  downOnly = 'sentinel-license-keys';
  ok('key index unreachable → 503, never a guessed {revoked:false}', (await admin('is-revoked', { query: { 'key-hash': 'c'.repeat(64) }, token: null })).status === 503);
  downOnly = null;
}

console.log('[review P1-2] approve-contact: the only way a non-buyer address becomes a recipient');
{
  const a = await admin('addManual', { method: 'POST', body: { email: 'owner@acme.example', name: 'Acme', tier: 'pro' } });
  const rec = await memStore('sentinel-licenses').get(a.json.subscription_id, { type: 'json' });
  const cred = keyHash(rec.key);
  await memStore('licenses').setJSON(cred, { key_hash: cred, email: 'helper@else.example', devices: [], pending_contacts: [{ email: 'helper@else.example', first_seen_at: '2026-10-14T00:00:00.000Z' }] });
  const before = await memStore('sentinel-license-keys').get(cred, { type: 'json' });
  ok('a pending (self-registered) address is not a recipient yet', R.isAllowedRecipient('helper@else.example', { keyRecord: before }).ok === false);
  ok('approve-contact needs the admin token', (await admin('approve-contact', { method: 'POST', body: { key_hash: cred, email: 'helper@else.example' }, token: null })).status === 401);
  const ap = await admin('approve-contact', { method: 'POST', body: { key_hash: cred, email: 'Helper@Else.example' } });
  const after = await memStore('sentinel-license-keys').get(cred, { type: 'json' });
  const recAfter = await memStore('sentinel-licenses').get(a.json.subscription_id, { type: 'json' });
  ok('by key_hash → 200 {approved, contact_approved_at}, the record + key index carry the contact, the pending entry is cleared', ap.status === 200 && ap.json.approved.email === 'helper@else.example' && ap.json.contact_approved_at && recAfter.contact_approved_at === ap.json.contact_approved_at && recAfter.contact_approvals.length === 1 && after.contacts.includes('helper@else.example') && ap.json.pendingCleared === true && (await memStore('licenses').get(cred, { type: 'json' })).pending_contacts.length === 0);
  ok('…and now it IS a recipient', R.isAllowedRecipient('helper@else.example', { keyRecord: after }).via === 'approved-contact');
  const ph = await admin('approve-contact', { method: 'POST', body: { subscription_id: a.json.subscription_id, phone: '+1 (416) 555-0000' } });
  ok('by subscription_id with a phone → contact_phones normalised and indexed', ph.status === 200 && (await memStore('sentinel-license-keys').get(cred, { type: 'json' })).contact_phones[0] === '+14165550000');
  const v1cred = keyHash(issuePlanKey('pro', SECRET));
  ok('a shared v1 plan credential → 409 shared-plan-key (admin inbox only, never contacts)', (await admin('approve-contact', { method: 'POST', body: { key_hash: v1cred, email: 'x@y.example' } })).json.error === 'shared-plan-key');
  ok('a credential with no license record → 404 no-license-record', (await admin('approve-contact', { method: 'POST', body: { key_hash: 'b'.repeat(64), email: 'x@y.example' } })).json.error === 'no-license-record');
  ok('a bad email → 400; neither email nor phone → 400', (await admin('approve-contact', { method: 'POST', body: { key_hash: cred, email: 'not-an-email' } })).status === 400 && (await admin('approve-contact', { method: 'POST', body: { key_hash: cred } })).status === 400);
  ok('addManual refuses the server-only trial tier (trial keys come only from a Walk-Through purchase)', (await admin('addManual', { method: 'POST', body: { email: 't@example.com', tier: 'trial' } })).status === 400);
}

console.log(`sentinel-resolve-and-licenses: ${pass} checks green — shared key scheme (admin + admin-lifetime), v2 keys, revoke→resolve revoked, honest shared-key enforcement, 503 JSON on store loss, addManual v2 + key index + honest email results; email never read by resolve; signed verdicts (throwaway pair) + unsigned flag + fail-closed bad key; trial anchor written once; is-revoked O(1) + durable limit; approve-contact.`);
