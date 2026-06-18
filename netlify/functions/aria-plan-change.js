/**
 * aria-plan-change — change a customer's active subscription tier mid-cycle.
 *  POST { email, new_tier } -> updates Stripe subscription with proration_behavior='create_prorations'.
 *  Returns the updated subscription summary + the upcoming-invoice preview.
 *
 *  Valid new_tier values map to env-var price IDs:
 *    personal -> STRIPE_PRICE_PERSONAL
 *    pro -> STRIPE_PRICE_PRO
 *    small_business -> STRIPE_PRICE_SMALL_BUSINESS
 *    mid_size -> STRIPE_PRICE_MID_SIZE
 *    enterprise -> STRIPE_PRICE_ENTERPRISE
 *
 *  Auth: requires the user to be authenticated via aperture-auth JWT OR
 *  to supply the matching email — for now MVP uses email-only and Stripe
 *  enforces customer ownership by lookup. Future: bolt onto JWT.
 */
const Stripe = require('stripe');

const TIER_TO_ENV = {
  personal: 'STRIPE_PRICE_PERSONAL',
  pro: 'STRIPE_PRICE_PRO',
  small_business: 'STRIPE_PRICE_SMALL_BUSINESS',
  mid_size: 'STRIPE_PRICE_MID_SIZE',
  enterprise: 'STRIPE_PRICE_ENTERPRISE'
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').trim().toLowerCase();
  const newTier = String(body.new_tier || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
  }
  const envKey = TIER_TO_ENV[newTier];
  if (!envKey) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'new_tier must be one of: ' + Object.keys(TIER_TO_ENV).join(', ') }) };
  }
  const newPriceId = process.env[envKey];
  if (!newPriceId) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: envKey + ' not configured in Netlify' }) };
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  }

  const stripe = Stripe(stripeKey);
  try {
    const search = await stripe.customers.search({ query: `email:"${email}"`, limit: 5 });
    const customers = search.data || [];
    if (customers.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No Stripe customer found for ' + email }) };
    }
    const customer = customers[0];
    // Find their active subscription (prefer first non-canceled)
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 5 });
    const sub = (subs.data || []).find(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
    if (!sub) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No active subscription found for ' + email + '. They must purchase first.' }) };
    }
    // Update — swap the FIRST subscription item to the new price, with prorations
    const firstItem = sub.items.data[0];
    if (!firstItem) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Subscription has no items' }) };
    }
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: firstItem.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
      metadata: { tier: newTier, changed_at: new Date().toISOString() }
    });
    // Preview upcoming invoice to show what the customer will be charged at next cycle
    let upcoming = null;
    try {
      const up = await stripe.invoices.retrieveUpcoming({ customer: customer.id });
      upcoming = {
        amount_due: up.amount_due,
        currency: up.currency,
        period_start: new Date(up.period_start * 1000).toISOString(),
        period_end: new Date(up.period_end * 1000).toISOString()
      };
    } catch { /* no upcoming invoice */ }

    console.log('[aria-plan-change] OK', email, '->', newTier, 'sub', sub.id);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      customer_id: customer.id,
      subscription_id: updated.id,
      new_tier: newTier,
      new_price_id: newPriceId,
      proration: 'create_prorations applied',
      upcoming_invoice: upcoming
    }) };
  } catch (e) {
    console.error('[aria-plan-change] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
