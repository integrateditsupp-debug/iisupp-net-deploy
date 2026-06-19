/**
 * stripe-checkout — creates a Stripe Checkout Session.
 *
 * Two body shapes accepted:
 *
 * 1) ARIA subscription tiers (existing):
 *    { tier: "personal" | "personal_y" | "pro" | "pro_y" | "small_business" | "mid_size" | "enterprise" }
 *    → Looks up the price ID in env vars and creates a subscription session.
 *
 * 2) Inline one-time priceData (tech-service purchases from homepage — replaces PayPal sandbox):
 *    { priceData: { amount_cents, currency, product_name, description?, id? } }
 *    → Creates a one-time payment session with inline price_data. No preset Stripe Product needed.
 */
const Stripe = require('stripe');

const PRICE_MAP = {
  personal:           process.env.STRIPE_PRICE_PERSONAL,
  personal_y:         process.env.STRIPE_PRICE_PERSONAL_Y,
  pro:                process.env.STRIPE_PRICE_PRO,
  pro_y:              process.env.STRIPE_PRICE_PRO_Y,
  small_business:     process.env.STRIPE_PRICE_SMALL_BUSINESS,
  small_business_y:   process.env.STRIPE_PRICE_SMALL_BUSINESS_Y || process.env.STRIPE_PRICE_SMALL_BUSINESS,
  mid_size:           process.env.STRIPE_PRICE_MID_SIZE,
  mid_size_y:         process.env.STRIPE_PRICE_MID_SIZE_Y || process.env.STRIPE_PRICE_MID_SIZE,
  midsize:            process.env.STRIPE_PRICE_MID_SIZE,
  midsize_y:          process.env.STRIPE_PRICE_MID_SIZE_Y || process.env.STRIPE_PRICE_MID_SIZE,
  enterprise:         process.env.STRIPE_PRICE_ENTERPRISE,
  enterprise_y:       process.env.STRIPE_PRICE_ENTERPRISE_Y || process.env.STRIPE_PRICE_ENTERPRISE,
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST required' };
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return j(500, { error: 'Stripe not configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const stripe = Stripe(stripeKey);
  const origin = event.headers.origin || event.headers.Origin || ('https://' + event.headers.host);

  let lineItems, mode, metadata, successUrl, cancelUrl;

  // Branch 1: inline price_data for one-time tech-service purchases
  if (body.priceData && typeof body.priceData === 'object') {
    const pd = body.priceData;
    const cents = Math.round(Number(pd.amount_cents || pd.amountCents || 0));
    if (!cents || cents < 100) {
      return j(400, { error: 'priceData.amount_cents must be >= 100' });
    }
    const currency = String(pd.currency || 'cad').toLowerCase();
    const productName = String(pd.product_name || pd.productName || body.planName || 'Service').slice(0, 200);
    const productDesc = pd.description ? String(pd.description).slice(0, 500) : undefined;
    const productData = productDesc ? { name: productName, description: productDesc } : { name: productName };
    lineItems = [{
      price_data: { currency: currency, product_data: productData, unit_amount: cents },
      quantity: 1,
    }];
    mode = 'payment';
    metadata = {
      tier: String(body.tier || pd.id || 'tech-service').slice(0, 40),
      planName: productName,
      kind: 'tech-service'
    };
    // Callers may attach extra metadata (e.g. concierge book-order fee breakdown).
    // Values must be strings; this can set kind:'book-order' which the webhook acts on.
    if (body.meta && typeof body.meta === 'object') {
      Object.keys(body.meta).forEach(function (k) {
        if (body.meta[k] != null && String(body.meta[k]) !== '') metadata[k] = String(body.meta[k]).slice(0, 480);
      });
    }
    // Optional: callers may pass a relative successPath (e.g. "/unlock.html") to
    // land digital buyers on a delivery page. Defaults to homepage (unchanged).
    successUrl = origin + (typeof body.successPath === 'string' && body.successPath.charAt(0) === '/'
      ? body.successPath + (body.successPath.indexOf('?') >= 0 ? '&' : '?') + 'checkout=success&session_id={CHECKOUT_SESSION_ID}'
      : '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    cancelUrl  = origin + '/?checkout=canceled';
  } else {
    // Branch 2: existing ARIA tier subscription
    const tier = String(body.tier || '').toLowerCase();
    const priceId = PRICE_MAP[tier];
    if (!priceId) {
      return j(400, { error: 'Unknown tier: ' + tier });
    }
    lineItems = [{ price: priceId, quantity: 1 }];
    mode = 'subscription';
    metadata = {
      tier: tier,
      planName: body.planName || tier,
      kind: 'aria-plan'
    };
    successUrl = origin + '/aria?checkout=success&session_id={CHECKOUT_SESSION_ID}';
    cancelUrl  = origin + '/aria?checkout=canceled';
  }

  try {
    const sessionParams = {
      mode: mode,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: metadata,
    };
    // Concierge/physical orders collect a shipping address + phone so we can fulfil.
    if (body.collectShipping) {
      sessionParams.shipping_address_collection = { allowed_countries: ['US', 'CA'] };
      sessionParams.phone_number_collection = { enabled: true };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    return j(200, { url: session.url, id: session.id });
  } catch (err) {
    console.error('[stripe-checkout] error:', err.message);
    return j(500, { error: 'Could not start checkout. Call (647) 581-3182.' });
  }
};

function j(status, body) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
