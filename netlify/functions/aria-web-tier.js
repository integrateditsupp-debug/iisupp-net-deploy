/**
 * aria-web-tier — env-aware config for the $70/mo "ARIA Web + AI Edge" website subscription (Q-WEBTIER).
 *
 * The front-end card (assets/aria-web-tier.js) calls this to decide whether to render a real "Subscribe"
 * button or fall back to "Start free trial" / "Contact" — so the page NEVER shows a broken checkout.
 * `configured` is true only once Ahmad creates the Stripe price and sets STRIPE_PRICE_ARIA_WEB_M.
 * The raw Stripe price id is NEVER returned to the client.
 */
const TIER = Object.freeze({
  tier: 'aria_web_m',
  name: 'ARIA Web + AI Edge',
  price: '$70/mo',
  amount: 70,
  currency: 'CAD',
  interval: 'month',
  features: [
    'ARIA web chat + 280-article IT knowledge base — unlimited',
    'Full AI Edge course access (adult & family studios)',
    'No on-device fixes (that is ARIA Sentinel desktop)',
  ],
  positioning: 'Ascension entry: web + courses at $70/mo, upgrade to ARIA Sentinel desktop later.',
});

function buildConfig(env) {
  return {
    ok: true,
    configured: Boolean(env && env.STRIPE_PRICE_ARIA_WEB_M),
    ...TIER,
  };
}

exports.TIER = TIER;
exports.buildConfig = buildConfig;

exports.handler = async () => ({
  statusCode: 200,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  body: JSON.stringify(buildConfig(process.env)),
});
