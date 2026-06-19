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
  // Subscription tiers (env var OR baked default from 2026-06-18 Stripe API run)
  personal:           process.env.STRIPE_PRICE_PERSONAL          || 'price_1TjsfaCa3MISR76yoni52e2z',
  personal_y:         process.env.STRIPE_PRICE_PERSONAL_Y        || 'price_1TjsfaCa3MISR76yt5JbtK5Y',
  pro:                process.env.STRIPE_PRICE_PRO               || 'price_1TjsfbCa3MISR76yeQyp2xLc',
  pro_y:              process.env.STRIPE_PRICE_PRO_Y             || 'price_1TjsfbCa3MISR76yy5gHjVQw',
  small_business:     process.env.STRIPE_PRICE_SMALL_BUSINESS    || 'price_1TjsfcCa3MISR76yCFX8flPA',
  small_business_y:   process.env.STRIPE_PRICE_SMALL_BUSINESS_Y  || 'price_1TjsfdCa3MISR76yXmzht0LP',
  mid_size:           process.env.STRIPE_PRICE_MID_SIZE          || 'price_1TjsfdCa3MISR76yZOvo5baD',
  mid_size_y:         process.env.STRIPE_PRICE_MID_SIZE_Y        || 'price_1TjsfeCa3MISR76yZ2KDy9QZ',
  midsize:            process.env.STRIPE_PRICE_MID_SIZE          || 'price_1TjsfdCa3MISR76yZOvo5baD',
  midsize_y:          process.env.STRIPE_PRICE_MID_SIZE_Y        || 'price_1TjsfeCa3MISR76yZ2KDy9QZ',
  enterprise:         process.env.STRIPE_PRICE_ENTERPRISE        || 'price_1TjsfeCa3MISR76yD8vT3wLE',
  enterprise_y:       process.env.STRIPE_PRICE_ENTERPRISE_Y      || 'price_1TjsffCa3MISR76yA4n2neBM',
  // Growth Library
  'gl-l1-it-bible':        process.env.STRIPE_PRICE_GL_L1_IT_BIBLE        || 'price_1TjsfgCa3MISR76y3zUlYq8c',
  'gl-m365-kb':            process.env.STRIPE_PRICE_GL_M365_KB            || 'price_1TjsfhCa3MISR76ydxWzsm0Z',
  'gl-ai-agent-starter':   process.env.STRIPE_PRICE_GL_AI_AGENT_STARTER   || 'price_1TjsfhCa3MISR76y5BOfv7Xa',
  'gl-prompt-workflows':   process.env.STRIPE_PRICE_GL_PROMPT_WORKFLOWS   || 'price_1TjsfiCa3MISR76ydcFUEjkr',
  'gl-win11-kb':           process.env.STRIPE_PRICE_GL_WIN11_KB           || 'price_1TjsfjCa3MISR76yzIsSFDA2',
  'gl-outlook-fix':        process.env.STRIPE_PRICE_GL_OUTLOOK_FIX        || 'price_1TjsfjCa3MISR76yQhoPEDQt',
  'gl-helpdesk-blueprint': process.env.STRIPE_PRICE_GL_HELPDESK_BLUEPRINT || 'price_1TjsfkCa3MISR76yQAlBkA8x',
  'gl-cyber-basics':       process.env.STRIPE_PRICE_GL_CYBER_BASICS       || 'price_1TjsfkCa3MISR76y2xKw8dmi',
  'gl-nocode-kit':         process.env.STRIPE_PRICE_GL_NOCODE_KIT         || 'price_1TjsflCa3MISR76yorWc7ite',
  'gl-meeting-sop-pack':   process.env.STRIPE_PRICE_GL_MEETING_SOP_PACK   || 'price_1TjsfmCa3MISR76yAzqyjT5E',
  'gl-website-checklist':  process.env.STRIPE_PRICE_GL_WEBSITE_CHECKLIST  || 'price_1TjsfmCa3MISR76yjfgDMwfT',
  'gl-ai-edge-starter':       process.env.STRIPE_PRICE_GL_AI_EDGE_STARTER        || 'price_1TjsfnCa3MISR76yA5zL4e3t',
  'gl-ai-edge-pro-playbook':  process.env.STRIPE_PRICE_GL_AI_EDGE_PRO_PLAYBOOK   || 'price_1TjsfnCa3MISR76yACezQmjE',
  'gl-ai-edge-family-studio': process.env.STRIPE_PRICE_GL_AI_EDGE_FAMILY_STUDIO  || 'price_1TjsfoCa3MISR76yUyAQnyai',
  'gl-ai-edge-adult-momentum':process.env.STRIPE_PRICE_GL_AI_EDGE_ADULT_MOMENTUM || 'price_1TjsfoCa3MISR76ymKbvvc5Z',
  'gl-book-living-well':      process.env.STRIPE_PRICE_GL_BOOK_LIVING_WELL       || 'price_1TjsfpCa3MISR76yTNTcSI8e',
  // Bundles
  'bundle-it-mastery':    process.env.STRIPE_PRICE_BUNDLE_IT_MASTERY    || 'price_1TjsfqCa3MISR76yIJPLflDn',
  'bundle-ai-automation': process.env.STRIPE_PRICE_BUNDLE_AI_AUTOMATION || 'price_1TjsfqCa3MISR76ys9XjhzyH',
  'bundle-allaccess':     process.env.STRIPE_PRICE_BUNDLE_ALLACCESS     || 'price_1TjsfrCa3MISR76yfLLCgDcQ',
  // In-stock devices
  'inv-notebook-ram-16gb': process.env.STRIPE_PRICE_INV_NOTEBOOK_RAM_16GB || 'price_1TjsfrCa3MISR76yEulPl7Gu',
  'inv-mac-mini-1':        process.env.STRIPE_PRICE_INV_MAC_MINI_1        || 'price_1TjsfsCa3MISR76ydHUsgaeh',
  'inv-mac-mini-2':        process.env.STRIPE_PRICE_INV_MAC_MINI_2        || 'price_1TjsfsCa3MISR76yaugNdHpc',
  'inv-ipad-a1458':        process.env.STRIPE_PRICE_INV_IPAD_A1458        || 'price_1TjsftCa3MISR76yJecNaJQ6',
  'inv-desktop-tower':     process.env.STRIPE_PRICE_INV_DESKTOP_TOWER     || 'price_1TjsftCa3MISR76yWbpxHQGN',
  'inv-dell-laptop':       process.env.STRIPE_PRICE_INV_DELL_LAPTOP       || 'price_1TjsfuCa3MISR76yRtjwqT9G',
  'inv-macbook-pro':       process.env.STRIPE_PRICE_INV_MACBOOK_PRO       || 'price_1TjsfvCa3MISR76ygTGXjPfo',
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
    // Subscription tiers vs one-time catalog items
    const SUBSCRIPTION_TIERS = new Set([
      'personal','personal_y','pro','pro_y',
      'small_business','small_business_y',
      'mid_size','mid_size_y','midsize','midsize_y',
      'enterprise','enterprise_y'
    ]);
    mode = SUBSCRIPTION_TIERS.has(tier) ? 'subscription' : 'payment';
    metadata = {
      tier: tier,
      planName: body.planName || tier,
      kind: SUBSCRIPTION_TIERS.has(tier) ? 'aria-plan' : 'iis-catalog'
    };
    // Catalog items return to homepage success path; subscription tiers return to /aria.
    if (mode === 'subscription') {
      successUrl = origin + '/aria?checkout=success&session_id={CHECKOUT_SESSION_ID}';
      cancelUrl  = origin + '/aria?checkout=canceled';
    } else {
      successUrl = origin + (body.successPath || '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
      cancelUrl  = origin + '/?checkout=canceled';
    }
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
    // Temporary debug: expose Stripe's error message so we can diagnose live vs test mismatch
    const debug = (err && err.message) ? err.message.slice(0, 200) : 'unknown';
    return j(500, { error: 'Could not start checkout. Call (647) 581-3182.', debug: debug, mode_hint: process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test') : 'missing' });
  }
};

function j(status, body) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
