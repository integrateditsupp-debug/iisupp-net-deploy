#!/usr/bin/env node
// aria-sentinel-approval.test.mjs — RUN-CU / CU4 contract for netlify/functions/aria-sentinel-approval.js.
// GET with a signed token renders the decision page and NEVER changes state (mail scanners prefetch links);
// POST records a decision exactly once ({decidedBy, decidedAt}); a tampered/expired token or a closed record
// says so and changes nothing; the desktop poll (?poll=1&id=) needs device auth and only sees its own tenant's
// (and device's) asks. Tokens are HMAC-signed and expire with the record. Blobs mocked — nothing leaves.
//   node tests/aria-sentinel-approval.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['SENTINEL_APPROVAL_SECRET', 'SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.SENTINEL_APPROVAL_SECRET = 'test-approval-secret-0123456789';
global.fetch = async (url) => { throw new Error('unexpected network call in test: ' + url); };

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
const A = require_('../netlify/functions/lib/sentinel-approvals.cjs');
A._setStoreFactory((name) => memStore(name));
const { resetRateLimits } = require_('../netlify/functions/_rate-limit.js');
const fn = require_('../netlify/functions/aria-sentinel-approval.js');
const SECRET = process.env.SENTINEL_APPROVAL_SECRET;

const planKey = (plan) => crypto.createHmac('sha256', process.env.SENTINEL_LICENSE_SECRET).update(`sentinel-license:v1:${plan}`).digest('hex');
const deviceKey = crypto.createHash('sha256').update(planKey('pro')).digest('hex');
const otherDeviceKey = crypto.createHash('sha256').update(planKey('smb')).digest('hex');
const tenant = A.hash16(deviceKey);
const DEVICE = 'd'.repeat(32);

async function seed(over = {}) {
  const rec = A.createApprovalRecord({ tenant, device: DEVICE, recipe: 'restart-print-spooler', title: 'Print spooler stopped', severity: 'yellow', platform: 'win32', expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(), now: Date.now() });
  const full = { ...rec, ...over };
  await memStore('sentinel-approvals').setJSON(full.id, full);
  return full;
}
const tokenFor = (rec) => A.signApprovalToken(rec.id, Date.parse(rec.expiresAt), SECRET);
const get = async (query, headers = {}) => fn.handler({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': '203.0.113.5', ...headers }, queryStringParameters: query });
const postForm = async (fields, headers = {}) => fn.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-nf-client-connection-ip': '203.0.113.5', ...headers }, body: new URLSearchParams(fields).toString() });
const postJson = async (fields, headers = {}) => fn.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'x-nf-client-connection-ip': '203.0.113.5', ...headers }, body: JSON.stringify(fields) });
const read = async (id) => memStore('sentinel-approvals').get(id, { type: 'json' });

console.log('[approval-fn] token helpers');
{
  const t = A.signApprovalToken('abcd1234abcd1234', Date.now() + 60000, SECRET);
  ok('token is id.exp36.hmac32', /^abcd1234abcd1234\.[0-9a-z]+\.[a-f0-9]{32}$/.test(t));
  ok('verifies under the same secret', A.verifyApprovalToken(t, SECRET, Date.now()).ok === true);
  ok('tampered signature refused', A.verifyApprovalToken(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'), SECRET, Date.now()).reason === 'bad-signature');
  ok('other secret refused', A.verifyApprovalToken(t, 'another-secret-0123456789', Date.now()).reason === 'bad-signature');
  ok('expired token refused with reason expired', A.verifyApprovalToken(t, SECRET, Date.now() + 120000).reason === 'expired');
  ok('malformed token refused', A.verifyApprovalToken('nope', SECRET, Date.now()).reason === 'malformed');
  ok('no secret → nothing is minted (never an unsigned link)', A.signApprovalToken('abcd1234abcd1234', Date.now() + 60000, '') === '' && A.approvalLinks('abcd1234abcd1234', Date.now() + 60000, '') === null);
}

console.log('[approval-fn] GET renders the decision page and changes nothing');
{
  const rec = await seed();
  const t = tokenFor(rec);
  const r = await get({ t, a: 'approve' });
  ok('200 HTML page', r.statusCode === 200 && /text\/html/.test(r.headers['content-type']));
  ok('security headers: no-store, DENY framing, CSP, no referrer', r.headers['cache-control'] === 'no-store' && r.headers['x-frame-options'] === 'DENY' && /default-src 'none'/.test(r.headers['content-security-policy']) && r.headers['referrer-policy'] === 'no-referrer');
  ok('page names the fix, severity, platform and the Approve confirm button', /Print spooler stopped/.test(r.body) && /yellow severity/.test(r.body) && /win32/.test(r.body) && /Approve this fix/.test(r.body));
  ok('page posts to the same endpoint with the token + action hidden', /<form method="post" action="https:\/\/iisupp\.net\/\.netlify\/functions\/aria-sentinel-approval"/.test(r.body) && r.body.includes(`name="t" value="${t}"`) && /name="action" value="approve"/.test(r.body));
  ok('the other choice is offered as a link', /&amp;a=deny/.test(r.body) && /Deny instead/.test(r.body));
  ok('GET did NOT change the record (still pending)', (await read(rec.id)).status === 'pending');
  const d = await get({ t, a: 'deny' });
  ok('deny link → "Deny this fix?" page', /Deny this fix\?/.test(d.body) && /name="action" value="deny"/.test(d.body));
  ok('still pending after the deny page too', (await read(rec.id)).status === 'pending');
  ok('page never echoes the tenant or device hash', !r.body.includes(tenant) && !r.body.includes(DEVICE));
}

console.log('[approval-fn] POST records the decision once');
{
  const rec = await seed();
  const t = tokenFor(rec);
  const r = await postForm({ t, action: 'approve', by: 'Sam <script>alert(1)</script>' });
  ok('200 confirmation page "Approved"', r.statusCode === 200 && /<h1[^>]*>Approved<\/h1>/.test(r.body));
  const after = await read(rec.id);
  ok('record → approved with decidedBy (sanitized) + decidedAt + decidedVia:link', after.status === 'approved' && after.decidedBy === 'Sam scriptalert1script' && /^\d{4}-\d{2}-\d{2}T/.test(after.decidedAt) && after.decidedVia === 'link');
  ok('the page escapes the name (no script tag rendered)', !/<script>/.test(r.body));
  const again = await postForm({ t, action: 'deny', by: 'Eve' });
  ok('a second decision is refused (409) and the first stands', again.statusCode === 409 && (await read(rec.id)).status === 'approved' && (await read(rec.id)).decidedBy === 'Sam scriptalert1script');
  const page = await get({ t, a: 'approve' });
  ok('GET after the decision shows "Already approved" by whom', /Already approved/.test(page.body) && /Sam scriptalert1script/.test(page.body));
  // deny path + JSON
  const rec2 = await seed();
  const j = await postJson({ t: tokenFor(rec2), action: 'deny' });
  const jb = JSON.parse(j.body);
  ok('JSON deny → 200 {status:denied, decidedBy:email-link}', j.statusCode === 200 && jb.ok === true && jb.status === 'denied' && jb.decidedBy === 'email-link');
  ok('JSON view never includes the tenant', !('tenant' in jb));
  // tampered / expired / unknown action
  const rec3 = await seed();
  const bad = await postForm({ t: tokenFor(rec3).slice(0, -2) + 'zz', action: 'approve' });
  ok('tampered token → 400 "not valid", record untouched', bad.statusCode === 400 && /not valid/.test(bad.body) && (await read(rec3.id)).status === 'pending');
  const expiredRec = await seed({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const ex = await postForm({ t: tokenFor(expiredRec), action: 'approve' });
  ok('expired token → 400 "expired" page, nothing changed', ex.statusCode === 400 && /expired/.test(ex.body) && (await read(expiredRec.id)).status === 'pending');
  // record expired but token still valid (clock skew) → effectiveStatus guards it
  const skew = await seed();
  const tokenOk = tokenFor(skew);
  await memStore('sentinel-approvals').setJSON(skew.id, { ...skew, expiresAt: new Date(Date.now() - 1000).toISOString() });
  const sk = await postForm({ t: tokenOk, action: 'approve' });
  ok('a record past its expiry cannot be approved even with a still-valid token', sk.statusCode === 409 && (await read(skew.id)).status === 'pending');
  const weird = await postForm({ t: tokenFor(await seed()), action: 'reboot' });
  ok('unknown action → 400', weird.statusCode === 400);
  const missing = await get({ t: A.signApprovalToken('ffffffffffffffff', Date.now() + 60000, SECRET), a: 'approve' });
  ok('valid token for a missing record → 404 page', missing.statusCode === 404 && /not found/.test(missing.body));
}

console.log('[approval-fn] desktop poll');
{
  const rec = await seed();
  const none = await get({ poll: '1', id: rec.id });
  ok('poll without device auth → 401', none.statusCode === 401);
  const r = await get({ poll: '1', id: rec.id }, { 'x-sentinel-key': deviceKey, 'x-sentinel-device': DEVICE });
  const b = JSON.parse(r.body);
  ok('poll with device auth → {id, status:pending, expiresAt}', r.statusCode === 200 && b.status === 'pending' && b.id === rec.id && b.expiresAt === rec.expiresAt);
  ok('poll view carries no tenant', !('tenant' in b));
  const otherTenant = await get({ poll: '1', id: rec.id }, { 'x-sentinel-key': otherDeviceKey });
  ok('another tenant polling this id → 404 (never leaks the ask)', otherTenant.statusCode === 404);
  const otherDevice = await get({ poll: '1', id: rec.id }, { 'x-sentinel-key': deviceKey, 'x-sentinel-device': 'e'.repeat(32) });
  ok('same tenant, different device → 404', otherDevice.statusCode === 404);
  await postForm({ t: tokenFor(rec), action: 'approve', by: 'Ahmad' });
  const done = JSON.parse((await get({ poll: '1', id: rec.id }, { 'x-sentinel-key': deviceKey, 'x-sentinel-device': DEVICE })).body);
  ok('after the link decision the poll reports approved + decidedBy + decidedAt', done.status === 'approved' && done.decidedBy === 'Ahmad' && /^\d{4}-/.test(done.decidedAt));
  const exp = await seed({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const e = JSON.parse((await get({ poll: '1', id: exp.id }, { 'x-sentinel-key': deviceKey, 'x-sentinel-device': DEVICE })).body);
  ok('a pending record past expiry polls as expired', e.status === 'expired');
  ok('bad id → 400', (await get({ poll: '1', id: '../x' }, { 'x-sentinel-key': deviceKey })).statusCode === 400);
  ok('unknown id → 404', (await get({ poll: '1', id: 'nope' }, { 'x-sentinel-key': deviceKey })).statusCode === 404);
  process.env.SENTINEL_ADMIN_TOKEN = 'admin-token-0123456789';
  const admin = await get({ poll: '1', id: rec.id }, { 'x-internal-token': 'admin-token-0123456789' });
  ok('an internal token can poll any tenant (ops)', admin.statusCode === 200);
  delete process.env.SENTINEL_ADMIN_TOKEN;
}

console.log('[approval-fn] no secret / method / rate limit');
{
  const saved = process.env.SENTINEL_APPROVAL_SECRET; delete process.env.SENTINEL_APPROVAL_SECRET;
  const savedL = process.env.SENTINEL_LICENSE_SECRET; delete process.env.SENTINEL_LICENSE_SECRET;
  const r = await get({ t: 'x.y.z', a: 'approve' });
  ok('no signing secret → 503 page that says so (never a guess)', r.statusCode === 503 && /not set up yet/.test(r.body));
  process.env.SENTINEL_APPROVAL_SECRET = saved; process.env.SENTINEL_LICENSE_SECRET = savedL;
  ok('PUT → 405', (await fn.handler({ httpMethod: 'PUT', headers: {}, queryStringParameters: {} })).statusCode === 405);
  resetRateLimits();
  let last = null;
  for (let i = 0; i < 61; i++) last = await get({ t: 'bad', a: 'approve' });
  ok('61st page hit from one IP in 10 minutes → 429', last.statusCode === 429);
  resetRateLimits();
}

console.log(`aria-sentinel-approval: ${pass} checks green — signed tokens, GET never decides, POST decides once with decidedBy/decidedAt, expiry + tamper refused, tenant/device-scoped poll, fail-closed without a secret.`);
