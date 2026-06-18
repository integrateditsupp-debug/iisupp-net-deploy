/**
 * aria-tenant-tier-detect — Infer the right ARIA tier for a tenant from their Stripe subscription
 *  POST { customer_email } -> { detected_tier, monthly_amount_usd, plan_name }
 *  Maps Stripe price_id to our 5 tiers (personal/pro/small_business/mid_size/enterprise).
 *  Used by /tenant-onboarding + admin views.
 *  Cat 5 — Account.
 */
const TIER_BY_AMOUNT_USD = [
  { min: 0, max: 700, tier: 'personal' },
  { min: 700, max: 1700, tier: 'pro' },
  { min: 1700, max: 14000, tier: 'small_business' },
  { min: 14000, max: 28000, tier: 'mid_size' },
  { min: 28000, max: Infinity, tier: 'enterprise' }
];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.customer_email || '').toLowerCase().trim();
  if (!email) return ok({ ok: false, error: 'customer_email required' });
  if (!process.env.STRIPE_SECRET_KEY) return ok({ ok: false, error: 'STRIPE_SECRET_KEY missing' });

  try {
    const sr = await fetch('https://api.stripe.com/v1/customers/search?query=' + encodeURIComponent('email:"' + email + '"'), {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    const sj = await sr.json();
    if (!sj.data || sj.data.length === 0) return ok({ ok: false, error: 'no customer found' });
    const customerId = sj.data[0].id;

    const subR = await fetch('https://api.stripe.com/v1/subscriptions?customer=' + customerId + '&status=active', {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    const subJ = await subR.json();
    if (!subJ.data || subJ.data.length === 0) return ok({ ok: false, error: 'no active subscription' });

    const sub = subJ.data[0];
    const item = sub.items?.data?.[0];
    if (!item) return ok({ ok: false, error: 'no subscription items' });
    const amount = item.price?.unit_amount || 0;
    const interval = item.price?.recurring?.interval || 'month';
    // Normalize to monthly USD
    let monthlyUsd = amount / 100;
    if (interval === 'year') monthlyUsd = monthlyUsd / 12;
    else if (interval === 'week') monthlyUsd = monthlyUsd * 4.33;

    const tier = TIER_BY_AMOUNT_USD.find(t => monthlyUsd >= t.min && monthlyUsd < t.max);
    return ok({
      ok: true,
      customer_id: customerId,
      detected_tier: tier?.tier || 'unknown',
      monthly_amount_usd: Math.round(monthlyUsd * 100) / 100,
      interval,
      plan_name: item.price?.nickname || 'unnamed'
    });
  } catch (e) { return ok({ ok: false, error: e.message }); }
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
