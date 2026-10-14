#!/usr/bin/env node
// sentinel-stripe-webhook.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B7 / B12 / B3 / B4 / B1).
// netlify/functions/sentinel-stripe-webhook.mjs, run with a fake Stripe client (signature = a test HMAC) and an
// in-memory Blobs store:
//   - B7: it verifies with STRIPE_SENTINEL_WEBHOOK_SECRET when set (its own endpoint secret), falls back to
//     STRIPE_WEBHOOK_SECRET, and refuses a body signed with neither;
//   - B12: an ARIA-web tier (tier:"pro") is skipped "not-a-sentinel-plan"; sentinel_pro_m mints;
//   - B3: the minted key is a per-customer v2 key; the record carries seats + key_version; the key index is
//     written; the customer email carries the key, the admin email a masked one;
//   - B1/Rule 14: a store that cannot be opened or written → 503 and NO email (Stripe retries later);
//   - B4: customer.subscription.deleted revokes the record AND writes the revocation entry;
//   - idempotency: the same subscription never mints twice; concierge Walk-Through orders still work.
//   node tests/sentinel-stripe-webhook.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { keyHash } from '../ARIA Sentinel/src/shared/license-features.mjs';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SENTINEL_LICENSE_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_SENTINEL_WEBHOOK_SECRET']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_SENTINEL_WEBHOOK_SECRET = 'whsec_sentinel_0123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_web_0123456789';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';

const mails = [];
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) { mails.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'msg_' + mails.length }), { status: 200 }); }
  throw new Error('unexpected network call in test: ' + u);
};

// ---- in-memory Blobs with a kill switch (null store) and a write-failure switch
const stores = new Map();
let blobsDown = false;
let writesFail = false;
function memStore(name) {
  if (blobsDown) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { if (writesFail) throw new Error('write failed'); m.set(k, JSON.stringify(v)); },
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
const wh = await import('../netlify/functions/sentinel-stripe-webhook.mjs');

// ---- fake Stripe: signature = "t=<ts>,v1=HMAC(secret, body)"; constructEvent throws like the SDK does.
const sign = (body, secret) => `t=1,v1=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
const customers = { cus_1: { email: 'buyer@corp.example', name: 'Buyer One' } };
wh._setStripeFactory(() => ({
  webhooks: { constructEvent(body, sig, secret) { if (!sig) throw new Error('No stripe-signature header value was provided.'); if (sig !== sign(body, secret)) throw new Error('No signatures found matching the expected signature for payload'); return JSON.parse(body); } },
  customers: { async retrieve(id) { return customers[id] || { deleted: true }; } }
}));
const deliver = async (evt, { secret = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET, noSig = false } = {}) => {
  const body = JSON.stringify(evt);
  const r = await wh.handler({ httpMethod: 'POST', headers: noSig ? {} : { 'stripe-signature': sign(body, secret) }, body });
  let json = null; try { json = JSON.parse(r.body); } catch { json = null; }
  return { status: r.statusCode, json, raw: r.body };
};
const session = (over = {}) => ({ id: 'evt_1', type: 'checkout.session.completed', created: 1760450000, data: { object: { id: 'cs_test_1', subscription: 'sub_100', customer: 'cus_1', metadata: { tier: 'sentinel_pro_m', kind: 'aria-plan', planName: 'ARIA Sentinel Pro' }, customer_details: { email: 'buyer@corp.example', name: 'Buyer One' }, ...over } } });

console.log('[webhook] signing secret (B7)');
{
  ok('webhookSecrets prefers STRIPE_SENTINEL_WEBHOOK_SECRET, then STRIPE_WEBHOOK_SECRET', JSON.stringify(wh.webhookSecrets().map((s) => s.name)) === JSON.stringify(['STRIPE_SENTINEL_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET']));
  ok('no signature header → 400', (await deliver(session(), { noSig: true })).status === 400);
  ok('a body signed with a third, unknown secret → 400', (await deliver(session(), { secret: 'whsec_other' })).status === 400 && mails.length === 0);
  const r = await deliver(session({ id: 'cs_fallback', subscription: 'sub_fb' }), { secret: process.env.STRIPE_WEBHOOK_SECRET });
  ok('a body signed with the shared STRIPE_WEBHOOK_SECRET still verifies (fallback during the switch-over)', r.status === 200 && r.json.minted === true);
  ok('ignored event types → 200 {ignored}', (await deliver({ id: 'e', type: 'invoice.paid', data: { object: {} } })).json.ignored === 'invoice.paid');
  const saved = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET; delete process.env.STRIPE_SENTINEL_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
  ok('neither secret set → 500 "Webhook not configured"', (await deliver(session(), { secret: 'whsec_whatever' })).status === 500);
  process.env.STRIPE_SENTINEL_WEBHOOK_SECRET = saved; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_web_0123456789';
  mails.length = 0; stores.clear();
}

console.log('[webhook] only sentinel_* tiers mint (B12)');
{
  ok('sentinelPlanFrom maps sentinel_* lookup keys', wh.sentinelPlanFrom('sentinel_pro_m') === 'pro' && wh.sentinelPlanFrom('sentinel_business_y') === 'smb' && wh.sentinelPlanFrom('SENTINEL_ENTERPRISE_Y') === 'enterprise');
  ok('…and the bare ARIA-web tiers to null', wh.sentinelPlanFrom('pro') === null && wh.sentinelPlanFrom('small_business_y') === null && wh.sentinelPlanFrom('personal') === null);
  ok('price metadata.sentinel_tier is accepted', wh.sentinelPlanFrom('', 'midsize') === 'midsize');
  const web = await deliver(session({ id: 'cs_web', subscription: 'sub_web', metadata: { tier: 'pro', kind: 'aria-plan' } }));
  ok('an ARIA-web "pro" checkout → skipped not-a-sentinel-plan, nothing stored, no email', web.status === 200 && web.json.skipped === 'not-a-sentinel-plan' && !stores.has('sentinel-licenses') && mails.length === 0);
  const webSub = await deliver({ id: 'e2', type: 'customer.subscription.created', created: 1760450000, data: { object: { id: 'sub_web2', customer: 'cus_1', items: { data: [{ price: { lookup_key: 'pro', metadata: {} }, quantity: 1 }] } } } });
  ok('an ARIA-web subscription.created (lookup_key "pro") → skipped', webSub.json.skipped === 'not-a-sentinel-plan' && mails.length === 0);
}

console.log('[webhook] a Sentinel checkout mints a v2 key, stores first, emails second (B3/B1)');
{
  mails.length = 0;
  const r = await deliver(session());
  ok('200 {minted, subscription_id, tier:pro, keyVersion:2, seats:5, indexed, emailed}', r.status === 200 && r.json.minted === true && r.json.subscription_id === 'sub_100' && r.json.tier === 'pro' && r.json.keyVersion === 2 && r.json.seats === 5 && r.json.indexed === true && r.json.emailed.customer === true && r.json.emailed.admin === true);
  const rec = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  ok('record: 64-hex v2 key bound to the subscription, status active, email scrubbed, key_version 2', /^[a-f0-9]{64}$/.test(rec.key) && V2.verifyCustomerKey(rec.key, process.env.SENTINEL_LICENSE_SECRET).plan === 'pro' && rec.status === 'active' && rec.email === 'buyer@corp.example' && rec.key_version === 2 && rec.customer_id === 'cus_1');
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('key index written under sha256(key): subscription, tier, email, seats, active', idx && idx.subscription_id === 'sub_100' && idx.tier === 'pro' && idx.email === 'buyer@corp.example' && idx.seats === 5 && idx.status === 'active');
  ok('customer email carries the key; admin email only a masked key', mails[0].to === 'buyer@corp.example' && mails[0].text.includes(rec.key) && mails[1].to === 'ahmad.wasee@iisupp.net' && !mails[1].text.includes(rec.key) && /…/.test(mails[1].text));
  ok('the response never carries the key', !r.raw.includes(rec.key));
  mails.length = 0;
  const again = await deliver(session());
  ok('the same subscription again → idempotent, no second key, no second email', again.json.idempotent === true && mails.length === 0);
  const sub = await deliver({ id: 'e3', type: 'customer.subscription.created', created: 1760450000, data: { object: { id: 'sub_100', customer: 'cus_1', items: { data: [{ price: { lookup_key: 'sentinel_pro_m', metadata: { sentinel_tier: 'pro' } }, quantity: 1 }] } } } });
  ok('customer.subscription.created for the same subscription → idempotent too', sub.json.idempotent === true && mails.length === 0);
  const sub2 = await deliver({ id: 'e4', type: 'customer.subscription.created', created: 1760450000, data: { object: { id: 'sub_200', customer: 'cus_1', metadata: { seats: '30' }, items: { data: [{ price: { lookup_key: 'sentinel_business_y', metadata: { sentinel_tier: 'smb' } }, quantity: 1 }] } } } });
  ok('a subscription.created with a sentinel_business_y price mints smb with metadata.seats 30 (customer fetched from Stripe)', sub2.json.minted === true && sub2.json.tier === 'smb' && sub2.json.seats === 30 && mails[0].to === 'buyer@corp.example');
  const a = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  const b = await memStore('sentinel-licenses').get('sub_200', { type: 'json' });
  ok('two subscriptions → two different keys', a.key !== b.key);
  ok('missing email (deleted customer) → skipped incomplete', (await deliver({ id: 'e5', type: 'customer.subscription.created', created: 1, data: { object: { id: 'sub_300', customer: 'cus_gone', items: { data: [{ price: { lookup_key: 'sentinel_pro_m' } }] } } } })).json.skipped === 'incomplete');
}

console.log('[webhook] store loss → 503 before any email (B1 / Rule 14)');
{
  mails.length = 0;
  blobsDown = true;
  const r = await deliver(session({ id: 'cs_down', subscription: 'sub_down' }));
  ok('Blobs unreachable → 503 {ok:false, reason:store-unavailable, stage:mint}, no email', r.status === 503 && r.json.reason === 'store-unavailable' && r.json.stage === 'mint' && mails.length === 0);
  blobsDown = false;
  writesFail = true;
  const w = await deliver(session({ id: 'cs_wf', subscription: 'sub_wf' }));
  ok('a failed record write → 503 stage:mint-write, no email (the customer is never told a key exists that was not stored)', w.status === 503 && w.json.stage === 'mint-write' && mails.length === 0);
  writesFail = false;
  ok('no stack text in a 503 body', !/at |var\/task/.test(r.raw + w.raw));
}

console.log('[webhook] customer.subscription.deleted revokes (B4)');
{
  mails.length = 0;
  const rec = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  const r = await deliver({ id: 'e6', type: 'customer.subscription.deleted', created: 1760460000, data: { object: { id: 'sub_100', customer: 'cus_1' } } });
  ok('200 {revoked:true, enforced:true} with the honest effect copy', r.status === 200 && r.json.revoked === true && r.json.enforced === true && /24 hours/.test(r.json.effect));
  const after = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  ok('record status revoked with the Stripe reason', after.status === 'revoked' && after.revoked_reason === 'stripe:customer.subscription.deleted');
  const entry = await memStore('sentinel-licenses-revocations').get(keyHash(rec.key), { type: 'json' });
  ok('revocation entry written under sha256(key) — what sentinel-resolve and device auth read', entry && entry.revoked === true && entry.subscription_id === 'sub_100');
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('key index flipped to revoked', idx.status === 'revoked');
  ok('no email on cancellation', mails.length === 0);
  ok('deleting again → idempotent', (await deliver({ id: 'e7', type: 'customer.subscription.deleted', created: 1, data: { object: { id: 'sub_100' } } })).json.idempotent === true);
  ok('an unknown subscription → ignored no-record (200, Stripe is not retried)', (await deliver({ id: 'e8', type: 'customer.subscription.deleted', created: 1, data: { object: { id: 'sub_unknown' } } })).json.ignored === 'no-record');
}

console.log('[webhook] Concierge Walk-Through order still grants the trial (unchanged path, v2 key)');
{
  mails.length = 0;
  const r = await deliver({ id: 'e9', type: 'checkout.session.completed', created: 1760450000, data: { object: { id: 'cs_wt_1', customer: 'cus_1', metadata: { kind: 'ai-setup-walkthrough', tier: 'ai-setup-walkthrough' }, customer_details: { email: 'wt@example.com', name: 'Walk Through' } } } });
  ok('200 {walkthroughEntitled, trialEndsAt, keyVersion:2, entitlementStored, emailed}', r.status === 200 && r.json.walkthroughEntitled === true && r.json.trialEndsAt && r.json.keyVersion === 2 && r.json.entitlementStored === true && r.json.emailed.customer === true);
  const rec = await memStore('sentinel-licenses').get('cs_wt_1', { type: 'json' });
  ok('the Concierge key is a v2 Personal key (never the shared plan key)', V2.verifyCustomerKey(rec.key, process.env.SENTINEL_LICENSE_SECRET).plan === 'personal' && rec.walkthroughEntitled === true);
  const ent = await memStore('sentinel-walkthrough-entitlements').get('wt@example.com', { type: 'json' });
  ok('entitlement stored by lowercased email for sentinel-resolve', ent && ent.walkthroughEntitled === true);
  ok('welcome mail names the 30-day trial and carries the key', /30-day/.test(mails[0].text) && mails[0].text.includes(rec.key));
}

console.log(`sentinel-stripe-webhook: ${pass} checks green — own signing secret with fallback, sentinel_* only, v2 per-customer keys + key index, store-before-email with 503 on loss, cancellation revokes, idempotent, Concierge path intact.`);
