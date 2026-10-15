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
  // lockstep: every plan in pricing-tiers has a code; every alias canonicalises the same way. The one extra code is
  // the server-only, time-boxed `trial` (07) — never a pricing tier (REVIEW FIXES 2026-10-14, P2-1).
  ok('every pricing-tiers plan has a stable v2 plan code, plus only the server-only trial code 07', PLAN_ORDER.every((p) => V2.PLAN_CODES[p]) && Object.keys(V2.PLAN_CODES).filter((p) => p !== V2.TRIAL_PLAN).length === PLAN_ORDER.length && V2.PLAN_CODES.trial === '07' && !PLAN_ORDER.includes('trial'));
  for (const alias of ['small_business', 'mid_size', 'Enterprise', 'admin-lifetime', 'professional', 'individual', 'small business', 'lifetime']) {
    assert.equal(V2.canonicalPlan(alias), normalizePlan(alias), `alias "${alias}" canonicalises like pricing-tiers`);
  }
  ok('plan aliases canonicalise exactly like pricing-tiers.normalizePlan', true);
  ok('an unknown plan is null here (fail-closed for minting) while pricing-tiers falls back to personal for display', V2.canonicalPlan('gold') === null && normalizePlan('gold') === 'personal');
  ok('the plan codes are a frozen contract (renumbering would invalidate issued keys)', Object.isFrozen(V2.PLAN_CODES) && V2.PLAN_CODES.personal === '01' && V2.PLAN_CODES.admin === '06');
}

// ===================================================================== SENTINEL REVIEW FIXES 2026-10-14
const R = require_('../netlify/functions/lib/sentinel-license-records.cjs');
const { verifyResolveSignature, verdictPayload, resolvePublicKey, SENTINEL_RESOLVE_PUBKEY_SPKI_B64, VERDICT_KEYS } = await import('../ARIA Sentinel/src/shared/sentinel-resolve-pubkey.mjs');
const { WALKTHROUGH_TRIAL_PLAN, WALKTHROUGH_TRIAL_DAYS } = await import('../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs');
const { FREE_PLAN } = await import('../ARIA Sentinel/src/shared/license-plan.mjs');

function mem({ conditional = false, failReads = false, failWrites = false } = {}) {
  const m = new Map();
  return {
    _m: m,
    async get(k, o) { if (failReads) throw new Error('read failed'); const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
    async setJSON(k, v, opts) {
      if (failWrites) throw new Error('write failed');
      if (conditional && opts && opts.onlyIfNew) { if (m.has(k)) return { modified: false }; m.set(k, JSON.stringify(v)); return { modified: true, etag: 'e1' }; }
      m.set(k, JSON.stringify(v));
      return conditional ? { modified: true, etag: 'e2' } : undefined;
    }
  };
}

console.log('[review P1-2 / P2-3] durable Blobs rate limiter — per id, per window, FAIL CLOSED');
{
  const st = mem();
  const T0 = Date.parse('2026-10-14T10:05:00.000Z');
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await S.durableLimit(st, { scope: 'notify', id: 'tenantA', limit: 3, now: T0 + i }));
  ok('limit 3 → three ok (count 1..3), the 4th refused {limited, retryAfterSec}', results.slice(0, 3).every((r, i) => r.ok && r.count === i + 1) && results[3].ok === false && results[3].limited === true && results[3].retryAfterSec > 0);
  ok('a refused call writes nothing (the counter stays at the limit)', JSON.parse([...st._m.values()][0]).count === 3);
  ok('another id has its own bucket', (await S.durableLimit(st, { scope: 'notify', id: 'tenantB', limit: 3, now: T0 })).ok === true);
  ok('the next window starts a fresh count', (await S.durableLimit(st, { scope: 'notify', id: 'tenantA', limit: 3, now: T0 + 60 * 60 * 1000 })).count === 1);
  ok('keys are rl/<scope>/<window#>/<id> — no key, no address', [...st._m.keys()].every((k) => /^rl\/notify\/\d+\/tenant[AB]$/.test(k)));
  const noStore = await S.durableLimit(null, { scope: 'notify', id: 'x', limit: 5 });
  const readFail = await S.durableLimit(mem({ failReads: true }), { scope: 'notify', id: 'x', limit: 5 });
  const writeFail = await S.durableLimit(mem({ failWrites: true }), { scope: 'notify', id: 'x', limit: 5 });
  ok('no store / a read error / a write error → {ok:false, unavailable:true} (fail closed, never "allowed")', [noStore, readFail, writeFail].every((r) => r.ok === false && r.unavailable === true));
  const chain = await S.durableLimits(mem(), [{ scope: 'a', id: '1', limit: 1 }, { scope: 'g', id: 'all', limit: 0 }], T0);
  ok('durableLimits applies each ceiling in order (a 0 limit is coerced to 1 — never unlimited)', chain.ok === true);
  const r429 = S.limitResponse({ limited: true, retryAfterSec: 42, scope: 'notify' });
  const r503 = S.limitResponse({ unavailable: true });
  ok('limitResponse: limited → 429 {rate_limited} + retry-after; unavailable → 503 {rate-limiter-unavailable}', r429.statusCode === 429 && JSON.parse(r429.body).error === 'rate_limited' && r429.headers['retry-after'] === '42' && r503.statusCode === 503 && JSON.parse(r503.body).error === 'rate-limiter-unavailable');
}

console.log('[review P2-5] one-writer claim — conditional write when the client has it, write-then-verify otherwise');
{
  S._setClaimSettleMs(15);
  const st = mem();
  const offset = async (n, fn) => { for (let i = 0; i < n; i++) await null; return fn(); };
  const [a, b] = await Promise.all([S.claimOnce(st, 'mint/sub_1'), offset(3, () => S.claimOnce(st, 'mint/sub_1'))]);
  ok('two near-simultaneous claims on a v7-style store (no conditional write) → exactly one wins (write, settle, verify)', [a, b].filter((x) => x.claimed).length === 1 && [a, b].some((x) => x.mode === 'verify'));
  S._setClaimSettleMs(0);
  ok('a third claim while the winner holds it → not claimed (existing holder)', (await S.claimOnce(st, 'mint/sub_1')).claimed === false);
  const cst = mem({ conditional: true });
  const [c, d] = await Promise.all([S.claimOnce(cst, 'mint/sub_2'), S.claimOnce(cst, 'mint/sub_2')]);
  ok('on a store with onlyIfNew (@netlify/blobs ≥ 8) → exactly one wins (conditional mode)', [c, d].filter((x) => x.claimed).length === 1 && [c, d].some((x) => x.mode === 'conditional'));
  await S.finishClaim(st, 'mint/sub_1', 'released');
  ok('a released claim can be taken again', (await S.claimOnce(st, 'mint/sub_1')).claimed === true);
  const stale = mem();
  stale._m.set('mint/sub_3', JSON.stringify({ claim: 'old', at: '2020-01-01T00:00:00.000Z', state: 'claimed' }));
  ok('a stale claim (crashed run, older than the TTL) is taken over', (await S.claimOnce(stale, 'mint/sub_3')).claimed === true);
  ok('store failure → {claimed:false, unavailable:true}', (await S.claimOnce(mem({ failReads: true }), 'k')).unavailable === true && (await S.claimOnce(null, 'k')).unavailable === true);
  S._setClaimSettleMs(null);
}

console.log('[review P2-1] the time-boxed trial key (plan code 07, expiry inside the key)');
{
  const exp = Date.parse('2026-11-13T12:00:00.000Z');
  const t = V2.issueTrialKey({ seed: 'cs_test_wt_1', expiresAt: exp, secret: SECRET });
  ok('a trial key is 64 hex starting 07 (passes the desktop gate)', /^07[a-f0-9]{62}$/.test(t));
  const v = V2.verifyCustomerKey(t, SECRET);
  ok('it verifies as plan trial and carries its expiry', v && v.plan === 'trial' && v.expires_at === '2026-11-13T12:00:00.000Z' && V2.trialExpiresAt(t) === v.expires_at);
  const extended = t.slice(0, 10) + 'ffffffff' + t.slice(18);
  ok('rewriting the expiry inside the key breaks the HMAC tag → null (cannot be extended without the secret)', V2.verifyCustomerKey(extended, SECRET) === null);
  ok('resolveAnyKey resolves it as v2 trial', V2.resolveAnyKey(t, SECRET, { resolveV1: resolvePlanFromKey }).plan === 'trial');
  const live = V2.effectivePlan(V2.resolveAnyKey(t, SECRET), Date.parse('2026-10-20T00:00:00.000Z'));
  const dead = V2.effectivePlan(V2.resolveAnyKey(t, SECRET), Date.parse('2026-11-14T00:00:00.000Z'));
  ok('before expiry → {plan:pro, status:active, expires_at}; after → {plan:free, status:expired}', live.plan === 'pro' && live.status === 'active' && live.expires_at === v.expires_at && dead.plan === 'free' && dead.status === 'expired');
  ok('the effective plans are in lockstep with the funnel (Pro trial) and the free floor', V2.TRIAL_EFFECTIVE_PLAN === WALKTHROUGH_TRIAL_PLAN && V2.FREE_FLOOR_PLAN === FREE_PLAN && V2.TRIAL_DAYS === WALKTHROUGH_TRIAL_DAYS);
  assert.throws(() => V2.issueCustomerKey({ plan: 'trial', seed: 'x', secret: SECRET }), /trial-key-needs-expiry/);
  assert.throws(() => V2.issueTrialKey({ seed: 'x', secret: SECRET }), /trial-expiry-missing/);
  ok('a trial key can only be minted WITH an expiry (issueCustomerKey refuses the trial plan)', true);
  ok('a normal key has no trial expiry and is "active" with expires_at null', V2.trialExpiresAt(V2.issueCustomerKey({ plan: 'pro', seed: 's', secret: SECRET })) === null && V2.effectivePlan({ version: 2, plan: 'pro' }, Date.now()).expires_at === null);
}

console.log('[review P1-2] recipient rule: Stripe buyer email + admin-approved contacts + admin inbox — nothing else');
{
  const rec = { email: 'buyer@corp.example', contacts: ['msp@partner.example'], contact_phones: ['+1 (416) 555-1234'] };
  ok('the record (Stripe buyer) email → allowed via record-email', R.isAllowedRecipient('Buyer@Corp.example', { keyRecord: rec }).via === 'record-email');
  ok('an admin-approved contact → allowed via approved-contact', R.isAllowedRecipient('msp@partner.example', { keyRecord: rec }).via === 'approved-contact');
  ok('the admin inbox → always allowed (even with no record)', R.isAllowedRecipient('integrateditsupp@gmail.com', {}).via === 'admin-inbox' && R.isAllowedRecipient('ahmad.wasee@iisupp.net', { keyRecord: null }).ok);
  ok('a same-domain colleague is NO LONGER allowed (the B5 rule the review bypassed)', R.isAllowedRecipient('cfo@corp.example', { keyRecord: rec }).ok === false);
  ok('a device-registered (self-declared) email is ignored even when passed in', R.isAllowedRecipient('victim@elsewhere.example', { keyRecord: rec, deviceRecord: { email: 'victim@elsewhere.example' } }).ok === false);
  ok('a shared v1 plan key → admin inbox only, even when a record holds the key', R.isAllowedRecipient('buyer@corp.example', { keyRecord: rec, sharedKey: true }).ok === false && R.isAllowedRecipient('integrateditsupp@gmail.com', { keyRecord: rec, sharedKey: true }).ok);
  ok('no record → admin inbox only', R.isAllowedRecipient('buyer@corp.example', { keyRecord: null }).ok === false);
  ok('phones: only an admin-approved number (any formatting), never for a shared key', R.isAllowedPhone('+14165551234', { keyRecord: rec }).ok && !R.isAllowedPhone('+14165559999', { keyRecord: rec }).ok && !R.isAllowedPhone('+14165551234', { keyRecord: rec, sharedKey: true }).ok);
  ok('SENTINEL_ADMIN_INBOX adds an admin inbox', R.isAllowedRecipient('ops@iis.example', { env: { SENTINEL_ADMIN_INBOX: 'ops@iis.example' } }).via === 'admin-inbox');
  ok('REVOCATION_EFFECT states the real effect (P2-9)', R.REVOCATION_EFFECT === 'Notifications and approvals stop at once; the desktop drops to the free tier at its next license check (within 1 hour when the verdict is unsigned, within 24 hours when signed).');
  const idx = R.keyIndexFromRecord({ key: 'k', tier: 'trial', expires_at: '2026-11-13T00:00:00.000Z', payment_failed_at: '2026-10-01T00:00:00.000Z', contact_phones: ['+14165551234'] });
  ok('the key index carries expires_at, payment_failed_at and approved phones (one read for resolve / notify)', idx.expires_at && idx.payment_failed_at && idx.contact_phones[0] === '+14165551234' && !JSON.stringify(idx).includes('"key"'));
}

console.log('[review P1-3] the app\'s verdict verifier — embedded public key + a throwaway round-trip');
{
  const pub = resolvePublicKey();
  ok('the embedded SPKI public key parses as Ed25519', pub && pub.asymmetricKeyType === 'ed25519' && SENTINEL_RESOLVE_PUBKEY_SPKI_B64 === 'MCowBQYDK2VwAyEABJ3c5Hwd7rykf6NHfGnwJslUjQJNKEKQxuZq2jmcP7g=');
  ok('the verdict contract keys, in order', JSON.stringify(VERDICT_KEYS) === JSON.stringify(['key_sha256', 'plan', 'status', 'seats', 'expires_at', 'verified_at', 'device']));
  // A THROWAWAY pair generated in-process — the real private key exists only in Netlify env and is never here.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const throwawayPub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const verdict = { key_sha256: 'a'.repeat(64), plan: 'pro', status: 'active', seats: 5, expires_at: null, verified_at: '2026-10-14T10:00:00.000Z', device: 'dev0123456789abcdef' };
  const sig = crypto.sign(null, Buffer.from(JSON.stringify(verdict)), privateKey).toString('base64url');
  ok('round-trip: a verdict signed over JSON.stringify(contract order) verifies with the matching public key', verifyResolveSignature(verdict, sig, throwawayPub) === true);
  ok('…field order in the caller\'s object does not matter (verdictPayload re-orders to the contract)', verifyResolveSignature({ device: verdict.device, plan: 'pro', status: 'active', key_sha256: verdict.key_sha256, seats: 5, expires_at: null, verified_at: verdict.verified_at }, sig, throwawayPub) === true && verdictPayload(verdict) === JSON.stringify(verdict));
  ok('the same signature does NOT verify under the embedded production key (different private key)', verifyResolveSignature(verdict, sig) === false);
  ok('a tampered plan / status / device → false', !verifyResolveSignature({ ...verdict, plan: 'admin' }, sig, throwawayPub) && !verifyResolveSignature({ ...verdict, status: 'revoked' }, sig, throwawayPub) && !verifyResolveSignature({ ...verdict, device: 'other' }, sig, throwawayPub));
  const { seats, ...missing } = verdict; void seats;
  ok('a verdict missing a contract field → false (no silent defaults)', verifyResolveSignature(missing, sig, throwawayPub) === false);
  ok('junk never throws: bad sig shape, non-object verdict, unparseable key → false', verifyResolveSignature(verdict, 'x', throwawayPub) === false && verifyResolveSignature(null, sig, throwawayPub) === false && verifyResolveSignature(verdict, sig, 'not-a-key') === false && verifyResolveSignature(verdict, sig + '=', throwawayPub) === false);
}

console.log(`sentinel-store-and-keys: ${pass} checks green — connectLambda-before-getStore, null-not-throw, 503 JSON; v2 per-customer keys (64 hex, forgery-proof), v1 + admin-lifetime still resolve, plan codes in lockstep with pricing-tiers; durable fail-closed limiter, one-writer claim, trial keys with the expiry inside, the narrowed recipient rule, the verdict verifier round-trip.`);
