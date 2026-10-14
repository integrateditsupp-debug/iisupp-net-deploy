#!/usr/bin/env node
// aria-sentinel-notify.test.mjs — RUN-CU / CU4 contract for netlify/functions/aria-sentinel-notify.js.
// Device auth by sha256(licenseKey) (plan-key derivation, constant-time) or an internal token; rate limit;
// size + event validation; the Sentinel's own content-blind guard (fail-closed); templated email/SMS via
// lib/notify.mjs with HONEST per-channel results (Twilio unset → dormant, never "sent"); approval-requested
// stores a record in 'sentinel-approvals' and returns HMAC-signed approve/deny links that expire with it.
// fetch + Blobs are mocked — nothing leaves the process.
//   node tests/aria-sentinel-notify.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SMTP_APP_PASSWORD', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'SENTINEL_APPROVAL_SECRET', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.SENTINEL_APPROVAL_SECRET = 'test-approval-secret-0123456789';

// ---- mocked network: Resend + Twilio only; anything else is a test failure.
const calls = [];
let resendMode = 'ok';
global.fetch = async (url, init) => {
  const u = String(url);
  calls.push({ url: u, body: init && init.body });
  if (u.startsWith('https://api.resend.com/emails')) {
    if (resendMode === 'fail') return new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 });
    return new Response(JSON.stringify({ id: 'msg_' + calls.length }), { status: 200 });
  }
  if (u.startsWith('https://api.twilio.com/')) return new Response(JSON.stringify({ sid: 'SM1' }), { status: 201 });
  throw new Error('unexpected network call in test: ' + u);
};

// ---- in-memory Blobs
const stores = new Map();
function memStore(name) {
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async set(k, v) { m.set(k, String(v)); },
      async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const A = require_('../netlify/functions/lib/sentinel-approvals.cjs');
A._setStoreFactory((name) => memStore(name));
const notifyLib = await import('../netlify/functions/lib/notify.mjs');
const logWrites = [];
notifyLib._setLogStoreFactory(() => ({ async setJSON(k, v) { logWrites.push({ k, v }); } }));
const { resetRateLimits } = require_('../netlify/functions/_rate-limit.js');
const fn = require_('../netlify/functions/aria-sentinel-notify.js');

// A real plan key, exactly as sentinel-resolve / the funnel mint it; the device sends its sha256.
const planKey = (plan) => crypto.createHmac('sha256', process.env.SENTINEL_LICENSE_SECRET).update(`sentinel-license:v1:${plan}`).digest('hex');
const deviceKey = crypto.createHash('sha256').update(planKey('pro')).digest('hex');
const DEVICE = 'a'.repeat(32);
const basePayload = (over = {}) => ({
  v: 'sentinel-notify-v1', event: 'issue-detected', title: 'Print spooler stopped', recipeId: 'restart-print-spooler', severity: 'yellow', platform: 'win32',
  outcome: null, approvalId: null, expiresAt: null, summary: null, ts: '2026-10-08T10:00:00.000Z',
  subject: 'ARIA Sentinel: Print spooler stopped on Sam\'s Windows device', text: 'Print spooler stopped (medium severity) was detected on Sam\'s Windows device (Windows). A vetted fix is available.',
  sms: 'ARIA: Print spooler stopped (medium) on Sam\'s Windows device.', channels: { email: true, sms: true },
  recipients: [{ role: 'admin', name: 'Sam', email: 'sam@example.com', phone: '+14165551234' }], device: DEVICE, ...over
});
const post = async (body, headers = {}) => {
  const res = await fn.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  let json = null; try { json = JSON.parse(res.body); } catch { json = null; }
  return { status: res.statusCode, json, raw: res.body, headers: res.headers };
};

console.log('[notify-fn] auth');
{
  const r = await post(basePayload());
  ok('no key, no token → 401', r.status === 401 && r.json.error === 'unauthorized');
  const bad = await post(basePayload(), { 'x-sentinel-key': 'f'.repeat(64) });
  ok('unknown key hash → 401 (no store record, no plan match)', bad.status === 401);
  const short = await post(basePayload(), { 'x-sentinel-key': 'abc' });
  ok('malformed key hash → 401', short.status === 401);
  const good = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('sha256(plan key) → 200 via plan-key derivation', good.status === 200 && good.json.ok === true && good.json.auth === 'device');
  ok('no raw key ever reaches the server: the header is a hash and nothing hashed it back', !calls.some((c) => String(c.body || '').includes(planKey('pro'))));
  // revoked: SENTINEL-BACKEND 2026-10-14 (audit B4/B14) — the ONE revocation store ('sentinel-licenses-revocations',
  // keyed by sha256(key)) that sentinel-licenses?action=revoke and the Stripe subscription.deleted path write.
  // No more 2,000-blob scan of sentinel-licenses on every notify; a record there with status revoked no longer
  // denies by itself — the revoke action decides (shared v1 plan keys are cut off only when no active sibling
  // record still holds the same key; see tests/sentinel-licenses-api.test.mjs).
  memStore('sentinel-licenses')._m.set('sub_1', JSON.stringify({ key: planKey('pro'), status: 'revoked', email: 'x@example.com' }));
  const scanFree = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('a revoked record alone (no revocation entry) does not deny — nothing scans the registry any more', scanFree.status === 200);
  await memStore('sentinel-licenses-revocations').setJSON(deviceKey, { revoked: true, at: '2026-10-14T00:00:00.000Z', reason: 'admin-revoke' });
  const rev = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('revoked license → 401 license-revoked', rev.status === 401 && rev.json.error === 'license-revoked');
  memStore('sentinel-licenses-revocations')._m.clear();
  const again = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('clearing the revocation entry (admin unrevoke) restores access', again.status === 200);
  // a per-customer key-index record with status revoked denies too (written by revoke / cancellation)
  await memStore('sentinel-license-keys').setJSON(deviceKey, { v: 'sentinel-license-key-v1', status: 'revoked', tier: 'pro', email: 'x@example.com' });
  const idxRev = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('key-index record status:revoked → 401 license-revoked', idxRev.status === 401 && idxRev.json.error === 'license-revoked');
  memStore('sentinel-license-keys')._m.clear();
  memStore('sentinel-licenses')._m.clear();
  // internal token path (fail-closed gate)
  const noTok = await post(basePayload(), { 'x-internal-token': 'whatever-long-token' });
  ok('internal token presented but none configured → 503 not-configured (never fail-open)', noTok.status === 503);
  process.env.SENTINEL_ADMIN_TOKEN = 'admin-token-0123456789';
  const wrong = await post(basePayload(), { 'x-internal-token': 'wrong-token-0123456789' });
  ok('wrong internal token → 401', wrong.status === 401);
  const internal = await post(basePayload(), { 'x-internal-token': 'admin-token-0123456789' });
  ok('correct internal token → 200 auth:internal', internal.status === 200 && internal.json.auth === 'internal');
  delete process.env.SENTINEL_ADMIN_TOKEN;
  // no-secret fallback: the 'licenses' store keyed by hash
  const savedSecret = process.env.SENTINEL_LICENSE_SECRET; delete process.env.SENTINEL_LICENSE_SECRET;
  const noSecret = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('no license secret + no store record → 401', noSecret.status === 401);
  memStore('licenses')._m.set(deviceKey, JSON.stringify({ status: 'active', plan: 'pro' }));
  const viaStore = await post(basePayload(), { 'x-sentinel-key': deviceKey });
  ok('no license secret + licenses store record → 200', viaStore.status === 200);
  memStore('licenses')._m.clear();
  process.env.SENTINEL_LICENSE_SECRET = savedSecret;
}

console.log('[notify-fn] validation + content-blind guard (fail-closed, the Sentinel\'s own definition)');
{
  const H = { 'x-sentinel-key': deviceKey };
  ok('GET → 405', (await fn.handler({ httpMethod: 'GET', headers: H })).statusCode === 405);
  ok('oversized body → 413', (await post('{"v":"' + 'x'.repeat(25 * 1024) + '"}', H)).status === 413);
  ok('bad JSON → 400', (await post('{nope', H)).status === 400);
  ok('wrong version → 400', (await post(basePayload({ v: 'v0' }), H)).json.error === 'unsupported-version');
  ok('unknown event → 400', (await post(basePayload({ event: 'shutdown' }), H)).json.error === 'unknown-event');
  ok('bad recipient email → 400', (await post(basePayload({ recipients: [{ role: 'admin', email: 'not-an-email' }] }), H)).json.error === 'bad-recipient-email');
  ok('too many recipients → 400', (await post(basePayload({ recipients: Array.from({ length: 9 }, () => ({ email: 'a@b.co' })) }), H)).json.error === 'too-many-recipients');
  const path = await post(basePayload({ text: 'Error in C:\\Users\\sam\\Documents\\payroll.xlsx' }), H);
  ok('raw path in text → 422 content-not-allowed (raw-path)', path.status === 422 && path.json.reason === 'raw-path');
  const url = await post(basePayload({ title: 'See https://intranet.example/x' }), H);
  ok('URL in title → 422', url.status === 422 && url.json.reason === 'url');
  const log = await post(basePayload({ text: '2026-10-08 10:00:00 ERROR spoolsv crashed' }), H);
  ok('log line in text → 422', log.status === 422 && log.json.reason === 'log-line');
  const mail = await post(basePayload({ sms: 'contact bob@corp.example now' }), H);
  ok('address in the message text → 422 (addresses travel only in recipients)', mail.status === 422 && mail.json.reason === 'email-in-payload');
  ok('nothing was sent for a refused payload', !calls.some((c) => /payroll|intranet|spoolsv|bob@corp/.test(String(c.body || ''))));
}

console.log('[notify-fn] honest channel results');
{
  const H = { 'x-sentinel-key': deviceKey };
  calls.length = 0;
  const dormant = await post(basePayload(), H);
  ok('no providers → ok:true (accepted) but email.sent 0 + dormant:true', dormant.json.ok === true && dormant.json.email.sent === 0 && dormant.json.email.dormant === true && dormant.json.email.error === 'no-email-provider-configured');
  ok('Twilio unset → sms.sent 0 + dormant:true (reported NOT sent)', dormant.json.sms.sent === 0 && dormant.json.sms.dormant === true && dormant.json.sms.error === 'twilio-not-configured');
  ok('no network calls while dormant', calls.length === 0);
  process.env.RESEND_API_KEY = 're_test'; process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';
  const sent = await post(basePayload(), H);
  ok('Resend configured + id returned → email.sent 1, dormant:false', sent.json.email.sent === 1 && sent.json.email.dormant === false && sent.json.email.error === null);
  ok('sms still dormant with only email configured', sent.json.sms.dormant === true && sent.json.sms.sent === 0);
  const sentBody = JSON.parse(calls.find((c) => c.url.startsWith('https://api.resend.com')).body);
  ok('email goes to the named recipient with the branded template', sentBody.to[0] === 'sam@example.com' && /Issue detected/.test(sentBody.html) && /Print spooler stopped/.test(sentBody.html) && /never device content/.test(sentBody.html));
  ok('email body carries no device content fields (no paths/log lines/addresses in the html)', !/C:\\|\/Users\/|ERROR|@example\.com/.test(sentBody.html));
  resendMode = 'fail';
  const failed = await post(basePayload(), H);
  ok('Resend 401 → email.sent 0, dormant:false, error named (failed ≠ dormant ≠ sent)', failed.json.email.sent === 0 && failed.json.email.dormant === false && /all-email-paths-failed/.test(failed.json.email.error));
  resendMode = 'ok';
  process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 'tok'; process.env.TWILIO_PHONE_NUMBER = '+15550000000';
  const both = await post(basePayload(), H);
  ok('Twilio configured + sid returned → sms.sent 1', both.json.sms.sent === 1 && both.json.sms.dormant === false);
  const off = await post(basePayload({ channels: { email: true, sms: false } }), H);
  ok('channels.sms:false → sms not attempted even with a phone on file', off.json.sms.attempted === 0 && off.json.sms.sent === 0);
  const none = await post(basePayload({ recipients: [] }), H);
  ok('no recipients → accepted, nothing attempted', none.status === 200 && none.json.email.attempted === 0 && none.json.sms.attempted === 0);
  ok('notify-log rows hold hashes + status only (no address, no body)', logWrites.length > 0 && logWrites.every(({ v }) => !JSON.stringify(v).includes('sam@example.com') && !JSON.stringify(v).includes('Print spooler')));
}

console.log('[notify-fn] approval-requested → stored record + signed links');
{
  const H = { 'x-sentinel-key': deviceKey };
  const exp = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const r = await post(basePayload({ event: 'approval-requested', approvalId: 'local-approval-1', expiresAt: exp, subject: 'Approve a fix', text: 'ARIA Sentinel wants to run "Print spooler stopped" (medium severity, restart-print-spooler). It will not run until someone approves it.', sms: 'ARIA: approve "Print spooler stopped"? Reply in the app or use the link in your email.' }), H);
  ok('200 with approval {id, approveUrl, denyUrl, expiresAt}', r.status === 200 && r.json.approval && /^[a-f0-9]{16}$/.test(r.json.approval.id) && r.json.approval.linksSigned === true);
  ok('links point at aria-sentinel-approval on iisupp.net', r.json.approval.approveUrl.startsWith('https://iisupp.net/.netlify/functions/aria-sentinel-approval?t=') && r.json.approval.denyUrl.includes('&a=deny'));
  const token = decodeURIComponent(r.json.approval.approveUrl.split('t=')[1].split('&')[0]);
  const v = A.verifyApprovalToken(token, process.env.SENTINEL_APPROVAL_SECRET, Date.now());
  ok('the link token verifies under the approval secret and names the record', v.ok === true && v.id === r.json.approval.id);
  ok('token expiry equals the record expiry (links expire with the record)', Math.abs(v.expiresAt - Date.parse(r.json.approval.expiresAt)) < 1000);
  const rec = await memStore('sentinel-approvals').get(r.json.approval.id, { type: 'json' });
  ok('record stored {id, tenant, device, recipe, title, expiresAt, status:pending}', rec && rec.status === 'pending' && rec.recipe === 'restart-print-spooler' && rec.title === 'Print spooler stopped' && rec.device === DEVICE && rec.tenant === A.hash16(deviceKey) && rec.clientApprovalId === 'local-approval-1');
  ok('record carries catalog facts only (no address, no message text)', !JSON.stringify(rec).includes('sam@') && !JSON.stringify(rec).includes('wants to run'));
  const sentBody = JSON.parse(calls.filter((c) => c.url.startsWith('https://api.resend.com')).pop().body);
  ok('approval email carries both signed links', sentBody.html.includes(r.json.approval.approveUrl.replace(/&/g, '&amp;')) && sentBody.text.includes(r.json.approval.denyUrl));
  const smsBody = decodeURIComponent(calls.filter((c) => c.url.startsWith('https://api.twilio.com')).pop().body).replace(/\+/g, ' ');
  ok('SMS carries the approve link when it fits', /Approve: https:\/\/iisupp\.net/.test(smsBody));
  // expiry clamp
  const far = await post(basePayload({ event: 'approval-requested', expiresAt: '2099-01-01T00:00:00.000Z' }), H);
  ok('expiry is clamped to 24h max', Date.parse(far.json.approval.expiresAt) - Date.now() <= 24 * 60 * 60 * 1000 + 2000);
  const past = await post(basePayload({ event: 'approval-requested', expiresAt: '2000-01-01T00:00:00.000Z' }), H);
  ok('a past expiry is lifted to the 1-minute floor (never a dead-on-arrival link)', Date.parse(past.json.approval.expiresAt) - Date.now() >= 55 * 1000);
  // no approval secret → record stored, no links, email says "approve in the app"
  const saved = process.env.SENTINEL_APPROVAL_SECRET; delete process.env.SENTINEL_APPROVAL_SECRET;
  const savedL = process.env.SENTINEL_LICENSE_SECRET; delete process.env.SENTINEL_LICENSE_SECRET;
  memStore('licenses')._m.set(deviceKey, JSON.stringify({ status: 'active' }));
  const noSecret = await post(basePayload({ event: 'approval-requested' }), H);
  ok('no signing secret → record stored but linksSigned:false + approvalError named (no unsigned link ever ships)', noSecret.status === 200 && noSecret.json.approval.approveUrl === null && noSecret.json.approval.linksSigned === false && noSecret.json.approvalError === 'approval-secret-not-configured');
  const lastMail = JSON.parse(calls.filter((c) => c.url.startsWith('https://api.resend.com')).pop().body);
  ok('…and the email says to approve in the app', /Control Center/.test(lastMail.html) && !/aria-sentinel-approval\?t=/.test(lastMail.html));
  memStore('licenses')._m.clear();
  process.env.SENTINEL_APPROVAL_SECRET = saved; process.env.SENTINEL_LICENSE_SECRET = savedL;
}

console.log('[notify-fn] rate limit');
{
  resetRateLimits();
  const H = { 'x-sentinel-key': deviceKey };
  let last = null;
  for (let i = 0; i < 31; i++) last = await post(basePayload({ recipients: [] }), H);
  ok('31st post in 10 minutes from one device → 429', last.status === 429 && last.json.error === 'rate_limited');
  resetRateLimits();
}

console.log(`aria-sentinel-notify: ${pass} checks green — device/internal auth (plan-key derivation, revocation, fail-closed admin), validation, content-blind guard, honest email/SMS results (dormant ≠ sent), stored approvals + signed links, rate limit.`);
