#!/usr/bin/env node
// sentinel-store-and-keys.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B1 / B17 / B3 / B9).
//   lib/sentinel-store.cjs: connectLambda(event) runs BEFORE getStore, once per event, never strong
//   consistency, and a store that cannot open is a null → 503 JSON without a stack.
//   lib/sentinel-license-v2.cjs: per-customer keys — two customers on one plan get different keys, a forged
//   customer/tag is null, every key is 64 hex (the shipped desktop's gate), v1 keys (incl. the legacy
//   "admin-lifetime" message) still resolve, and the plan codes stay in lockstep with pricing-tiers.mjs.
// No network, no node_modules: the Blobs module is injected.
//   node tests/sentinel-store-and-keys.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { PLAN_ORDER, normalizePlan } from '../ARIA Sentinel/src/shared/pricing-tiers.mjs';
import { issuePlanKey, resolvePlanFromKey, keyHash as sharedKeyHash } from '../ARIA Sentinel/src/shared/license-features.mjs';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

const S = require_('../netlify/functions/lib/sentinel-store.cjs');
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const SECRET = 'test-license-secret-0123456789';

console.log('[store] connectLambda before getStore');
{
  S._setStoreFactory(null); // one-process registry safety: a previously imported suite's factory would win over the injected module
  const calls = [];
  S._setBlobsModule({
    connectLambda(event) { calls.push(['connect', event && event.headers && event.headers['x-nf-site-id']]); if (!event.blobs) throw new Error('no blobs'); },
    getStore(name) { calls.push(['getStore', name]); return { name, async get() { return null; } }; }
  });
  const event = { httpMethod: 'POST', headers: { 'x-nf-site-id': 'site1' }, blobs: Buffer.from(JSON.stringify({ url: 'https://x', token: 't' })).toString('base64') };
  const store = await S.openStore('sentinel-licenses', event);
  ok('a store opens through the real path', store && store.name === 'sentinel-licenses');
  ok('connectLambda ran before getStore', calls[0][0] === 'connect' && calls[1][0] === 'getStore');
  await S.openStore('sentinel-crashes', event);
  ok('connectLambda runs once per event object; a second store on the same event does not reconnect', calls.filter((c) => c[0] === 'connect').length === 1 && calls.filter((c) => c[0] === 'getStore').length === 2);
  const event2 = { ...event, headers: { 'x-nf-site-id': 'site2' } };
  await S.openStore('x', event2);
  ok('a new event connects again', calls.filter((c) => c[0] === 'connect').length === 2);
  calls.length = 0;
  const noBlobs = await S.openStore('x', { httpMethod: 'GET', headers: {} });
  ok('an event without Blobs credentials still gets getStore (the context may be configured elsewhere)', noBlobs && calls.some((c) => c[0] === 'getStore') && !calls.some((c) => c[0] === 'connect'));
  ok('a Fetch Request is a no-op for connect (v2 functions have their context)', await S.connectBlobs(new Request('https://x/')) === false);
  // getStore throws (MissingBlobsEnvironmentError) → null, never a throw
  S._setBlobsModule({ connectLambda() {}, getStore() { const e = new Error('The environment has not been configured to use Netlify Blobs'); e.name = 'MissingBlobsEnvironmentError'; throw e; } });
  ok('getStore throwing → null (caller answers 503), not an exception', (await S.openStore('x', event)) === null);
  const u = S.unavailable({ error: 'store error' });
  ok('unavailable() is a 503 JSON {ok:false, reason:store-unavailable} with no stack text', u.statusCode === 503 && JSON.parse(u.body).reason === 'store-unavailable' && JSON.parse(u.body).error === 'store error' && !/var\/task|at /.test(u.body));
  S._setBlobsModule(null);
  ok('no Blobs module at all → null', (await S.openStore('x', event)) === null);
  // the factory seam wins over the module
  S._setStoreFactory((name) => ({ name, mem: true }));
  ok('the test factory seam takes precedence', (await S.openStore('y', event)).mem === true);
  S._setStoreFactory(null);
  S._setBlobsModule(undefined);
}

console.log('[keys v2] per-customer keys');
{
  const a = V2.issueCustomerKey({ plan: 'pro', customerId: 'cus_A', secret: SECRET });
  const b = V2.issueCustomerKey({ plan: 'pro', customerId: 'cus_B', secret: SECRET });
  ok('two customers on the same plan get DIFFERENT keys', a !== b);
  ok('a v2 key is 64 lowercase hex — passes the desktop gate /^[a-f0-9]{64}$/', /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b));
  ok('the same customer + plan re-issues the same key (deterministic)', V2.issueCustomerKey({ plan: 'pro', customerId: 'cus_A', secret: SECRET }) === a);
  ok('plan code + customer id are parseable without the secret', V2.parseKeyV2(a).plan === 'pro' && V2.parseKeyV2(a).cust16 === V2.customerId16('cus_A'));
  const va = V2.verifyCustomerKey(a, SECRET);
  ok('verifies to { version:2, plan, cust16 }', va && va.version === 2 && va.plan === 'pro' && va.cust16 === V2.customerId16('cus_A'));
  ok('wrong secret → null', V2.verifyCustomerKey(a, 'another-secret-0123456789') === null);
  const forgedCust = a.slice(0, 2) + V2.customerId16('cus_C') + a.slice(18);
  ok('forged cust16 with a real tag → null', V2.verifyCustomerKey(forgedCust, SECRET) === null);
  const forgedPlan = V2.PLAN_CODES.admin + a.slice(2);
  ok('re-labelling a Pro key as admin → null (never admin without the admin HMAC)', V2.verifyCustomerKey(forgedPlan, SECRET) === null);
  const flipped = a.slice(0, 63) + (a.endsWith('0') ? '1' : '0');
  ok('one flipped tag character → null', V2.verifyCustomerKey(flipped, SECRET) === null);
  ok('unknown plan code (99…) → null', V2.verifyCustomerKey('99' + a.slice(2), SECRET) === null);
  ok('a v1 key is not a v2 key', V2.verifyCustomerKey(issuePlanKey('pro', SECRET), SECRET) === null);
  assert.throws(() => V2.issueCustomerKey({ plan: 'pro', customerId: 'cus_A', secret: '' }), /license-secret-missing/);
  assert.throws(() => V2.issueCustomerKey({ plan: 'platinum', customerId: 'cus_A', secret: SECRET }), /unknown-plan/);
  assert.throws(() => V2.issueCustomerKey({ plan: 'pro', secret: SECRET }), /customer-seed-missing/);
  ok('minting refuses a missing secret, an unknown plan and a missing customer seed', true);
  ok('email seeds are case-insensitive', V2.customerId16('Ahmad@Example.com') === V2.customerId16('ahmad@example.com'));
  ok('keyHash is sha256 of the key (same as the desktop + the shared module)', V2.keyHash(a) === sharedKeyHash(a) && V2.keyHash(a) === crypto.createHash('sha256').update(a).digest('hex'));
}

console.log('[keys v2] v1 keys still resolve (Rule 15) + lockstep with the shared module');
{
  for (const plan of PLAN_ORDER) {
    const k = issuePlanKey(plan, SECRET);
    const r = V2.resolveAnyKey(k, SECRET, { resolveV1: resolvePlanFromKey });
    assert.ok(r && r.version === 1 && r.plan === plan, `v1 ${plan} resolves via the shared module`);
  }
  ok('all six shared-module v1 plan keys resolve as version 1 with their plan', true);
  const legacyAdmin = crypto.createHmac('sha256', SECRET).update('sentinel-license:v1:admin-lifetime').digest('hex');
  const r = V2.resolveAnyKey(legacyAdmin, SECRET, { resolveV1: resolvePlanFromKey });
  ok('the emergency resolve\'s "admin-lifetime" key still resolves → plan admin (audit B9 alias)', r && r.version === 1 && r.plan === 'admin');
  ok('shared-module resolvePlanFromKey alone does NOT know admin-lifetime (why the alias lives here)', resolvePlanFromKey(legacyAdmin, SECRET) === null);
  const v2 = V2.issueCustomerKey({ plan: 'smb', customerId: 'sub_1', secret: SECRET });
  const r2 = V2.resolveAnyKey(v2, SECRET, { resolveV1: resolvePlanFromKey });
  ok('a v2 key resolves first (one HMAC) as version 2', r2 && r2.version === 2 && r2.plan === 'smb');
  ok('garbage → null', V2.resolveAnyKey('zz', SECRET, { resolveV1: resolvePlanFromKey }) === null && V2.resolveAnyKey('f'.repeat(64), SECRET, { resolveV1: resolvePlanFromKey }) === null);
  ok('no secret → null, never a plan', V2.resolveAnyKey(v2, '', { resolveV1: resolvePlanFromKey }) === null);
  // lockstep: every plan in pricing-tiers has a code; every alias canonicalises the same way
  ok('every pricing-tiers plan has a stable v2 plan code', PLAN_ORDER.every((p) => V2.PLAN_CODES[p]) && Object.keys(V2.PLAN_CODES).length === PLAN_ORDER.length);
  for (const alias of ['small_business', 'mid_size', 'Enterprise', 'admin-lifetime', 'professional', 'individual', 'small business', 'lifetime']) {
    assert.equal(V2.canonicalPlan(alias), normalizePlan(alias), `alias "${alias}" canonicalises like pricing-tiers`);
  }
  ok('plan aliases canonicalise exactly like pricing-tiers.normalizePlan', true);
  ok('an unknown plan is null here (fail-closed for minting) while pricing-tiers falls back to personal for display', V2.canonicalPlan('gold') === null && normalizePlan('gold') === 'personal');
  ok('the plan codes are a frozen contract (renumbering would invalidate issued keys)', Object.isFrozen(V2.PLAN_CODES) && V2.PLAN_CODES.personal === '01' && V2.PLAN_CODES.admin === '06');
}

console.log(`sentinel-store-and-keys: ${pass} checks green — connectLambda-before-getStore, null-not-throw, 503 JSON; v2 per-customer keys (64 hex, forgery-proof), v1 + admin-lifetime still resolve, plan codes in lockstep with pricing-tiers.`);
