#!/usr/bin/env node
// sentinel-session-report.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B2, P0: the open relay).
// netlify/functions/sentinel-session-report.js must:
//   - send NOTHING without a device credential (401) — the prior probe produced a real email with no auth;
//   - send the user copy ONLY to an address the license record vouches for; a body-supplied stranger is
//     skipped and the response says so (the company copy still goes to the company inbox). REVIEW FIXES
//     2026-10-14 (P1-2): "vouches for" = the Stripe buyer email, an admin-approved contact or the admin inbox —
//     a device-registered email or a same-domain colleague no longer counts; a shared v1 key gets the admin inbox
//     only; a durable Blobs ceiling per credential holds across instances and fails closed;
//   - keep transcripts / backend actions OUT of every mail, and refuse (422) free text that fails the
//     desktop's own content-blind guard — nothing is sent in that case;
//   - carry no CORS wildcard; rate-limit 5 reports / 10 min per credential; answer `ok:true` only when a
//     provider id came back (Rule 14). The desktop reads only `res.ok`.
// fetch is stubbed; Blobs is in-memory; nothing leaves the process.
//   node tests/sentinel-session-report.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';

const mails = [];
let resendMode = 'ok';
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) {
    mails.push(JSON.parse(init.body));
    return new Response(JSON.stringify(resendMode === 'ok' ? { id: 'msg_' + mails.length } : { message: 'boom' }), { status: resendMode === 'ok' ? 200 : 500 });
  }
  throw new Error('unexpected network call in test: ' + u);
};

const stores = new Map();
function memStore(name) {
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const S = require_('../netlify/functions/lib/sentinel-store.cjs');
S._setStoreFactory((name) => memStore(name));
const { resetRateLimits } = require_('../netlify/functions/_rate-limit.js');
resetRateLimits();
// One-process registry safety (ARIA Sentinel/tests/run-all.mjs imports suites into one process): point BOTH
// store seams at this suite's stores so a previously imported suite's seam cannot answer our auth reads.
const A = require_('../netlify/functions/lib/sentinel-approvals.cjs');
A._setStoreFactory((name) => memStore(name));
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const fn = require_('../netlify/functions/sentinel-session-report.js');

const planKey = (plan) => crypto.createHmac('sha256', process.env.SENTINEL_LICENSE_SECRET).update(`sentinel-license:v1:${plan}`).digest('hex');
const v1Device = crypto.createHash('sha256').update(planKey('pro')).digest('hex');
const v2Key = V2.issueCustomerKey({ plan: 'smb', customerId: 'sub_acme', secret: process.env.SENTINEL_LICENSE_SECRET });
const v2Device = V2.keyHash(v2Key);
await memStore('sentinel-license-keys').setJSON(v2Device, { v: 'sentinel-license-key-v1', subscription_id: 'sub_acme', tier: 'smb', status: 'active', seats: 25, key_version: 2, email: 'owner@acme-corp.example', contacts: ['helpdesk@partner.example'], disabled: false });

const body = (over = {}) => ({ sessionId: 'sentinel-1760450000000', outcome: 'resolved', endedAt: '2026-10-14T10:00:00.000Z', issue: 'Print spooler stopped', ticketRef: 'IIS-20261014-0003', user: { email: 'owner@acme-corp.example', firstName: 'Sam' }, ...over });
const post = async (b, headers = {}) => {
  const r = await fn.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9', ...headers }, body: typeof b === 'string' ? b : JSON.stringify(b) });
  let json = null; try { json = JSON.parse(r.body); } catch { json = null; }
  return { status: r.statusCode, json, headers: r.headers, raw: r.body };
};

console.log('[session-report] no credential → 401 and nothing is sent');
{
  const r = await post(body());
  ok('unauthenticated POST → 401 unauthorized', r.status === 401 && r.json.error === 'unauthorized');
  ok('fetch was never called (no email left)', mails.length === 0);
  ok('unknown credential → 401', (await post(body(), { 'x-sentinel-key': 'f'.repeat(64) })).status === 401 && mails.length === 0);
  await memStore('sentinel-licenses-revocations').setJSON(v1Device, { revoked: true });
  ok('revoked credential → 401 license-revoked, nothing sent', (await post(body(), { 'x-sentinel-key': v1Device })).json.error === 'license-revoked' && mails.length === 0);
  memStore('sentinel-licenses-revocations')._m.clear();
  const opt = await fn.handler({ httpMethod: 'OPTIONS', headers: {} });
  ok('OPTIONS is 204 and carries no access-control-allow-origin', opt.statusCode === 204 && !opt.headers['access-control-allow-origin']);
  const get = await fn.handler({ httpMethod: 'GET', headers: {} });
  ok('GET → 405 without a CORS wildcard', get.statusCode === 405 && !get.headers['access-control-allow-origin']);
  ok('a 401 carries no CORS wildcard either', !r.headers['access-control-allow-origin']);
}

console.log('[session-report] recipient binding (B2/B5): the license record decides who gets the user copy');
{
  const H = { 'x-sentinel-key': v2Device };
  mails.length = 0;
  const stranger = await post(body({ user: { email: 'victim@gmail.com', firstName: 'Sam' } }), H);
  ok('foreign user.email → 200, company copy sent, user copy SKIPPED recipient-not-registered', stranger.status === 200 && stranger.json.ok === true && stranger.json.sent.length === 1 && stranger.json.sent[0].to === 'company' && stranger.json.errors.some((e) => e.to === 'user' && e.skipped === 'recipient-not-registered'));
  ok('exactly one mail left, to the company inbox, and it does not name the stranger', mails.length === 1 && mails[0].to[0] === 'integrateditsupp@gmail.com' && !JSON.stringify(mails[0]).includes('victim@gmail.com'));
  mails.length = 0;
  const owner = await post(body(), H);
  ok('the record\'s own email → both copies sent', owner.json.sent.length === 2 && mails.length === 2 && mails[1].to[0] === 'owner@acme-corp.example');
  ok('user mail: honest resolved headline, issue, ticket ref; no transcript section', /We resolved it on your device/.test(mails[1].html) && /Print spooler stopped/.test(mails[1].html) && /IIS-20261014-0003/.test(mails[1].html) && !/Transcript/.test(mails[1].html));
  ok('company mail names the registered recipient and says transcripts never leave the device', /owner@acme-corp\.example/.test(mails[0].html) && /Transcripts never leave the device/.test(mails[0].html));
  mails.length = 0;
  const contact = await post(body({ user: { email: 'helpdesk@partner.example' } }), H);
  ok('an admin-set contact → user copy sent', contact.json.sent.length === 2);
  mails.length = 0;
  const colleague = await post(body({ user: { email: 'cfo@acme-corp.example' } }), H);
  ok('REVIEW P1-2: a same-domain colleague is NO LONGER vouched for → user copy skipped (company copy only)', colleague.json.sent.length === 1 && colleague.json.errors.some((e) => e.skipped === 'recipient-not-registered') && mails.length === 1);
  resetRateLimits();
  // a public-mailbox customer never vouches for the whole domain
  const gmailKey = V2.issueCustomerKey({ plan: 'personal', customerId: 'sub_gm', secret: process.env.SENTINEL_LICENSE_SECRET });
  const gmailDevice = V2.keyHash(gmailKey);
  await memStore('sentinel-license-keys').setJSON(gmailDevice, { v: 'sentinel-license-key-v1', subscription_id: 'sub_gm', tier: 'personal', status: 'active', key_version: 2, email: 'customer@gmail.com', contacts: [] });
  mails.length = 0;
  const other = await post(body({ user: { email: 'someone-else@gmail.com' } }), { 'x-sentinel-key': gmailDevice });
  ok('gmail.com customer + another gmail.com address → skipped (public domains never count as "same company")', other.json.errors.some((e) => e.skipped === 'recipient-not-registered') && mails.length === 1);
  mails.length = 0;
  const self = await post(body({ user: { email: 'Customer@Gmail.com' } }), { 'x-sentinel-key': gmailDevice });
  ok('…but their own address (any case) is fine', self.json.sent.length === 2);
}

console.log('[session-report] REVIEW P1-2: a self-registered email or a shared v1 key gets no user copy (admin inbox only)');
{
  resetRateLimits();
  const H = { 'x-sentinel-key': v1Device };
  mails.length = 0;
  const r = await post(body({ user: { email: 'anyone@example.com' } }), H);
  ok('v1 plan key with no record → user copy skipped (not registered), company copy sent', r.json.sent.length === 1 && r.json.errors.some((e) => e.skipped === 'recipient-not-registered'));
  await memStore('licenses').setJSON(v1Device, { key_hash: v1Device, email: 'registered@example.com', devices: [] });
  mails.length = 0;
  const reg = await post(body({ user: { email: 'registered@example.com' } }), H);
  ok('the email a device registered at check-in (self-declared, pending) → user copy SKIPPED', reg.json.sent.length === 1 && reg.json.errors.some((e) => e.skipped === 'recipient-not-registered') && !mails.some((m) => m.to[0] === 'registered@example.com'));
  memStore('licenses')._m.clear();
  // the same, on a per-customer key: a device-registered stranger is not the buyer
  await memStore('licenses').setJSON(v2Device, { key_hash: v2Device, email: 'victim@elsewhere.example', devices: [] });
  mails.length = 0;
  const v2reg = await post(body({ user: { email: 'victim@elsewhere.example' } }), { 'x-sentinel-key': v2Device });
  ok('a per-customer key whose device registered a stranger → the stranger gets nothing', v2reg.json.sent.length === 1 && !mails.some((m) => m.to[0] === 'victim@elsewhere.example'));
  memStore('licenses')._m.clear();
  resetRateLimits();
  mails.length = 0;
  const admin = await post(body({ user: { email: 'integrateditsupp@gmail.com' } }), H);
  ok('a shared v1 key may name the admin inbox → user copy to the admin inbox', admin.json.sent.length === 2 && mails[1].to[0] === 'integrateditsupp@gmail.com');
  // an admin-approved contact on the per-customer record is allowed
  await memStore('sentinel-license-keys').setJSON(v2Device, { v: 'sentinel-license-key-v1', subscription_id: 'sub_acme', tier: 'smb', status: 'active', seats: 25, key_version: 2, email: 'owner@acme-corp.example', contacts: ['helpdesk@partner.example', 'cfo@acme-corp.example'], disabled: false });
  mails.length = 0;
  const approved = await post(body({ user: { email: 'cfo@acme-corp.example' } }), { 'x-sentinel-key': v2Device });
  ok('once an admin approves the colleague (contacts), the user copy goes to them', approved.json.sent.length === 2 && mails[1].to[0] === 'cfo@acme-corp.example');
  await memStore('sentinel-license-keys').setJSON(v2Device, { v: 'sentinel-license-key-v1', subscription_id: 'sub_acme', tier: 'smb', status: 'active', seats: 25, key_version: 2, email: 'owner@acme-corp.example', contacts: ['helpdesk@partner.example'], disabled: false });
}

console.log('[session-report] content-blind: transcript dropped, guard enforced');
{
  resetRateLimits();
  const H = { 'x-sentinel-key': v2Device };
  mails.length = 0;
  const withTranscript = await post(body({ transcript: [{ role: 'user', text: 'my password is hunter2' }], actions: [{ recipeId: 'x', step: 'ran C:\\tools\\fix.exe' }], summary: 'Restarted the spooler service' }), H);
  ok('transcript + actions are accepted but never mailed', withTranscript.status === 200 && mails.length === 2 && !mails.some((m) => /hunter2|fix\.exe|Backend steps/.test(m.html)));
  ok('a safe summary IS mailed', mails.every((m) => /Restarted the spooler service/.test(m.html)));
  mails.length = 0;
  const path = await post(body({ summary: 'Error opening C:\\Users\\sam\\Documents\\payroll.xlsx' }), H);
  ok('a raw path in the summary → 422 content-not-allowed, nothing sent', path.status === 422 && path.json.reason === 'raw-path' && mails.length === 0);
  const url = await post(body({ issue: 'See https://intranet.example/ticket' }), H);
  ok('a URL in the issue → 422, nothing sent', url.status === 422 && mails.length === 0);
  const log = await post(body({ summary: '2026-10-14 10:00:00 ERROR spoolsv crashed' }), H);
  ok('a log line → 422, nothing sent', log.status === 422 && mails.length === 0);
  const addr = await post(body({ summary: 'contact bob@corp.example' }), H);
  ok('an address inside free text → 422 (addresses travel only as the recipient)', addr.status === 422 && mails.length === 0);
  resetRateLimits();
  ok('bad JSON → 400', (await post('{nope', H)).status === 400);
  ok('mid-session (no endedAt) → 400', (await post(body({ endedAt: null }), H)).status === 400);
  ok('unknown outcome → 400', (await post(body({ outcome: 'fixed' }), H)).status === 400);
  ok('oversized body → 413', (await post('{"sessionId":"' + 'x'.repeat(25 * 1024) + '"}', H)).status === 413);
}

console.log('[session-report] honest results');
{
  resetRateLimits();
  const H = { 'x-sentinel-key': v2Device };
  resendMode = 'fail';
  mails.length = 0;
  const failed = await post(body(), H);
  ok('Resend failing → 207, ok:false, both errors named (never a phantom "sent")', failed.status === 207 && failed.json.ok === false && failed.json.sent.length === 0 && failed.json.errors.filter((e) => e.error).length === 2);
  resendMode = 'ok';
  const savedKey = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  const unconf = await post(body(), H);
  ok('no RESEND_API_KEY → 503 with wouldSend (nothing claimed)', unconf.status === 503 && unconf.json.ok === false && unconf.json.wouldSend.user === 'owner@acme-corp.example');
  process.env.RESEND_API_KEY = savedKey;
  // internal (admin) callers may name any valid address
  process.env.SENTINEL_ADMIN_TOKEN = 'admin-token-0123456789';
  mails.length = 0;
  const internal = await post(body({ user: { email: 'anyone@example.com' } }), { 'x-internal-token': 'admin-token-0123456789' });
  ok('an internal caller (admin token) may name any valid address', internal.json.auth === 'internal' && internal.json.sent.length === 2 && mails[1].to[0] === 'anyone@example.com');
  delete process.env.SENTINEL_ADMIN_TOKEN;
}

console.log('[session-report] rate limit per credential');
{
  resetRateLimits();
  const H = { 'x-sentinel-key': v2Device };
  let last = null;
  for (let i = 0; i < 6; i++) last = await post(body(), H);
  ok('6th report in 10 minutes from one credential → 429', last.status === 429 && last.json.error === 'rate_limited');
  resetRateLimits();
}

console.log('[session-report] REVIEW P1-2: a DURABLE per-credential ceiling survives a cold start / another instance');
{
  memStore('sentinel-rate-limits')._m.clear();
  const k3 = V2.issueCustomerKey({ plan: 'pro', customerId: 'sub_durable', secret: process.env.SENTINEL_LICENSE_SECRET });
  const d3 = V2.keyHash(k3);
  await memStore('sentinel-license-keys').setJSON(d3, { v: 'sentinel-license-key-v1', subscription_id: 'sub_durable', tier: 'pro', status: 'active', key_version: 2, email: 'durable@corp.example', contacts: [] });
  const H = { 'x-sentinel-key': d3 };
  const statuses = [];
  for (let i = 0; i < 11; i++) { if (i % 5 === 0) resetRateLimits(); statuses.push((await post(body({ user: { email: 'durable@corp.example' } }), H)).status); }
  ok('10 reports an hour per credential even when the in-memory limiter is reset (a new instance) — the 11th → 429', statuses.slice(0, 10).every((x) => x === 200) && statuses[10] === 429);
  resetRateLimits();
  const blobsGone = S._setStoreFactory((name) => (name === 'sentinel-rate-limits' ? null : memStore(name)));
  void blobsGone;
  A._setStoreFactory((name) => (name === 'sentinel-rate-limits' ? null : memStore(name)));
  mails.length = 0;
  const closed = await post(body(), { 'x-sentinel-key': v2Device });
  ok('limiter store unreachable → 503 rate-limiter-unavailable, NOTHING sent (fail closed)', closed.status === 503 && closed.json.error === 'rate-limiter-unavailable' && mails.length === 0);
  S._setStoreFactory((name) => memStore(name));
  A._setStoreFactory((name) => memStore(name));
  resetRateLimits();
}

console.log(`sentinel-session-report: ${pass} checks green — 401 sends nothing, user copy only to the Stripe buyer email / an admin-approved contact / the admin inbox (never a self-registered or same-domain address, never via a shared v1 key), transcript never mailed, guard 422, no CORS *, honest 207/503, per-credential in-memory + durable fail-closed rate limits.`);
