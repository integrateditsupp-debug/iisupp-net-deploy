/**
 * stripe-checkout — creates a Checkout Session for self-serve plans
 */
const Stripe = require('stripe');

// Self-serve tiers. Each value is a Stripe Price ID set in Netlify env.
// Add new keys when launching new tiers; missing env vars produce a 400 with a
// clear error so the front-end can route to the call CTA instead.
const PRICE_MAP = {
  personal:         process.env.STRIPE_PRICE_PERSONAL,
  personal_y:       process.env.STRIPE_PRICE_PERSONAL_Y,
  pro:              process.env.STRIPE_PRICE_PRO,
  pro_y:            process.env.STRIPE_PRICE_PRO_Y,
  small_business_y: process.env.STRIPE_PRICE_SMALL_BUSINESS_Y,
  midsize_y:        process.env.STRIPE_PRICE_MIDSIZE_Y,
  enterprise_y:     process.env.STRIPE_PRICE_ENTERPRISE_Y,
  lifetime:         process.env.STRIPE_PRICE_LIFETIME,
};

// Tiers that are one-time (mode: payment). All others default to subscription.
const ONE_TIME_TIERS = new Set(['lifetime']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST required' };
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const tier = String(body.tier || '').toLowerCase();
  if (!(tier in PRICE_MAP)) {
    return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: `Unknown tier: ${tier}` }) };
  }
  const priceId = PRICE_MAP[tier];
  if (!priceId) {
    // Tier exists in the map but its Price ID env var isn't set yet.
    // Front-end falls back to "Talk to sales" — same UX as a sales-led tier.
    return { statusCode: 503, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: `Tier '${tier}' is not configured for checkout. Call (647) 581-3182.`, salesled: true }) };
  }

  const stripe = Stripe(stripeKey);
  const origin = event.headers.origin || event.headers.Origin || `https://${event.headers.host}`;
  const isOneTime = ONE_TIME_TIERS.has(tier);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isOneTime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/aria?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/aria?checkout=canceled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { tier, planName: body.planName || tier },
    });
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: session.url, id: session.id }) };
  } catch (err) {
    console.error('[stripe-checkout] error:', err.message);
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Could not start checkout. Call (647) 581-3182.' }) };
  }
};
