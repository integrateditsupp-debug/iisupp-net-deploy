/**
 * aria-coupon-admin - admin-managed coupon staging.
 *
 * This function stores coupon definitions for ARIA validation only. It does
 * not mutate Stripe coupons, discounts, subscriptions, or checkout sessions.
 */
'use strict';

let blobStore = null;
let fallback = {};

async function getStore() {
  if (blobStore !== null) return blobStore;
  try {
    const { getStore } = require('@netlify/blobs');
    blobStore = getStore({ name: 'aria-coupon-admin', consistency: 'strong' });
  } catch {
    blobStore = false;
  }
  return blobStore;
}

function isAdmin(token) {
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return !!expected && token === expected;
}

function normalizeCoupon(input) {
  const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
  if (!code) return null;
  return {
    code,
    pct: Math.max(0, Math.min(100, Number(input.pct || input.discount_pct || 0))),
    label: String(input.label || code).slice(0, 80),
    plans: Array.isArray(input.plans) ? input.plans.map(String).slice(0, 10) : [],
    expires: input.expires ? String(input.expires).slice(0, 20) : null,
    max_uses: input.max_uses ? Math.max(1, Number(input.max_uses)) : null,
    stripe_coupon_id: input.stripe_coupon_id ? String(input.stripe_coupon_id).slice(0, 80) : null,
    active: input.active !== false,
    updated_at: new Date().toISOString()
  };
}

async function loadCoupons() {
  const store = await getStore();
  if (store) return (await store.get('coupons', { type: 'json' })) || {};
  return fallback;
}

async function saveCoupons(coupons) {
  const store = await getStore();
  if (store) await store.setJSON('coupons', coupons);
  fallback = coupons;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  if (!isAdmin(body.admin_token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
  }

  const eventName = String(body.event || 'list');
  const coupons = await loadCoupons();

  if (eventName === 'list') {
    return ok({ ok: true, count: Object.keys(coupons).length, coupons: Object.values(coupons), durable: !!(await getStore()) });
  }

  if (eventName === 'upsert') {
    const coupon = normalizeCoupon(body.coupon || body);
    if (!coupon) return bad('valid code required');
    coupons[coupon.code] = Object.assign({}, coupons[coupon.code] || {}, coupon);
    await saveCoupons(coupons);
    return ok({ ok: true, coupon: coupons[coupon.code], note: 'Stripe not mutated. Mirror manually after approval.' });
  }

  if (eventName === 'retire') {
    const code = String(body.code || '').trim().toUpperCase();
    if (!coupons[code]) return bad('coupon not found');
    coupons[code].active = false;
    coupons[code].retired_at = new Date().toISOString();
    await saveCoupons(coupons);
    return ok({ ok: true, coupon: coupons[code] });
  }

  return bad('unknown event');

  function ok(payload) { return { statusCode: 200, headers, body: JSON.stringify(payload) }; }
  function bad(message) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: message }) }; }
};
