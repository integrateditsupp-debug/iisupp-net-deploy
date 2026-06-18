/**
 * aria-coupon — Validate + redeem coupon codes
 *  POST { event:'validate', code, plan }     -> { ok, discount_pct, label, expires_at }
 *  POST { event:'redeem',  code, customer_id, plan } -> applies in Stripe (via coupon ID in checkout/sub)
 *  POST { event:'list_active' }              -> admin only
 *
 *  Codes stored in env JSON: ARIA_COUPONS_JSON = '[{"code":"FOUNDER10","pct":10,"label":"Founding 10%","expires":"2027-01-01","max_uses":50,"used":0,"plans":["personal","pro"]}]'
 *  For Stripe, we mirror codes to actual Stripe coupons via admin push (separate one-time op).
 *
 *  Cat 16 — Pricing + monetization.
 */
function loadCoupons() {
  try { return JSON.parse(process.env.ARIA_COUPONS_JSON || '[]'); }
  catch { return []; }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'validate').trim();
  const coupons = loadCoupons();

  if (ev === 'validate') {
    const code = String(body.code || '').toUpperCase().trim();
    const plan = String(body.plan || '').toLowerCase().trim();
    const c = coupons.find(x => x.code.toUpperCase() === code);
    if (!c) return ok({ ok: false, error: 'invalid_code' });
    if (c.expires && new Date(c.expires) < new Date()) return ok({ ok: false, error: 'expired' });
    if (c.max_uses && (c.used || 0) >= c.max_uses) return ok({ ok: false, error: 'exhausted' });
    if (c.plans && c.plans.length && plan && !c.plans.includes(plan)) return ok({ ok: false, error: 'not_valid_for_plan' });
    return ok({
      ok: true,
      code: c.code,
      discount_pct: c.pct,
      label: c.label || c.code,
      expires_at: c.expires,
      stripe_coupon_id: c.stripe_id || null
    });
  }

  if (ev === 'redeem') {
    // v0.1: validate-only; actual Stripe sub modification happens at checkout time
    // because Stripe handles the discount math on the line items
    const code = String(body.code || '').toUpperCase().trim();
    const plan = String(body.plan || '').toLowerCase().trim();
    const c = coupons.find(x => x.code.toUpperCase() === code);
    if (!c) return ok({ ok: false, error: 'invalid_code' });
    return ok({
      ok: true,
      message: 'Coupon validated. Apply Stripe coupon ID at checkout: ' + (c.stripe_id || c.code),
      stripe_coupon_id: c.stripe_id || c.code,
      discount_pct: c.pct
    });
  }

  if (ev === 'list_active') {
    // Admin gate
    const token = body.admin_token || '';
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    const active = coupons.filter(c => !c.expires || new Date(c.expires) >= new Date());
    return ok({ ok: true, count: active.length, coupons: active });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
