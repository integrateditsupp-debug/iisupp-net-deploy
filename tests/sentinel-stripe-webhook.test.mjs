#!/usr/bin/env node
// sentinel-stripe-webhook.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B7 / B12 / B3 / B4 / B1) + SENTINEL REVIEW
// FIXES 2026-10-14 (P0-1 / P2-1 / P2-5). netlify/functions/sentinel-stripe-webhook.mjs (+ stripe-checkout.js,
// stripe-confirm.js), run with a fake Stripe client (signature = a test HMAC) and an in-memory Blobs store:
//   - B7: it verifies with STRIPE_SENTINEL_WEBHOOK_SECRET when set, falls back to STRIPE_WEBHOOK_SECRET;
//   - B12: an ARIA-web price is skipped "not-a-sentinel-plan"; sentinel_pro_m mints;
//   - B3 / B1: v2 key, record + key index, store-before-email, 503 on store loss;
//   - P0-1: a $1 ONE-TIME checkout carrying tier "sentinel_enterprise_y" mints NOTHING (stripe-checkout no longer
//     copies the client tier; the webhook needs mode subscription + paid, and reads the plan from the subscription's
//     PRICE — a session whose metadata says enterprise but whose price is sentinel_pro_m gets a PRO key);
//     stripe-confirm issues an ARIA-web license only for a paid subscription, for the tier its price is;
//   - P2-1: the AI Setup Walk-Through (one-time, server-set product marker) mints a 30-day TRIAL key bound to the
//     entitlement, keyed by buyer email, and emails it — the reviewer's p2-walkthrough-dead.mjs shape;
//   - P2-5: subscription.updated (past_due/unpaid/canceled → revoke; back to active → restore; plan change → old key
//     revoked + new key minted + emailed once), invoice.payment_failed → past_due 7 days later, invoice.paid clears;
//     checkout.session.completed + customer.subscription.created delivered CONCURRENTLY email the key once.
//   node tests/sentinel-stripe-webhook.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { keyHash } from '../ARIA Sentinel/src/shared/license-features.mjs';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'SENTINEL_LICENSE_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_SENTINEL_WEBHOOK_SECRET', 'SENTINEL_RESOLVE_SIGNING_KEY', 'INTERNAL_WEBHOOK_SECRET', 'ARIA_ADMIN_TOKEN', 'STRIPE_PRICE_PRO', 'URL']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_SENTINEL_WEBHOOK_SECRET = 'whsec_sentinel_0123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_web_0123456789';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_FROM = 'ARIA <noreply@iisupp.net>';

const mails = [];
const licenseCalls = [];
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/emails')) { mails.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'msg_' + mails.length }), { status: 200 }); }
  if (/\/\.netlify\/functions\/aria-license$/.test(u)) { const b = JSON.parse(init.body); licenseCalls.push(b); return new Response(JSON.stringify({ ok: true, token: 'ARIA-' + String(b.plan).toUpperCase() + '-TEST', plan: b.plan }), { status: 200 }); }
  throw new Error('unexpected network call in test: ' + u);
};

// ---- in-memory Blobs with a kill switch (null store), a write-failure switch, and an optional conditional-write mode
const stores = new Map();
let blobsDown = false;
let writesFail = null; // null | true (every store) | 'store-name'
let conditionalWrites = false;
function memStore(name) {
  if (blobsDown) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async set(k, v) { m.set(k, String(v)); },
      async setJSON(k, v, opts) {
        if (writesFail === true || writesFail === name) throw new Error('write failed');
        if (conditionalWrites && opts && opts.onlyIfNew) { if (m.has(k)) return { modified: false }; m.set(k, JSON.stringify(v)); return { modified: true, etag: 'e' }; }
        m.set(k, JSON.stringify(v));
        return conditionalWrites ? { modified: true, etag: 'e' } : undefined;
      },
      async delete(k) { m.delete(k); },
      async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const S = require_('../netlify/functions/lib/sentinel-store.cjs');
S._setStoreFactory((name) => memStore(name));
S._setClaimSettleMs(0);
require_('../netlify/functions/lib/sentinel-approvals.cjs')._setStoreFactory((name) => memStore(name)); // one-process registry safety
require_('../netlify/functions/_rate-limit.js').resetRateLimits();
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const wh = await import('../netlify/functions/sentinel-stripe-webhook.mjs');
const checkout = require_('../netlify/functions/stripe-checkout.js');
const confirm = require_('../netlify/functions/stripe-confirm.js');
const resolve = await import('../netlify/functions/sentinel-resolve.mjs');

// ---- fake Stripe: signature = "t=<ts>,v1=HMAC(secret, body)"; constructEvent throws like the SDK does.
const sign = (body, secret) => `t=1,v1=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
const customers = { cus_1: { email: 'buyer@corp.example', name: 'Buyer One' } };
const subscriptions = {}; // id → subscription object (what stripe.subscriptions.retrieve answers)
let subscriptionsDown = false;
const priceOf = (lookup) => ({ id: 'price_' + lookup, lookup_key: lookup, metadata: {} });
const subObj = (id, lookup, over = {}) => ({ id, object: 'subscription', status: 'active', customer: 'cus_1', metadata: {}, items: { data: [{ price: priceOf(lookup), quantity: 1 }] }, ...over });
wh._setStripeFactory(() => ({
  webhooks: { constructEvent(body, sig, secret) { if (!sig) throw new Error('No stripe-signature header value was provided.'); if (sig !== sign(body, secret)) throw new Error('No signatures found matching the expected signature for payload'); return JSON.parse(body); } },
  customers: { async retrieve(id) { return customers[id] || { deleted: true }; } },
  subscriptions: { async retrieve(id) { if (subscriptionsDown) throw new Error('stripe 500'); if (!subscriptions[id]) throw new Error('No such subscription'); return subscriptions[id]; } }
}));
const deliver = async (evt, { secret = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET, noSig = false } = {}) => {
  const body = JSON.stringify(evt);
  const r = await wh.handler({ httpMethod: 'POST', headers: noSig ? {} : { 'stripe-signature': sign(body, secret) }, body });
  let json = null; try { json = JSON.parse(r.body); } catch { json = null; }
  return { status: r.statusCode, json, raw: r.body };
};
// A REAL paid subscription Checkout Session (mode + payment_status + subscription id) — the shape Stripe sends.
const session = (over = {}) => {
  const sub = over.subscription === undefined ? 'sub_100' : over.subscription;
  if (sub && typeof sub === 'string' && !subscriptions[sub]) subscriptions[sub] = subObj(sub, over._lookup || 'sentinel_pro_m');
  const o = { ...over }; delete o._lookup;
  return { id: 'evt_1', type: 'checkout.session.completed', created: 1760450000, data: { object: { id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', subscription: sub, customer: 'cus_1', metadata: { tier: 'sentinel_pro_m', kind: 'aria-plan', planName: 'ARIA Sentinel Pro' }, customer_details: { email: 'buyer@corp.example', name: 'Buyer One' }, ...o } } };
};
const nowSec = () => Math.floor(Date.now() / 1000);
let ipSeq = 0;
const resolvePost = async (key, extraHeaders = {}) => {
  const r = await resolve.handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': `198.18.0.${++ipSeq % 250}`, ...extraHeaders }, body: JSON.stringify({ key }) });
  return { status: r.statusCode, json: JSON.parse(r.body) };
};
const keyFromMail = (m) => (/\n\s+([a-f0-9]{64})\n/.exec(m.text) || [])[1];

console.log('[webhook] signing secret (B7)');
{
  ok('webhookSecrets prefers STRIPE_SENTINEL_WEBHOOK_SECRET, then STRIPE_WEBHOOK_SECRET', JSON.stringify(wh.webhookSecrets().map((s) => s.name)) === JSON.stringify(['STRIPE_SENTINEL_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET']));
  ok('no signature header → 400', (await deliver(session(), { noSig: true })).status === 400);
  ok('a body signed with a third, unknown secret → 400', (await deliver(session(), { secret: 'whsec_other' })).status === 400 && mails.length === 0);
  const r = await deliver(session({ id: 'cs_fallback', subscription: 'sub_fb' }), { secret: process.env.STRIPE_WEBHOOK_SECRET });
  ok('a body signed with the shared STRIPE_WEBHOOK_SECRET still verifies (fallback during the switch-over)', r.status === 200 && r.json.minted === true);
  ok('unhandled event types → 200 {ignored}', (await deliver({ id: 'e', type: 'charge.refunded', data: { object: {} } })).json.ignored === 'charge.refunded');
  const saved = process.env.STRIPE_SENTINEL_WEBHOOK_SECRET; delete process.env.STRIPE_SENTINEL_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
  ok('neither secret set → 500 "Webhook not configured"', (await deliver(session(), { secret: 'whsec_whatever' })).status === 500);
  process.env.STRIPE_SENTINEL_WEBHOOK_SECRET = saved; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_web_0123456789';
  mails.length = 0; stores.clear();
}

console.log('[webhook] only sentinel_* plans mint (B12)');
{
  ok('sentinelPlanFrom maps sentinel_* lookup keys', wh.sentinelPlanFrom('sentinel_pro_m') === 'pro' && wh.sentinelPlanFrom('sentinel_business_y') === 'smb' && wh.sentinelPlanFrom('SENTINEL_ENTERPRISE_Y') === 'enterprise');
  ok('…and the bare ARIA-web tiers to null', wh.sentinelPlanFrom('pro') === null && wh.sentinelPlanFrom('small_business_y') === null && wh.sentinelPlanFrom('personal') === null);
  ok('price metadata.sentinel_tier is accepted', wh.sentinelPlanFrom('', 'midsize') === 'midsize');
  const web = await deliver(session({ id: 'cs_web', subscription: 'sub_web', _lookup: 'pro', metadata: { tier: 'pro', kind: 'aria-plan' } }));
  ok('an ARIA-web "pro" subscription checkout → skipped not-a-sentinel-plan, nothing stored, no email', web.status === 200 && web.json.skipped === 'not-a-sentinel-plan' && !(stores.get('sentinel-licenses') && stores.get('sentinel-licenses')._m.size) && mails.length === 0);
  const webSub = await deliver({ id: 'e2', type: 'customer.subscription.created', created: 1760450000, data: { object: subObj('sub_web2', 'pro') } });
  ok('an ARIA-web subscription.created (lookup_key "pro") → skipped', webSub.json.skipped === 'not-a-sentinel-plan' && mails.length === 0);
}

console.log('[webhook] a Sentinel subscription mints a v2 key, stores first, emails second (B3/B1)');
{
  mails.length = 0;
  const r = await deliver(session());
  ok('200 {minted, subscription_id, tier:pro, keyVersion:2, seats:5, indexed, emailed}', r.status === 200 && r.json.minted === true && r.json.subscription_id === 'sub_100' && r.json.tier === 'pro' && r.json.keyVersion === 2 && r.json.seats === 5 && r.json.indexed === true && r.json.emailed.customer === true && r.json.emailed.admin === true);
  const rec = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  ok('record: 64-hex v2 key bound to the subscription, status active, email scrubbed, key_version 2, emailed_customer_at', /^[a-f0-9]{64}$/.test(rec.key) && V2.verifyCustomerKey(rec.key, process.env.SENTINEL_LICENSE_SECRET).plan === 'pro' && rec.status === 'active' && rec.email === 'buyer@corp.example' && rec.key_version === 2 && rec.customer_id === 'cus_1' && rec.emailed_customer_at);
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('key index written under sha256(key): subscription, tier, email, seats, active', idx && idx.subscription_id === 'sub_100' && idx.tier === 'pro' && idx.email === 'buyer@corp.example' && idx.seats === 5 && idx.status === 'active');
  ok('customer email carries the key; admin email only a masked key', mails[0].to === 'buyer@corp.example' && mails[0].text.includes(rec.key) && mails[1].to === 'ahmad.wasee@iisupp.net' && !mails[1].text.includes(rec.key) && /…/.test(mails[1].text));
  ok('the response never carries the key', !r.raw.includes(rec.key));
  mails.length = 0;
  const again = await deliver(session());
  ok('the same subscription again → idempotent, no second key, no second email', again.json.idempotent === true && mails.length === 0);
  const sub = await deliver({ id: 'e3', type: 'customer.subscription.created', created: 1760450000, data: { object: subObj('sub_100', 'sentinel_pro_m') } });
  ok('customer.subscription.created for the same subscription → idempotent too', sub.json.idempotent === true && mails.length === 0);
  const sub2 = await deliver({ id: 'e4', type: 'customer.subscription.created', created: 1760450000, data: { object: subObj('sub_200', 'sentinel_business_y', { metadata: { seats: '30' } }) } });
  ok('a subscription.created with a sentinel_business_y price mints smb with metadata.seats 30 (customer fetched from Stripe)', sub2.json.minted === true && sub2.json.tier === 'smb' && sub2.json.seats === 30 && mails[0].to === 'buyer@corp.example');
  const a = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  const b = await memStore('sentinel-licenses').get('sub_200', { type: 'json' });
  ok('two subscriptions → two different keys', a.key !== b.key);
  ok('missing email (deleted customer) → skipped incomplete', (await deliver({ id: 'e5', type: 'customer.subscription.created', created: 1, data: { object: subObj('sub_300', 'sentinel_pro_m', { customer: 'cus_gone' }) } })).json.skipped === 'incomplete');
}

console.log('[webhook] store loss → 503 before any email (B1 / Rule 14)');
{
  mails.length = 0;
  blobsDown = true;
  const r = await deliver(session({ id: 'cs_down', subscription: 'sub_down' }));
  ok('Blobs unreachable → 503 {ok:false, reason:store-unavailable, stage:mint}, no email', r.status === 503 && r.json.reason === 'store-unavailable' && r.json.stage === 'mint' && mails.length === 0);
  blobsDown = false;
  writesFail = 'sentinel-licenses';
  const w = await deliver(session({ id: 'cs_wf', subscription: 'sub_wf' }));
  ok('a failed record write → 503 stage:mint-write, no email (the customer is never told a key exists that was not stored)', w.status === 503 && w.json.stage === 'mint-write' && mails.length === 0);
  writesFail = 'sentinel-mint-claims';
  const c = await deliver(session({ id: 'cs_wf2', subscription: 'sub_wf2' }));
  ok('the mint claim cannot be written → 503 stage:mint-claim, nothing minted, no email', c.status === 503 && c.json.stage === 'mint-claim' && mails.length === 0 && !(await memStore('sentinel-licenses').get('sub_wf2', { type: 'json' })));
  writesFail = null;
  ok('no stack text in a 503 body', !/at |var\/task/.test(r.raw + w.raw + c.raw));
  ok('after the store recovers, Stripe\'s retry mints (the released claim is retaken)', (await deliver(session({ id: 'cs_wf', subscription: 'sub_wf' }))).json.minted === true);
}

console.log('[review P0-1] a $1 one-time checkout naming an Enterprise tier mints NOTHING');
{
  mails.length = 0;
  let captured = null;
  checkout._setStripeFactory(() => ({ checkout: { sessions: { create: async (p) => { captured = p; return { url: 'https://checkout.stripe.test/x', id: 'cs_test_attack1' }; } } } }));
  const attack = await checkout.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ tier: 'sentinel_enterprise_y', priceData: { amount_cents: 100, currency: 'usd', product_name: 'anything', id: 'iis-concierge-1' } }) });
  ok('stripe-checkout: the one-time session is mode payment at $1 and its metadata.tier is the ITEM id, not the client tier', attack.statusCode === 200 && captured.mode === 'payment' && captured.line_items[0].price_data.unit_amount === 100 && captured.metadata.tier === 'iis-concierge-1' && !JSON.stringify(captured.metadata).includes('sentinel_enterprise_y'));
  await checkout.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ priceData: { amount_cents: 100, currency: 'usd', product_name: 'x', id: 'sentinel_enterprise_y' } }) });
  ok('…and an item id that names a subscription tier is recorded as plain "one-time"', captured.metadata.tier === 'one-time' && !captured.metadata.product);
  const evt = { id: 'evt_x', type: 'checkout.session.completed', created: 1760450000, data: { object: { id: 'cs_test_attack1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 100, subscription: null, customer: null, metadata: { ...captured.metadata, tier: 'sentinel_enterprise_y' }, customer_details: { email: 'attacker@example.com', name: 'Mallory' } } } };
  const r = await deliver(evt);
  ok('webhook: a payment-mode session → {skipped:"not-a-subscription"} even with metadata.tier sentinel_enterprise_y', r.status === 200 && r.json.skipped === 'not-a-subscription' && r.json.mode === 'payment');
  ok('…no email to the attacker, nothing stored under the session id (the old `subscription_id = session.id` fallback is gone)', mails.length === 0 && !(await memStore('sentinel-licenses').get('cs_test_attack1', { type: 'json' })));
  const unpaid = await deliver(session({ id: 'cs_unpaid', subscription: 'sub_unpaid', payment_status: 'unpaid' }));
  ok('a subscription session that is not paid → skipped payment-not-complete', unpaid.json.skipped === 'payment-not-complete' && mails.length === 0);
  const noSub = await deliver(session({ id: 'cs_nosub', subscription: null }));
  ok('a subscription-mode session without a subscription id → skipped incomplete (never keyed by the session id)', noSub.json.skipped === 'incomplete' && !(await memStore('sentinel-licenses').get('cs_nosub', { type: 'json' })));
  // the plan is the PRICE's, not the metadata's
  const pro = await deliver(session({ id: 'cs_meta_lies', subscription: 'sub_meta_lies', _lookup: 'sentinel_pro_m', metadata: { tier: 'sentinel_enterprise_y', kind: 'aria-plan' } }));
  const proRec = await memStore('sentinel-licenses').get('sub_meta_lies', { type: 'json' });
  ok('a real subscription whose price lookup_key is sentinel_pro_m → a PRO key (plan code 02) even though metadata says enterprise', pro.json.minted === true && pro.json.tier === 'pro' && proRec.key.startsWith('02') && V2.verifyCustomerKey(proRec.key, process.env.SENTINEL_LICENSE_SECRET).plan === 'pro' && (await resolvePost(proRec.key)).json.plan === 'pro');
  subscriptions.sub_incomplete = subObj('sub_incomplete', 'sentinel_pro_m', { status: 'incomplete' });
  ok('a subscription still `incomplete` → skipped subscription-not-active (no key before the money)', (await deliver(session({ id: 'cs_inc', subscription: 'sub_incomplete' }))).json.skipped === 'subscription-not-active');
  mails.length = 0;
  const later = await deliver({ id: 'e_inc', type: 'customer.subscription.updated', created: nowSec(), data: { object: { ...subObj('sub_incomplete', 'sentinel_pro_m'), status: 'active' } } });
  ok('…its later customer.subscription.updated → active mints it then', later.json.minted === true && mails.length === 2);
  subscriptionsDown = true;
  mails.length = 0;
  const sd = await deliver(session({ id: 'cs_sd', subscription: 'sub_stripe_down' }));
  ok('Stripe cannot return the subscription → 503 stripe-unavailable (Stripe retries), no email', sd.status === 503 && JSON.parse(sd.raw).reason === 'stripe-unavailable' && mails.length === 0);
  subscriptionsDown = false;
  delete subscriptions.sub_stripe_down;
}

console.log('[review P0-1] stripe-confirm: a license only for a paid SUBSCRIPTION, for the tier its PRICE is');
{
  process.env.INTERNAL_WEBHOOK_SECRET = 'internal-secret-123456';
  process.env.URL = 'https://iisupp.net';
  const sessionsById = {
    cs_live_aaaaaaaaaaaaaaaa: { id: 'cs_live_aaaaaaaaaaaaaaaa', mode: 'payment', payment_status: 'paid', amount_total: 100, metadata: { tier: 'enterprise', kind: 'one-time' }, customer_details: { email: 'attacker@example.com' } },
    cs_live_bbbbbbbbbbbbbbbb: { id: 'cs_live_bbbbbbbbbbbbbbbb', mode: 'subscription', payment_status: 'paid', subscription: 'sub_web_pro', metadata: { tier: 'enterprise' }, customer_details: { email: 'web@example.com' } },
    cs_live_cccccccccccccccc: { id: 'cs_live_cccccccccccccccc', mode: 'subscription', payment_status: 'paid', subscription: 'sub_web_unknown', metadata: { tier: 'enterprise' }, customer_details: { email: 'web2@example.com' } }
  };
  const proPrice = checkout._plans.PRICE_MAP.pro;
  const subs = { sub_web_pro: { id: 'sub_web_pro', items: { data: [{ price: { id: proPrice } }] } }, sub_web_unknown: { id: 'sub_web_unknown', items: { data: [{ price: { id: 'price_not_ours' } }] } } };
  confirm._setStripeFactory(() => ({ checkout: { sessions: { retrieve: async (id) => sessionsById[id] } }, subscriptions: { retrieve: async (id) => subs[id] } }));
  const post = async (sid) => { const r = await confirm.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ session_id: sid }) }); return { status: r.statusCode, json: JSON.parse(r.body) }; };
  licenseCalls.length = 0;
  const attack = await post('cs_live_aaaaaaaaaaaaaaaa');
  ok('the $1 one-time session → 422 not-an-aria-subscription, license_issued:false, aria-license never called', attack.status === 422 && attack.json.error === 'not-an-aria-subscription' && attack.json.license_issued === false && licenseCalls.length === 0);
  const real = await post('cs_live_bbbbbbbbbbbbbbbb');
  ok('a paid subscription whose price is the server\'s PRO price → license issued for "pro" even though metadata says enterprise', real.status === 200 && real.json.license_issued === true && real.json.plan === 'pro' && licenseCalls.length === 1 && licenseCalls[0].plan === 'pro');
  const unknown = await post('cs_live_cccccccccccccccc');
  ok('a subscription price the server does not know → no license, the error says to issue it by hand', unknown.status === 200 && unknown.json.license_issued === false && /not in the server price table/.test(unknown.json.license_error) && licenseCalls.length === 1);
  ok('subscriptionTierForPriceId reads the server table backwards', checkout._plans.subscriptionTierForPriceId(proPrice) === 'pro' && checkout._plans.subscriptionTierForPriceId('price_nope') === null);
  delete process.env.INTERNAL_WEBHOOK_SECRET; delete process.env.URL;
  confirm._setStripeFactory(null);
}

console.log('[webhook] customer.subscription.deleted revokes (B4)');
{
  mails.length = 0;
  const rec = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  const r = await deliver({ id: 'e6', type: 'customer.subscription.deleted', created: 1760460000, data: { object: { id: 'sub_100', customer: 'cus_1' } } });
  ok('200 {revoked:true, enforced:true} with the honest effect copy', r.status === 200 && r.json.revoked === true && r.json.enforced === true && /24 hours/.test(r.json.effect) && /1 hour when the verdict is unsigned/.test(r.json.effect));
  const after = await memStore('sentinel-licenses').get('sub_100', { type: 'json' });
  ok('record status revoked with the Stripe reason', after.status === 'revoked' && after.revoked_reason === 'stripe:customer.subscription.deleted');
  const entry = await memStore('sentinel-licenses-revocations').get(keyHash(rec.key), { type: 'json' });
  ok('revocation entry written under sha256(key) — what sentinel-resolve and device auth read', entry && entry.revoked === true && entry.subscription_id === 'sub_100');
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('key index flipped to revoked', idx.status === 'revoked');
  ok('no email on cancellation', mails.length === 0);
  ok('deleting again → idempotent', (await deliver({ id: 'e7', type: 'customer.subscription.deleted', created: 1, data: { object: { id: 'sub_100' } } })).json.idempotent === true);
  ok('an unknown subscription → ignored no-record (200, Stripe is not retried)', (await deliver({ id: 'e8', type: 'customer.subscription.deleted', created: 1, data: { object: { id: 'sub_unknown' } } })).json.ignored === 'no-record');
  ok('a cancelled subscription later reported active is NOT restored (only past_due/unpaid recover)', (await deliver({ id: 'e8b', type: 'customer.subscription.updated', created: 1, data: { object: subObj('sub_100', 'sentinel_pro_m') } })).json.ignored === 'revoked');
}

console.log('[review P2-1] the AI Setup Walk-Through grants its 30-day trial (the p2-walkthrough-dead.mjs shape)');
{
  mails.length = 0;
  let captured = null;
  checkout._setStripeFactory(() => ({ checkout: { sessions: { create: async (p) => { captured = p; return { url: 'https://checkout.stripe.test/wt', id: 'cs_test_wt' }; } } } }));
  await checkout.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ priceData: { amount_cents: 700000, currency: 'usd', product_name: 'AI Setup Walk-Through Concierge · Starting Package', id: 'ai-setup-walkthrough' } }) });
  ok('stripe-checkout marks the catalogue-priced Walk-Through server-side: metadata.product = "ai-setup-walkthrough" at 700000', captured.mode === 'payment' && captured.line_items[0].price_data.unit_amount === 700000 && captured.metadata.product === 'ai-setup-walkthrough' && captured.metadata.price_source === 'catalogue');
  const created = nowSec();
  // exactly the reviewer's event shape (amount_total echoes their PoC; Stripe's real event also carries amount_subtotal)
  const evt = { id: 'evt_wt', type: 'checkout.session.completed', created, data: { object: { id: 'cs_test_wt_1', object: 'checkout.session', mode: captured.mode, payment_status: 'paid', amount_total: 100, subscription: null, customer: null, metadata: captured.metadata, customer_details: { email: 'Buyer@Example.com', name: 'Wendy Walk' } } } };
  const r = await deliver(evt);
  const trialEnd = new Date((created + 30 * 86400) * 1000).toISOString();
  ok('200 {walkthroughEntitled, tier:trial, trialEndsAt = expires_at = purchase + 30 days, entitlementStored, indexed, emailed}', r.status === 200 && r.json.walkthroughEntitled === true && r.json.tier === 'trial' && r.json.trialEndsAt === trialEnd && r.json.expires_at === trialEnd && r.json.entitlementStored === true && r.json.indexed === true && r.json.emailed.customer === true && r.json.emailed.admin === true);
  const rec = await memStore('sentinel-licenses').get('cs_test_wt_1', { type: 'json' });
  ok('the key is a per-customer TRIAL key (code 07) whose expiry inside the key is the record\'s expires_at', rec.key.startsWith('07') && V2.verifyCustomerKey(rec.key, process.env.SENTINEL_LICENSE_SECRET).expires_at === trialEnd && rec.tier === 'trial' && rec.walkthroughEntitled === true && rec.expires_at === trialEnd);
  const ent = await memStore('sentinel-walkthrough-entitlements').get('buyer@example.com', { type: 'json' });
  ok('the entitlement is keyed by the lowercased buyer email and holds a key HASH, never the key', ent && ent.walkthroughEntitled === true && ent.trialEndsAt === trialEnd && ent.key_hash === keyHash(rec.key) && !JSON.stringify(ent).includes(rec.key));
  const idx = await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' });
  ok('the key index carries tier trial, walkthroughEntitled and expires_at', idx.tier === 'trial' && idx.walkthroughEntitled === true && idx.expires_at === trialEnd);
  const mail = mails.find((m) => m.to === 'Buyer@Example.com');
  ok('the welcome mail carries the key and says exactly what it does (30-day, end date, free tier after, separate plan, nothing charged)', mail && mail.text.includes(rec.key) && /30-day ARIA Sentinel trial/.test(mail.subject) && mail.text.includes(trialEnd.slice(0, 10)) && /drop to the free tier/.test(mail.text) && /nothing is charged automatically/.test(mail.text) && /iisupp\.net\/plans/.test(mail.text));
  const adminMail = mails.find((m) => m.to === 'ahmad.wasee@iisupp.net');
  ok('the admin mail masks the key and lists the two promised actions', adminMail && !adminMail.text.includes(rec.key) && /Email the Windows pilot installer/.test(adminMail.text) && /confirm the Walk-Through scope/.test(adminMail.text));
  const live = await resolvePost(keyFromMail(mail));
  ok('sentinel-resolve: the emailed trial key → plan pro, active, walkthroughEntitled, trialEndsAt/expires_at = the trial end', live.status === 200 && live.json.plan === 'pro' && live.json.status === 'active' && live.json.walkthroughEntitled === true && live.json.trialEndsAt === trialEnd && live.json.expires_at === trialEnd && live.json.verdict.expires_at === trialEnd);
  mails.length = 0;
  ok('the same order again → idempotent, no second mail', (await deliver(evt)).json.idempotent === true && mails.length === 0);
  // a purchase made 31 days ago: the trial is over, the Walk-Through stays
  const old = await deliver({ ...evt, id: 'evt_wt_old', created: created - 31 * 86400, data: { object: { ...evt.data.object, id: 'cs_test_wt_old', customer_details: { email: 'old@example.com', name: 'Old Buyer' } } } });
  const oldRec = await memStore('sentinel-licenses').get('cs_test_wt_old', { type: 'json' });
  const expired = await resolvePost(oldRec.key);
  ok('a trial key past its expiry → plan free, status expired, walkthroughEntitled still true (sentinel-resolve honours expires_at)', old.json.walkthroughEntitled === true && expired.json.plan === 'free' && expired.json.status === 'expired' && expired.json.walkthroughEntitled === true);
  mails.length = 0;
  const cheap = await deliver({ ...evt, id: 'evt_wt_cheap', data: { object: { ...evt.data.object, id: 'cs_test_wt_cheap', amount_subtotal: 100 } } });
  ok('defence in depth: a Walk-Through-marked session whose pre-discount subtotal is below the catalogue price → skipped, no mail', cheap.json.skipped === 'amount-below-catalogue' && mails.length === 0);
  const clientOnly = await deliver({ ...evt, id: 'evt_wt_client', data: { object: { ...evt.data.object, id: 'cs_test_wt_client', metadata: { tier: 'ai-setup-walkthrough', kind: 'one-time' } } } });
  ok('only the SERVER-set marker counts: metadata.tier "ai-setup-walkthrough" alone (client-echoed) grants nothing', clientOnly.json.skipped === 'not-a-subscription' && mails.length === 0);
  const unpaidWt = await deliver({ ...evt, id: 'evt_wt_unpaid', data: { object: { ...evt.data.object, id: 'cs_test_wt_unpaid', payment_status: 'unpaid' } } });
  ok('an unpaid Walk-Through session → skipped payment-not-complete', unpaidWt.json.skipped === 'payment-not-complete' && mails.length === 0);
  checkout._setStripeFactory(null);
}

console.log('[review P2-5] subscription lifecycle: past_due / unpaid / canceled revoke, recovery restores, plan change re-keys');
{
  mails.length = 0;
  await deliver(session({ id: 'cs_life', subscription: 'sub_life', _lookup: 'sentinel_pro_m' }));
  const rec0 = await memStore('sentinel-licenses').get('sub_life', { type: 'json' });
  const oldKey = rec0.key;
  mails.length = 0;
  const pd = await deliver({ id: 'e_pd', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_life', 'sentinel_pro_m', { status: 'past_due' }) } });
  ok('status past_due → revoked with reason stripe:subscription.past_due, revocation entry written, no email', pd.json.revoked === true && pd.json.reason === 'stripe:subscription.past_due' && pd.json.enforced === true && mails.length === 0);
  ok('…sentinel-resolve now says revoked for that key', (await resolvePost(oldKey)).json.status === 'revoked');
  const back = await deliver({ id: 'e_back', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_life', 'sentinel_pro_m', { status: 'active' }) } });
  ok('back to active (the card was fixed) → restored: revocation cleared, the same key resolves active again', back.json.restored === true && !(await memStore('sentinel-licenses-revocations').get(keyHash(oldKey), { type: 'json' })) && (await resolvePost(oldKey)).json.status === 'active');
  for (const st of ['unpaid', 'canceled', 'incomplete_expired']) {
    const sid = 'sub_life_' + st;
    await deliver(session({ id: 'cs_' + sid, subscription: sid }));
    await deliver({ id: 'e_' + st, type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj(sid, 'sentinel_pro_m', { status: st }) } });
    const rr = await memStore('sentinel-licenses').get(sid, { type: 'json' });
    assert.ok(rr.status === 'revoked' && rr.revoked_reason === 'stripe:subscription.' + st, st + ' revokes with its reason');
    assert.ok((await resolvePost(rr.key)).json.status === 'revoked', st + ' → resolve says revoked');
    await deliver({ id: 'e_r_' + st, type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj(sid, 'sentinel_pro_m', { status: 'active' }) } });
    const after = await memStore('sentinel-licenses').get(sid, { type: 'json' });
    assert.equal(after.status, st === 'unpaid' ? 'active' : 'revoked', `${st}: a later "active" ${st === 'unpaid' ? 'restores' : 'does not restore'}`);
  }
  ok('unpaid / canceled / incomplete_expired each revoke with their reason; a later active restores only past_due/unpaid (canceled, incomplete_expired stay revoked)', true);
  // recovery AND a new price in the same update: restored, then re-keyed for the new plan
  await deliver(session({ id: 'cs_both', subscription: 'sub_both', _lookup: 'sentinel_pro_m' }));
  await deliver({ id: 'e_both_pd', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_both', 'sentinel_pro_m', { status: 'past_due' }) } });
  const both = await deliver({ id: 'e_both_up', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_both', 'sentinel_midsize_y', { status: 'active' }) } });
  const bothRec = await memStore('sentinel-licenses').get('sub_both', { type: 'json' });
  ok('a recovery that also changes the price → restored AND re-keyed for the new plan in the same event', both.json.planChanged === true && bothRec.status === 'active' && bothRec.tier === 'midsize' && bothRec.key.startsWith('04') && (await resolvePost(bothRec.key)).json.status === 'active');

  // plan change on a live subscription
  mails.length = 0;
  await deliver(session({ id: 'cs_pc', subscription: 'sub_pc', _lookup: 'sentinel_pro_m' }));
  const pc0 = await memStore('sentinel-licenses').get('sub_pc', { type: 'json' });
  mails.length = 0;
  const change = await deliver({ id: 'e_pc', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_pc', 'sentinel_business_y', { metadata: { seats: '25' } }) } });
  const pc1 = await memStore('sentinel-licenses').get('sub_pc', { type: 'json' });
  ok('a plan change pro → smb → {planChanged, from:pro, tier:smb, oldKeyRevoked}; the record holds a NEW smb key (generation 2)', change.json.planChanged === true && change.json.from === 'pro' && change.json.tier === 'smb' && change.json.oldKeyRevoked === true && pc1.tier === 'smb' && pc1.key !== pc0.key && pc1.key.startsWith('03') && pc1.key_generation === 2 && pc1.seats === 25 && !pc1.plan_change_pending);
  ok('the old key is revoked (entry + its index entry) and resolves revoked; the new key resolves smb active', (await memStore('sentinel-licenses-revocations').get(keyHash(pc0.key), { type: 'json' })).reason === 'stripe:plan-change' && (await memStore('sentinel-license-keys').get(keyHash(pc0.key), { type: 'json' })).status === 'revoked' && (await resolvePost(pc0.key)).json.status === 'revoked' && (await resolvePost(pc1.key)).json.plan === 'smb');
  const pcMail = mails.find((m) => m.to === 'buyer@corp.example');
  ok('the customer is emailed the NEW key, honestly (from Pro to Small Business; old key retired at the next license check)', pcMail && pcMail.text.includes(pc1.key) && !pcMail.text.includes(pc0.key) && /changed from Pro to/.test(pcMail.text) && /next license check/.test(pcMail.text) && mails.filter((m) => m.to === 'ahmad.wasee@iisupp.net').every((m) => !m.text.includes(pc1.key)));
  mails.length = 0;
  ok('the same plan-change event again → no new key, no second mail', (await deliver({ id: 'e_pc', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_pc', 'sentinel_business_y', { metadata: { seats: '25' } }) } })).json.unchanged === true && mails.length === 0 && (await memStore('sentinel-licenses').get('sub_pc', { type: 'json' })).key === pc1.key);
  // an interrupted plan change (the revocation store fails) is resumed by Stripe's retry
  writesFail = 'sentinel-licenses-revocations';
  const interrupted = await deliver({ id: 'e_pc2', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_pc', 'sentinel_enterprise_y') } });
  ok('the old key cannot be revoked → 503 (Stripe retries), the record keeps plan_change_pending', interrupted.status === 503 && (await memStore('sentinel-licenses').get('sub_pc', { type: 'json' })).plan_change_pending);
  writesFail = null;
  mails.length = 0;
  const resumed = await deliver({ id: 'e_pc2', type: 'customer.subscription.updated', created: nowSec(), data: { object: subObj('sub_pc', 'sentinel_enterprise_y') } });
  const pc2 = await memStore('sentinel-licenses').get('sub_pc', { type: 'json' });
  ok('the retry finishes it: enterprise key active, the smb key revoked, ONE mail with the enterprise key', resumed.json.planChanged === true && pc2.tier === 'enterprise' && !pc2.plan_change_pending && (await resolvePost(pc1.key)).json.status === 'revoked' && (await resolvePost(pc2.key)).json.plan === 'enterprise' && mails.filter((m) => m.to === 'buyer@corp.example').length === 1);
}

console.log('[review P2-5] invoice.payment_failed → past_due after 7 days; invoice.paid clears it');
{
  await deliver(session({ id: 'cs_pay', subscription: 'sub_pay', _lookup: 'sentinel_personal_m' }));
  const rec = await memStore('sentinel-licenses').get('sub_pay', { type: 'json' });
  const fresh = await deliver({ id: 'e_pf1', type: 'invoice.payment_failed', created: nowSec(), data: { object: { id: 'in_1', subscription: 'sub_pay' } } });
  ok('invoice.payment_failed → payment_failed_at recorded on the record + key index', fresh.json.marked === 'payment-failed' && (await memStore('sentinel-license-keys').get(keyHash(rec.key), { type: 'json' })).payment_failed_at);
  ok('…inside the 7-day grace the key still resolves active', (await resolvePost(rec.key)).json.status === 'active');
  ok('a second failure keeps the FIRST failure time (idempotent)', (await deliver({ id: 'e_pf2', type: 'invoice.payment_failed', created: nowSec() + 60, data: { object: { id: 'in_2', subscription: 'sub_pay' } } })).json.idempotent === true);
  // 8 days ago — via a fresh subscription so the first failure time is old
  await deliver(session({ id: 'cs_pay2', subscription: 'sub_pay2', _lookup: 'sentinel_personal_m' }));
  const rec2 = await memStore('sentinel-licenses').get('sub_pay2', { type: 'json' });
  await deliver({ id: 'e_pf3', type: 'invoice.payment_failed', created: nowSec() - 8 * 86400, data: { object: { id: 'in_3', parent: { subscription_details: { subscription: 'sub_pay2' } } } } });
  const late = await resolvePost(rec2.key);
  ok('a first failure 8 days old → resolve status "past_due" (plan still named); the newer invoice.parent shape is read too', late.json.status === 'past_due' && late.json.plan === 'personal' && late.json.verdict.status === 'past_due');
  const paid = await deliver({ id: 'e_paid', type: 'invoice.paid', created: nowSec(), data: { object: { id: 'in_4', subscription: 'sub_pay2' } } });
  ok('invoice.paid → cleared; the key resolves active again', paid.json.cleared === 'payment-failed' && (await resolvePost(rec2.key)).json.status === 'active');
  ok('invoice events for an unknown subscription → ignored (200)', (await deliver({ id: 'e_pf4', type: 'invoice.payment_failed', created: 1, data: { object: { id: 'in_5', subscription: 'sub_nobody' } } })).json.ignored === 'no-record');
}

console.log('[review P2-5] concurrent duplicate completion events → the key is emailed ONCE');
{
  // Production waits SENTINEL_CLAIM_SETTLE_MS (default 250 ms) between the claim write and its read-back; the two
  // deliveries below reach the claim a few awaits apart, exactly like two webhook invocations a moment apart.
  S._setClaimSettleMs(25);
  for (const mode of ['verify', 'conditional']) {
    conditionalWrites = mode === 'conditional';
    mails.length = 0;
    const id = 'sub_race_' + mode;
    subscriptions[id] = subObj(id, 'sentinel_pro_m');
    const [a, b] = await Promise.all([
      deliver(session({ id: 'cs_race_' + mode, subscription: id })),
      deliver({ id: 'e_race_' + mode, type: 'customer.subscription.created', created: 1760450000, data: { object: subObj(id, 'sentinel_pro_m') } })
    ]);
    const minted = [a, b].filter((x) => x.json && x.json.minted === true).length;
    const other = [a, b].find((x) => !(x.json && x.json.minted === true));
    assert.ok(minted === 1 && (other.status === 409 || (other.json && other.json.idempotent === true)), `${mode}: one mints, the other is 409 in-flight or idempotent — got ${JSON.stringify([a.status, a.json, b.status, b.json])}`);
    assert.equal(mails.filter((m) => m.to === 'buyer@corp.example').length, 1, `${mode}: exactly one customer email`);
    if (other.status === 409) {
      const retry = await deliver({ id: 'e_race_retry_' + mode, type: 'customer.subscription.created', created: 1760450000, data: { object: subObj(id, 'sentinel_pro_m') } });
      assert.ok(retry.json.idempotent === true, `${mode}: Stripe's retry of the 409 finds the record`);
    }
  }
  conditionalWrites = false;
  S._setClaimSettleMs(0);
  ok('checkout.session.completed + customer.subscription.created delivered together: one mint, one customer email (write-then-verify claim AND conditional-write claim); a 409 retry is idempotent', true);
}

S._setClaimSettleMs(null);
console.log(`sentinel-stripe-webhook: ${pass} checks green — own signing secret with fallback, sentinel_* only, v2 per-customer keys + key index, store-before-email with 503 on loss, cancellation revokes, idempotent; $1 one-time sessions mint nothing, the price decides the plan, stripe-confirm too; the Walk-Through mints its 30-day trial key; past_due/unpaid/canceled revoke, recovery restores, plan changes re-key once; payment_failed → past_due after 7 days; concurrent duplicates email once.`);
