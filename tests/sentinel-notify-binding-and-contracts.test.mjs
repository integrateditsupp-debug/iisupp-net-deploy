#!/usr/bin/env node
// sentinel-notify-binding-and-contracts.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B5 / B14 / B1 / B6 / B11 / B15).
//   - aria-sentinel-notify: recipients must be ones the license vouches for (403 recipients-not-registered,
//     notify() never called). REVIEW FIXES 2026-10-14 (P1-2): that is the Stripe buyer email, an admin-approved
//     contact/phone or the admin inbox — never a self-registered check-in email or a same-domain colleague; a v1
//     shared credential gets the admin inbox only; the rate bucket is the CREDENTIAL (never the caller-chosen
//     device) in memory AND in a durable Blobs counter (per credential + global, fail closed); device auth reads at
//     most three blobs (revocation, key index, device registry) and never lists a store.
//   - sentinel-crash: 503 {reason:store-unavailable} (not 500) when the store is down, stored otherwise, 413/429.
//   - stripe-checkout: a sentinel_* tier returns to /downloads/?checkout=success (not /aria), carries
//     subscription_data.metadata.tier; ARIA-web tiers are untouched.
//   - netlify.toml: the two HELD force-404 rules precede the /sentinel-binaries/* rewrite; /aria-sentinel/* and
//     /sentinel-admin point at live pages (302), never at files that do not exist.
//   node tests/sentinel-notify-binding-and-contracts.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SMTP_APP_PASSWORD', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'SENTINEL_APPROVAL_SECRET', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET', 'SENTINEL_NOTIFY_PER_HOUR', 'SENTINEL_NOTIFY_GLOBAL_PER_HOUR', 'SENTINEL_ADMIN_INBOX']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.SENTINEL_APPROVAL_SECRET = 'test-approval-secret-0123456789';
process.env.RESEND_API_KEY = 're_test'; process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';

const mails = [];
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) { mails.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'msg_' + mails.length }), { status: 200 }); }
  throw new Error('unexpected network call in test: ' + u);
};

const stores = new Map();
const reads = [];
let listed = 0;
let blobsDown = false;
let downOnly = null;
function memStore(name) {
  if (blobsDown || name === downOnly) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { reads.push(name); const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async list() { listed++; return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const S = require_('../netlify/functions/lib/sentinel-store.cjs');
S._setStoreFactory((name) => memStore(name));
const notifyLib = await import('../netlify/functions/lib/notify.mjs');
notifyLib._setLogStoreFactory(() => ({ async setJSON() {} }));
const { resetRateLimits } = require_('../netlify/functions/_rate-limit.js');
const A = require_('../netlify/functions/lib/sentinel-approvals.cjs');
A._setStoreFactory((name) => memStore(name)); // one-process registry safety: both seams → this suite's stores
resetRateLimits();
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const notify = require_('../netlify/functions/aria-sentinel-notify.js');
const crash = await import('../netlify/functions/sentinel-crash.mjs');

const planKey = crypto.createHmac('sha256', process.env.SENTINEL_LICENSE_SECRET).update('sentinel-license:v1:pro').digest('hex');
const v1Cred = crypto.createHash('sha256').update(planKey).digest('hex');
const v2Key = V2.issueCustomerKey({ plan: 'smb', customerId: 'sub_bind', secret: process.env.SENTINEL_LICENSE_SECRET });
const v2Cred = V2.keyHash(v2Key);
await memStore('sentinel-license-keys').setJSON(v2Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_bind', tier: 'smb', status: 'active', seats: 10, key_version: 2, email: 'owner@bind-corp.example', contacts: ['msp@partner.example'], disabled: false });

const payload = (over = {}) => ({
  v: 'sentinel-notify-v1', event: 'issue-detected', title: 'Print spooler stopped', recipeId: 'restart-print-spooler', severity: 'yellow', platform: 'win32',
  subject: 'ARIA Sentinel: Print spooler stopped', text: 'Print spooler stopped (medium severity) was detected. A vetted fix is available.', channels: { email: true, sms: false },
  recipients: [{ role: 'admin', name: 'Owner', email: 'owner@bind-corp.example' }], device: 'd'.repeat(32), ...over
});
const post = async (body, headers = {}) => {
  const res = await notify.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9', ...headers }, body: JSON.stringify(body) });
  let json = null; try { json = JSON.parse(res.body); } catch { json = null; }
  return { status: res.statusCode, json };
};

console.log('[notify] recipient binding (B5)');
{
  const H = { 'x-sentinel-key': v2Cred };
  mails.length = 0;
  const own = await post(payload(), H);
  ok('the record email → 200, recipientBinding:license-record, 1 email sent', own.status === 200 && own.json.recipientBinding === 'license-record' && own.json.email.sent === 1 && mails.length === 1);
  mails.length = 0;
  const stranger = await post(payload({ recipients: [{ role: 'admin', email: 'owner@bind-corp.example' }, { role: 'approver', email: 'victim@gmail.com' }] }), H);
  ok('a stranger among the recipients → 403 recipients-not-registered naming index 1, nothing sent', stranger.status === 403 && stranger.json.error === 'recipients-not-registered' && stranger.json.rejected[0] === 1 && mails.length === 0);
  ok('the 403 does not echo the address', !JSON.stringify(stranger.json).includes('victim@gmail.com'));
  const contact = await post(payload({ recipients: [{ role: 'msp', email: 'msp@partner.example' }] }), H);
  ok('an admin-registered contact → allowed', contact.status === 200 && contact.json.email.sent === 1);
  mails.length = 0;
  const colleague = await post(payload({ recipients: [{ role: 'approver', email: 'Manager@Bind-Corp.example' }] }), H);
  ok('REVIEW P1-2: a colleague on the same company domain is NO LONGER vouched for → 403, nothing sent', colleague.status === 403 && colleague.json.error === 'recipients-not-registered' && mails.length === 0);
  await memStore('licenses').setJSON(v2Cred, { key_hash: v2Cred, email: 'registered-at-checkin@other.example', devices: [] });
  const devEmail = await post(payload({ recipients: [{ role: 'user', email: 'registered-at-checkin@other.example' }] }), H);
  ok('REVIEW P1-2: the email a device registered at check-in (self-declared) → 403 until an admin approves it', devEmail.status === 403 && mails.length === 0);
  const adminInbox = await post(payload({ recipients: [{ role: 'admin', email: 'integrateditsupp@gmail.com' }] }), H);
  ok('the IIS admin inbox is always allowed', adminInbox.status === 200 && adminInbox.json.email.sent === 1);
  mails.length = 0;
  const smsOnly = await post(payload({ channels: { email: false, sms: true }, sms: 'ARIA: approve?', recipients: [{ role: 'approver', email: 'victim@gmail.com', phone: '+14165551234' }] }), H);
  ok('an unregistered email that will NOT be used (email channel off) is not checked — but an UNAPPROVED phone on the SMS channel is refused (403)', smsOnly.status === 403 && mails.length === 0);
  await memStore('sentinel-license-keys').setJSON(v2Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_bind', tier: 'smb', status: 'active', seats: 10, key_version: 2, email: 'owner@bind-corp.example', contacts: ['msp@partner.example'], contact_phones: ['+14165551234'], disabled: false });
  const smsApproved = await post(payload({ channels: { email: false, sms: true }, sms: 'ARIA: approve?', recipients: [{ role: 'approver', email: 'victim@gmail.com', phone: '+1 416 555 1234' }] }), H);
  ok('…an admin-approved phone (any formatting) is accepted (SMS dormant without Twilio, reported not sent)', smsApproved.status === 200 && smsApproved.json.sms.dormant === true && mails.length === 0);
  resetRateLimits();
}

console.log('[notify] REVIEW P1-2: a shared v1 credential (no per-customer record) → the admin inbox only');
{
  const H = { 'x-sentinel-key': v1Cred };
  mails.length = 0;
  const r = await post(payload({ recipients: [{ role: 'admin', email: 'anyone@example.com' }] }), H);
  ok('a caller-named customer address → 403 recipients-not-registered, recipientBinding admin-inbox-only, nothing sent', r.status === 403 && r.json.recipientBinding === 'admin-inbox-only' && mails.length === 0 && !JSON.stringify(r.json).includes('anyone@example.com'));
  const inbox = await post(payload({ recipients: [{ role: 'admin', email: 'ahmad.wasee@iisupp.net' }] }), H);
  ok('the admin inbox → 200, emailed', inbox.status === 200 && inbox.json.email.sent === 1 && mails[0].to[0] === 'ahmad.wasee@iisupp.net');
  // even a legacy record holding the shared key does not unlock its email for every holder of that key
  await memStore('sentinel-license-keys').setJSON(v1Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_legacy', tier: 'pro', status: 'active', key_version: 1, email: 'one-customer@example.com', contacts: [] });
  const legacyRec = await post(payload({ recipients: [{ role: 'admin', email: 'one-customer@example.com' }] }), H);
  ok('a legacy record on the SHARED key does not make its customer address mailable by every holder → 403', legacyRec.status === 403 && legacyRec.json.recipientBinding === 'admin-inbox-only');
  memStore('sentinel-license-keys')._m.delete(v1Cred);
  const guarded = await post(payload({ text: 'Error in C:\\Users\\sam\\Documents\\payroll.xlsx', recipients: [{ role: 'admin', email: 'ahmad.wasee@iisupp.net' }] }), H);
  ok('…and the content guard still refuses raw paths (422)', guarded.status === 422);
  resetRateLimits();
}

console.log('[notify] O(1) device auth (B14) + per-device rate bucket');
{
  reads.length = 0; listed = 0;
  await post(payload({ recipients: [] }), { 'x-sentinel-key': v2Cred });
  const authReads = reads.filter((n) => ['sentinel-licenses-revocations', 'sentinel-license-keys', 'licenses', 'sentinel-licenses'].includes(n));
  ok('one notify = at most 3 license reads (revocation, key index, device registry) and ZERO store listings', authReads.length <= 3 && listed === 0 && !reads.includes('sentinel-licenses'));
  resetRateLimits();
  let last = null;
  for (let i = 0; i < 31; i++) last = await post(payload({ recipients: [], device: 'a'.repeat(32) }), { 'x-sentinel-key': v2Cred });
  ok('31st post from one credential → 429 (in-memory burst guard)', last.status === 429);
  const otherDevice = await post(payload({ recipients: [], device: 'b'.repeat(32) }), { 'x-sentinel-key': v2Cred });
  ok('REVIEW P1-2: a different caller-chosen `device` does NOT get a fresh bucket — the bucket is the credential', otherDevice.status === 429);
  resetRateLimits();
}

console.log('[notify] REVIEW P1-2: the reviewer\'s p1-notify-relay.mjs scenario — 403 on the victim, 200 only for the buyer, durable limit');
{
  const register = await import('../netlify/functions/aria-sentinel-license-register.js');
  const buyerKey = V2.issueCustomerKey({ plan: 'personal', seed: 'sub_relay', secret: process.env.SENTINEL_LICENSE_SECRET });
  const cred = V2.keyHash(buyerKey);
  await memStore('sentinel-license-keys').setJSON(cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_relay', tier: 'personal', status: 'active', seats: 1, key_version: 2, email: 'buyer@corp.example', contacts: [] });
  const relay = (to, device) => post({ v: 'sentinel-notify-v1', event: 'issue-detected', title: 'Account notice', severity: 'red', text: 'Your account is suspended. Call 1 888 555 0100 now to restore it.', channels: { email: true }, recipients: [{ email: to }], device }, { 'x-sentinel-key': cred });
  mails.length = 0;
  const before = await relay('victim@elsewhere.example', 'dev1');
  ok('before check-in: the victim address → 403', before.status === 403 && before.json.error === 'recipients-not-registered');
  const reg = await register.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': cred }, body: JSON.stringify({ email: 'victim@elsewhere.example', device_id: 'x' }) });
  const regJson = JSON.parse(reg.body);
  ok('check-in with an arbitrary email → 200 but the address is PENDING admin approval', reg.statusCode === 200 && regJson.contact.status === 'pending-admin-approval' && JSON.parse(memStore('licenses')._m.get(cred)).pending_contacts[0].email === 'victim@elsewhere.example');
  const after = await relay('victim@elsewhere.example', 'dev1');
  ok('after check-in: the victim address is STILL 403 and nothing reached Resend', after.status === 403 && mails.length === 0);
  const buyer = await relay('buyer@corp.example', 'dev1');
  ok('the Stripe buyer email → 200, sent', buyer.status === 200 && buyer.json.email.sent === 1 && mails.length === 1 && mails[0].to[0] === 'buyer@corp.example');
  memStore('sentinel-rate-limits')._m.clear();
  let accepted = 0, limited = 0;
  for (let i = 0; i < 100; i++) {
    if (i % 25 === 0) resetRateLimits(); // a new warm instance every 25 posts — only the DURABLE limiter remains
    const r = await relay('buyer@corp.example', 'rotating-' + i);
    if (r.status === 200) accepted++; else if (r.status === 429) limited++;
  }
  ok('100 posts with rotating device ids (across "instances") → only 20 accepted, the rest 429 (durable per-credential hour)', accepted === 20 && limited === 80);
  const rlKeys = [...memStore('sentinel-rate-limits')._m.keys()];
  ok('the durable counters hold no key and no address — scope/window/hashed tenant only', rlKeys.length > 0 && rlKeys.every((k) => /^rl\/notify(-global)?\/\d+\/[a-z0-9]+$/.test(k)) && !rlKeys.join(' ').includes(cred) && !rlKeys.join(' ').includes('@'));
  resetRateLimits();
  downOnly = 'sentinel-rate-limits';
  mails.length = 0;
  const closed = await relay('buyer@corp.example', 'dev1');
  ok('the limiter store unreachable → 503 rate-limiter-unavailable, nothing sent (fail closed)', closed.status === 503 && closed.json.error === 'rate-limiter-unavailable' && mails.length === 0);
  downOnly = null;
  // the global ceiling across every credential
  memStore('sentinel-rate-limits')._m.clear();
  process.env.SENTINEL_NOTIFY_GLOBAL_PER_HOUR = '3';
  const results = [];
  for (let i = 0; i < 4; i++) {
    const k = V2.issueCustomerKey({ plan: 'pro', seed: 'sub_global_' + i, secret: process.env.SENTINEL_LICENSE_SECRET });
    await memStore('sentinel-license-keys').setJSON(V2.keyHash(k), { v: 'sentinel-license-key-v1', subscription_id: 'sub_global_' + i, tier: 'pro', status: 'active', key_version: 2, email: `g${i}@corp.example`, contacts: [] });
    results.push(await post(payload({ recipients: [{ email: `g${i}@corp.example` }] }), { 'x-sentinel-key': V2.keyHash(k) }));
  }
  ok('the global hourly ceiling (SENTINEL_NOTIFY_GLOBAL_PER_HOUR) caps all credentials together', results.slice(0, 3).every((r) => r.status === 200) && results[3].status === 429 && results[3].json.scope === 'notify-global');
  delete process.env.SENTINEL_NOTIFY_GLOBAL_PER_HOUR;
  memStore('sentinel-rate-limits')._m.clear();
  resetRateLimits();
}

console.log('[crash] store-unavailable is a 503, never a 500 (B1/B17)');
{
  const post = (body, ip = '203.0.113.50') => crash.handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const stored = await post({ ts: 1760450000000, name: 'TypeError', message: 'x is undefined at C:\\Users\\sam\\app.js', stack: 'at fn (file:///C:/Users/sam/app.js:1:1)', version: '0.1.16', platform: 'win32' });
  ok('a crash record is stored → 200 {stored:true}', stored.statusCode === 200 && JSON.parse(stored.body).stored === true);
  const rec = JSON.parse([...memStore('sentinel-crashes')._m.values()][0]);
  ok('paths are scrubbed server-side before persisting', !/C:\\|Users\/sam/.test(rec.message + rec.stack) && rec.message.includes('[path]'));
  blobsDown = true;
  const down = await post({ name: 'x' });
  ok('store down → 503 {ok:false, reason:store-unavailable, error:"store error"} (not a 500)', down.statusCode === 503 && JSON.parse(down.body).reason === 'store-unavailable' && JSON.parse(down.body).error === 'store error');
  blobsDown = false;
  ok('bad JSON → 400, GET → 405', (await post('{')).statusCode === 400 && (await crash.handler({ httpMethod: 'GET', headers: {} })).statusCode === 405);
  ok('oversized body → 413', (await post('{"stack":"' + 'x'.repeat(70 * 1024) + '"}')).statusCode === 413);
  let last = null;
  for (let i = 0; i < 61; i++) last = await post({ name: 'flood' }, '198.51.100.9');
  ok('61st crash from one IP in 10 minutes → 429', last.statusCode === 429);
  resetRateLimits();
}

console.log('[contracts] stripe-checkout Sentinel success URL (B11)');
{
  const src = fs.readFileSync(path.join(ROOT, 'netlify/functions/stripe-checkout.js'), 'utf8');
  ok('sentinel_* subscription tiers return to /downloads/?checkout=success&session_id=', /tier\.startsWith\('sentinel_'\)[\s\S]{0,200}\/downloads\/\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/.test(src));
  ok('…and cancel to /plans/', /\/plans\/\?checkout=canceled/.test(src));
  ok('ARIA-web subscription tiers still return to /aria (untouched)', /\/aria\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/.test(src));
  ok('a Sentinel subscription carries its tier in subscription_data.metadata (webhook can tell it apart)', /subscription_data = \{ metadata: \{ tier: metadata\.tier, kind: 'aria-plan', product: 'aria-sentinel' \} \}/.test(src));
  ok('REVIEW P0-1: a one-time session never copies the client\'s body.tier into metadata.tier', !/^\s*tier:\s*String\(body\.tier/m.test(src) && /tier: itemTier\.slice/.test(src));
  ok('REVIEW P2-1: the Walk-Through marker is server-set and `product` is not a client-settable meta key', /metadata\.product = WALKTHROUGH_PRODUCT_ID/.test(src) && !/META_ALLOW = \[[^\]]*'product'/.test(src));
}

console.log('[contracts] netlify.toml: HELD rules first, no dead rewrites (B6 / B15)');
{
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const rules = [...toml.matchAll(/\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g)].map((m) => ({ from: m[1], to: m[2], status: Number(m[3]), at: m.index }));
  const held = rules.find((r) => r.from === '/sentinel-binaries/ARIA-Sentinel-0.1.0-unsigned.exe');
  const heldPublic = rules.find((r) => r.from === '/public/sentinel-binaries/*');
  const rewrite = rules.find((r) => r.from === '/sentinel-binaries/*');
  ok('the HELD force-404 for the unsigned exe precedes the /sentinel-binaries/* rewrite (first match wins)', held && rewrite && held.status === 404 && held.at < rewrite.at);
  ok('the /public/sentinel-binaries/* force-404 precedes the rewrite too', heldPublic && heldPublic.status === 404 && heldPublic.at < rewrite.at);
  const health = rules.find((r) => r.from === '/health');
  ok('/health still precedes every 404 rule', health && rules.filter((r) => r.status === 404).every((r) => r.at > health.at));
  for (const r of rules.filter((r) => r.status === 200 && !r.to.startsWith('/.netlify/') && !r.to.includes(':splat') && !r.to.includes('*'))) {
    assert.ok(fs.existsSync(path.join(ROOT, r.to)), `200 rewrite ${r.from} → ${r.to} must point at a file that exists`);
  }
  ok('every 200 rewrite to a concrete file points at a file that exists (the dead /sentinel-admin + /aria-sentinel/docs targets are gone)', true);
  const admin = rules.find((r) => r.from === '/sentinel-admin');
  const sentinelAll = rules.find((r) => r.from === '/aria-sentinel/*');
  ok('/sentinel-admin → 302 /downloads/ ; /aria-sentinel/* → 302 /plans/ (the desktop\'s upgrade fallback lands on a live page)', admin && admin.status === 302 && admin.to === '/downloads/' && sentinelAll && sentinelAll.status === 302 && sentinelAll.to === '/plans/');
  ok('/plans/ and /downloads/ exist', fs.existsSync(path.join(ROOT, 'plans/index.html')) && fs.existsSync(path.join(ROOT, 'downloads/index.html')));
}

console.log(`sentinel-notify-binding-and-contracts: ${pass} checks green — recipients = Stripe buyer email / admin-approved contacts+phones / admin inbox (403 otherwise; shared v1 keys admin inbox only; self-registered emails pending), O(1) auth with no listings, per-credential in-memory + durable fail-closed limits (per credential + global), crash 503-not-500, Sentinel checkout → /downloads/ and no client tier on one-time sessions, HELD rules before the rewrite, no dead rewrites.`);
