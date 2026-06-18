#!/usr/bin/env node
/**
 * stripe-coupon-mirror.mjs — Sync ARIA_COUPONS_JSON to actual Stripe Coupons + Promotion Codes
 *  Run after changing ARIA_COUPONS_JSON env var.
 *  Idempotent: only creates coupons + promotion codes that don't already exist.
 *  Usage: STRIPE_SECRET_KEY=sk_... ARIA_COUPONS_JSON='[...]' node scripts/stripe-coupon-mirror.mjs
 */
const key = process.env.STRIPE_SECRET_KEY;
const couponsJson = process.env.ARIA_COUPONS_JSON || '[]';
if (!key) { console.error('STRIPE_SECRET_KEY required'); process.exit(1); }

let coupons;
try { coupons = JSON.parse(couponsJson); }
catch (e) { console.error('Invalid ARIA_COUPONS_JSON:', e.message); process.exit(1); }

async function sFetch(path, init) {
  const r = await fetch('https://api.stripe.com/v1/' + path, Object.assign({
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' }
  }, init || {}));
  return { ok: r.ok, status: r.status, json: await r.json() };
}

console.log('Syncing', coupons.length, 'coupons...');

for (const c of coupons) {
  const couponId = c.stripe_id || c.code.toLowerCase();
  // Check if already exists
  const check = await sFetch('coupons/' + couponId);
  if (check.ok) {
    console.log('  ✓ already exists:', couponId);
    continue;
  }
  // Create coupon (percent_off)
  const params = new URLSearchParams();
  params.append('id', couponId);
  params.append('percent_off', String(c.pct));
  params.append('duration', c.duration || 'once');
  if (c.label) params.append('name', c.label);
  if (c.max_uses) params.append('max_redemptions', String(c.max_uses));
  if (c.expires) {
    const expSec = Math.floor(new Date(c.expires).getTime() / 1000);
    params.append('redeem_by', String(expSec));
  }
  const create = await sFetch('coupons', { method: 'POST', body: params.toString() });
  if (!create.ok) {
    console.warn('  ✗ failed to create', couponId, ':', create.json.error?.message);
    continue;
  }
  console.log('  + created coupon:', couponId);

  // Also create a promotion code (the user-facing string)
  const pcParams = new URLSearchParams();
  pcParams.append('coupon', couponId);
  pcParams.append('code', c.code);
  pcParams.append('active', 'true');
  if (c.max_uses) pcParams.append('max_redemptions', String(c.max_uses));
  const pc = await sFetch('promotion_codes', { method: 'POST', body: pcParams.toString() });
  if (pc.ok) console.log('  + promo code:', c.code);
  else console.warn('  ✗ promo code', c.code, ':', pc.json.error?.message);
}

console.log('Done.');
