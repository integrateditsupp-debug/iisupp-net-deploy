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
 *
 * 2026-10-08 (audit top-10 #8 — payment integrity), all additive:
 *  - ONE_TIME_CATALOGUE: the server owns the amount for every one-time id that exists in the repo
 *    (index.html / services.html / purchase-tech.html / shop.html / assets/iis-catalog.js). A client
 *    amount that disagrees is overridden and logged. Book orders are recomputed from the catalogue
 *    formula (item + delivery + $40 supply + 15% admin + add-ons). Ids the repo cannot price (concierge
 *    deposits, which depend on the shopper's budget) keep the client amount, clamped to the known
 *    [$1.00, $30,000] range (the largest one-time amount on the site) and logged as `unlisted-price`.
 *  - metadata.kind can no longer be set by the client (kind:'book-order' drives fulfilment mail): it is
 *    'book-order' only for a catalogue book id; other client meta keys are allow-listed and capped.
 *  - successPath must be a single-slash relative path (`//evil.tld` and `/\evil` are rejected) and the
 *    origin comes from our own allow-list / process.env.URL, never a raw Origin header → no open redirect.
 *
 * SENTINEL REVIEW FIXES 2026-10-14 (P0-1 / P2-1):
 *  - A one-time (priceData) session no longer copies the client's `body.tier` into metadata.tier. The review
 *    minted an Enterprise Sentinel key from a $1 session that carried `tier: "sentinel_enterprise_y"`. One-time
 *    metadata.tier is now the priced item id (what library-download reads), and an id that names a subscription
 *    tier is recorded as "one-time" instead. The license paths (sentinel-stripe-webhook, stripe-confirm) also no
 *    longer read the plan from metadata at all — they read the subscription's price.
 *  - The AI Setup Walk-Through (`ai-setup-walkthrough`, priced here from ONE_TIME_CATALOGUE) is marked
 *    server-side with metadata.product = "ai-setup-walkthrough": the key the Sentinel webhook recognises to grant
 *    the 30-day trial the homepage promises. A client cannot set `product` (META_ALLOW does not list it).
 */
const { allowedOrigins } = require('./lib/cors.cjs');

// The Stripe client is loaded lazily (and is injectable in tests) — same seam as sentinel-stripe-webhook.
let _stripeFactory = null;
/** Test seam: fn(secretKey) → a Stripe-like client ({ checkout: { sessions: { create } } }). */
function _setStripeFactory(fn) { _stripeFactory = typeof fn === 'function' ? fn : null; }
function stripeClient(secretKey) {
  if (_stripeFactory) return _stripeFactory(secretKey);
  const Stripe = require('stripe');
  return Stripe(secretKey);
}

/** The Concierge AI Setup Walk-Through product id (index.html / services.html data-stripe-id). */
const WALKTHROUGH_PRODUCT_ID = 'ai-setup-walkthrough';

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
  // DIY "AI Automation Setup" book — self-serve alternative to the Concierge Walk-Through. Env-only (no
  // baked default): undefined until Ahmad confirms the price (spec: 35% off the Walk-Through) and creates
  // the Stripe price, so checkout cleanly 400s and never charges a wrong amount before launch. Accepts the
  // staged-doc key STRIPE_PRICE_DIYBOOK too, so pasting the real ID into either name works with zero code change.
  'gl-ai-automation-setup-book': process.env.STRIPE_PRICE_GL_AI_AUTOMATION_BOOK || process.env.STRIPE_PRICE_DIYBOOK,
  diybook:                       process.env.STRIPE_PRICE_DIYBOOK || process.env.STRIPE_PRICE_GL_AI_AUTOMATION_BOOK,
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
  // RUN 23e — ARIA Sentinel tiers. STAGED — PENDING Ahmad Stripe create (do NOT invent IDs): env-only, no baked
  // default, so checkout cleanly 400s until the real price IDs are pasted. Prices are the source of truth in
  // pricing-tiers.mjs ($899/mo · $2,250/mo · $234K/yr · $468K/yr · $938K/yr). Each accepts BOTH the original
  // STRIPE_PRICE_SENTINEL_* name AND the short staged-doc name (STRIPE_PRICE_PERSONAL_M / _PRO_M / _SMB_Y /
  // _MID_Y / _ENT_Y) so pasting the ID into either variable works with ZERO code change (STRIPE-PRICE-LIST-TO-CREATE.md).
  sentinel_personal_m:   process.env.STRIPE_PRICE_SENTINEL_PERSONAL_M   || process.env.STRIPE_PRICE_PERSONAL_M,
  sentinel_personal_y:   process.env.STRIPE_PRICE_SENTINEL_PERSONAL_Y   || process.env.STRIPE_PRICE_PERSONAL_Y,
  sentinel_pro_m:        process.env.STRIPE_PRICE_SENTINEL_PRO_M        || process.env.STRIPE_PRICE_PRO_M,
  sentinel_business_y:   process.env.STRIPE_PRICE_SENTINEL_BUSINESS_Y   || process.env.STRIPE_PRICE_SMB_Y,
  sentinel_midsize_y:    process.env.STRIPE_PRICE_SENTINEL_MIDSIZE_Y    || process.env.STRIPE_PRICE_MID_Y,
  sentinel_enterprise_y: process.env.STRIPE_PRICE_SENTINEL_ENTERPRISE_Y || process.env.STRIPE_PRICE_ENT_Y,
  // One-time AI-setup products (STRIPE-PRICE-LIST-TO-CREATE.md). STAGED — PENDING Ahmad Stripe create: env-only,
  // no baked default. Walk-Through ($7,000 base, quote-to-scope) also has a live inline-priceData path on the
  // homepage/services buttons; this preset key lets a tier-based checkout use one fixed Stripe price when created.
  // Cookbook is $45 standalone (FREE — a $0 line — when bundled with the Walk-Through; that bundling is applied
  // server-side/at fulfilment, never as a fake $0 price here).
  walkthrough:           process.env.STRIPE_PRICE_WALKTHROUGH,
  cookbook:              process.env.STRIPE_PRICE_COOKBOOK,
  // Q-WEBTIER — $70/mo "ARIA Web + AI Edge" website subscription (top-of-funnel). SEPARATE product line
  // from the Sentinel desktop license matrix (pricing-tiers.mjs). Env-only: undefined until Ahmad creates
  // the Stripe price + sets STRIPE_PRICE_ARIA_WEB_M, so checkout cleanly 400s ("never a broken checkout").
  aria_web_m:            process.env.STRIPE_PRICE_ARIA_WEB_M,
};

// Subscription tiers vs one-time catalog items
const SUBSCRIPTION_TIERS = new Set([
  'personal','personal_y','pro','pro_y',
  'small_business','small_business_y',
  'mid_size','mid_size_y','midsize','midsize_y',
  'enterprise','enterprise_y',
  // ARIA Sentinel desktop tiers ARE recurring (monthly/annual) — they must open a subscription session, not a
  // one-time payment. Omitting them here meant that the moment Ahmad pastes the recurring price IDs, checkout
  // would try mode:'payment' on a recurring price and Stripe would reject it (a broken go-live). The /plans +
  // /downloads buttons POST exactly these tier keys.
  'sentinel_personal_m','sentinel_personal_y','sentinel_pro_m',
  'sentinel_business_y','sentinel_midsize_y','sentinel_enterprise_y',
  'aria_web_m'   // Q-WEBTIER — $70/mo website subscription (separate from desktop tiers)
]);

/**
 * REVIEW FIX P0-1 — the SERVER's own price table, read backwards: Stripe price id → the subscription tier key
 * whose price it is (first match in PRICE_MAP order), or null. stripe-confirm uses this to name the plan of a
 * paid subscription from the price Stripe actually charged — never from session metadata.
 */
function subscriptionTierForPriceId(priceId) {
  const id = String(priceId || '');
  if (!id) return null;
  for (const [tier, price] of Object.entries(PRICE_MAP)) {
    if (price && price === id && SUBSCRIPTION_TIERS.has(tier)) return tier;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// ONE-TIME PRICE CATALOGUE (server-side source of truth for inline priceData checkouts).
// Every amount below is copied from the page/catalog that renders the matching button — nothing is invented.
//   index.html data-stripe-id buttons (USD), index.html/m.html data-buy-options (CAD), services.html +
//   purchase-tech.html SKU tables (USD), shop.html finder's fee (USD), assets/iis-catalog.js products
//   (peek previews = 30%), inventory and concierge books (book-order formula).
const ONE_TIME_CATALOGUE = {
  // index.html hero / AI-setup / maintenance buttons (USD)
  'tier1-first-month': 600000, 'ai-setup-walkthrough': 700000, 'website-ai-deposit': 600000,
  'ai-learning': 250000, 'ai-automation': 550000, 'ai-agent-setup-deposit': 500000,
  'ai-maint-smb': 300000, 'ai-maint-mid': 600000, 'ai-maint-ent': 1400000,
  // services.html AI block
  'ai-business-automation': 550000,
  // index.html / m.html data-buy-options (CAD; same cents as rendered "$X CAD")
  'tier1-deposit': 200000, 'tier2-deposit': 400000, 'tier2-first-month': 1400000,
  'tier3-deposit': 1000000, 'tier3-first-month': 3000000,
  'home-diagnostics': 150000, 'home-network': 200000, 'home-tune': 125000,
  'recovery-data': 250000, 'recovery-audit': 200000,
  'monthly-home-deposit': 75000, 'monthly-home-first': 150000,
  // services.html + purchase-tech.html in-stock SKUs (USD)
  'iis-notebook-ram-16gb': 6500, 'iis-mac-mini-a1347-u1': 26000, 'iis-mac-mini-a1347-u2': 26000,
  'iis-ipad-a1458': 7200, 'iis-desktop-tower': 45500, 'iis-dell-inspiron': 20800, 'iis-macbook-pro-as': 84500,
  // assets/iis-catalog.js inventory (USD)
  'inv-notebook-ram-16gb': 6500, 'inv-mac-mini-1': 26000, 'inv-mac-mini-2': 26000, 'inv-ipad-a1458': 7200,
  'inv-desktop-tower': 45500, 'inv-dell-inspiron': 20800, 'inv-macbook-pro': 84500,
};
// assets/iis-catalog.js products/bundles — full price (used for `<id>-peek` = 30% preview, min $1.00)
const CATALOGUE_FULL_PRICE = {
  'gl-l1-it-bible': 11700, 'gl-m365-kb': 38700, 'gl-ai-agent-starter': 40000, 'gl-prompt-workflows': 20000,
  'gl-win11-kb': 14700, 'gl-outlook-fix': 8700, 'gl-helpdesk-blueprint': 44700, 'gl-cyber-basics': 17700,
  'gl-nocode-kit': 14700, 'gl-meeting-sop-pack': 9700, 'gl-website-checklist': 2900, 'gl-ai-edge-starter': 4900,
  'gl-ai-edge-pro-playbook': 19900, 'gl-ai-edge-family-studio': 7900, 'gl-ai-edge-adult-momentum': 14900,
  'gl-book-living-well': 9700, 'gl-ai-automation-setup-book': 455000,
  // bundles = sum of their items (iis-catalog.js recomputes them that way); all-access is a fixed membership
  'bundle-it-mastery': 73800, 'bundle-ai-automation': 119400, 'bundle-allaccess': 200000,
  'inv-notebook-ram-16gb': 6500, 'inv-mac-mini-1': 26000, 'inv-mac-mini-2': 26000, 'inv-ipad-a1458': 7200,
  'inv-desktop-tower': 45500, 'inv-dell-inspiron': 20800, 'inv-macbook-pro': 84500,
};
// Concierge books (assets/iis-catalog.js BOOKS): vendor list price + estimated delivery.
const BOOKS = {
  'tsb-ai-genesis': { item: 3200, delivery: 599 }, 'tsb-future-nexus': { item: 3500, delivery: 599 },
  'tsb-quantum-supremacy': { item: 3000, delivery: 599 }, 'tsb-psych-body': { item: 1900, delivery: 599 },
  'tsb-fitness-outlive': { item: 3200, delivery: 599 }, 'tsb-finance-money': { item: 2000, delivery: 599 },
  'tsb-growth-atomic': { item: 2700, delivery: 599 }, 'tsb-happy-build': { item: 2800, delivery: 599 },
};
const BOOK_SUPPLY_FEE_CENTS = 4000;   // flat per-order supply/sourcing fee (iis-catalog.js)
const BOOK_ADMIN_RATE = 0.15;         // admin + processing fee (iis-catalog.js)
const BOOK_SERVICES = { consult: { label: '30-min consultation with IIS', cents: 7900 }, setup: { label: 'Setup & configuration', cents: 9900 } };
const FINDER_FEE_CENTS = 4000;        // shop.html finder's fee
const MIN_ONE_TIME_CENTS = 100;
const MAX_ONE_TIME_CENTS = 3000000;   // Tier 3 first month ($30,000) — the largest one-time amount on the site
const ALLOWED_CURRENCIES = new Set(['usd', 'cad']);
const META_ALLOW = ['book', 'author', 'item_cents', 'delivery_cents', 'supply_cents', 'admin_cents', 'services_cents', 'services', 'note', 'ref', 'request'];

function bookTotals(book, serviceLabels) {
  const procurement = book.item + book.delivery + BOOK_SUPPLY_FEE_CENTS;
  const admin = Math.round(procurement * BOOK_ADMIN_RATE);
  let services = 0;
  const labels = [];
  for (const [id, svc] of Object.entries(BOOK_SERVICES)) {
    if (serviceLabels.includes(svc.label) || serviceLabels.includes(id)) { services += svc.cents; labels.push(svc.label); }
  }
  return { item: book.item, delivery: book.delivery, supply: BOOK_SUPPLY_FEE_CENTS, admin, services, labels, total: procurement + admin + services };
}

/**
 * Decide the amount the card is charged. Returns { cents, source, kind, bookMeta? }.
 * source ∈ 'catalogue' | 'peek' | 'book-order' | 'finder' | 'unlisted-clamped'
 */
function resolveOneTimePrice(id, clientCents, meta) {
  const safeId = String(id || '');
  if (Object.prototype.hasOwnProperty.call(ONE_TIME_CATALOGUE, safeId)) {
    return { cents: ONE_TIME_CATALOGUE[safeId], source: 'catalogue', kind: 'one-time' };
  }
  const peek = safeId.match(/^(.+)-peek$/);
  if (peek && Object.prototype.hasOwnProperty.call(CATALOGUE_FULL_PRICE, peek[1])) {
    return { cents: Math.max(100, Math.round(CATALOGUE_FULL_PRICE[peek[1]] * 0.30)), source: 'peek', kind: 'one-time' };
  }
  if (Object.prototype.hasOwnProperty.call(CATALOGUE_FULL_PRICE, safeId)) {
    return { cents: CATALOGUE_FULL_PRICE[safeId], source: 'catalogue', kind: 'one-time' };
  }
  if (Object.prototype.hasOwnProperty.call(BOOKS, safeId)) {
    const wanted = String((meta && meta.services) || '').split(',').map((x) => x.trim()).filter(Boolean);
    const t = bookTotals(BOOKS[safeId], wanted);
    return { cents: t.total, source: 'book-order', kind: 'book-order', bookMeta: t };
  }
  if (/^finder-\d+$/.test(safeId)) return { cents: FINDER_FEE_CENTS, source: 'finder', kind: 'one-time' };
  // Not derivable from the repo (e.g. iis-concierge-<ts> deposits depend on the shopper's budget):
  // keep the client amount but clamp it to the known range and say so in the logs.
  const clamped = Math.min(MAX_ONE_TIME_CENTS, Math.max(MIN_ONE_TIME_CENTS, Math.round(Number(clientCents) || 0)));
  return { cents: clamped, source: 'unlisted-clamped', kind: 'one-time' };
}

// successPath: a single-slash relative path only. Rejects protocol-relative (`//evil.tld`), backslashes,
// whitespace/control characters and anything not starting with "/".
function safeSuccessPath(p) {
  if (typeof p !== 'string') return null;
  if (!/^\/(?!\/)/.test(p)) return null;
  if (/[\s\\]/.test(p) || /[\u0000-\u001f\u007f]/.test(p)) return null;
  if (p.length > 300) return null;
  return p;
}

// The site origin used in success/cancel URLs. The raw Origin header is only honoured when it is one of our
// own origins; otherwise the deploy's URL (process.env.URL) wins.
function siteOrigin(event) {
  const hdr = String((event.headers && (event.headers.origin || event.headers.Origin)) || '').replace(/\/$/, '');
  if (hdr && allowedOrigins().has(hdr)) return hdr;
  if (process.env.URL) return String(process.env.URL).replace(/\/$/, '');
  const host = event.headers && event.headers.host;
  return host ? 'https://' + host : 'https://iisupp.net';
}

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

  const stripe = stripeClient(stripeKey);
  const origin = siteOrigin(event);

  let lineItems, mode, metadata, successUrl, cancelUrl;

  // Branch 1: inline price_data for one-time tech-service purchases
  if (body.priceData && typeof body.priceData === 'object') {
    const pd = body.priceData;
    const clientCents = Math.round(Number(pd.amount_cents || pd.amountCents || 0));
    if (!clientCents || clientCents < 100) {
      return j(400, { error: 'priceData.amount_cents must be >= 100' });
    }
    const pdId = String(pd.id || '').slice(0, 80);
    const priced = resolveOneTimePrice(pdId, clientCents, body.meta);
    const cents = priced.cents;
    if (cents !== clientCents) {
      console.warn('[stripe-checkout] amount overridden by server catalogue', JSON.stringify({ id: pdId, client_cents: clientCents, charged_cents: cents, source: priced.source }));
    }
    if (priced.source === 'unlisted-clamped') {
      console.warn('[stripe-checkout] unlisted one-time price id — client amount kept (clamped)', JSON.stringify({ id: pdId, cents }));
    }
    const currency = String(pd.currency || 'cad').toLowerCase();
    if (!ALLOWED_CURRENCIES.has(currency)) return j(400, { error: 'currency must be usd or cad' });
    const productName = String(pd.product_name || pd.productName || body.planName || 'Service').slice(0, 200);
    const productDesc = pd.description ? String(pd.description).slice(0, 500) : undefined;
    const productData = productDesc ? { name: productName, description: productDesc } : { name: productName };
    lineItems = [{
      price_data: { currency: currency, product_data: productData, unit_amount: cents },
      quantity: 1,
    }];
    mode = 'payment';
    // REVIEW FIX P0-1: never the client's body.tier. metadata.tier is the priced item id (library-download reads
    // "<id>-<full|peek>"), and an id that names a subscription tier (e.g. "sentinel_enterprise_y", "pro") is
    // recorded as plain "one-time" — a one-time session must never look like a plan purchase downstream.
    const itemTier = pdId && !SUBSCRIPTION_TIERS.has(pdId.toLowerCase()) && !/^sentinel_/i.test(pdId) ? pdId : 'one-time';
    if (body.tier != null && String(body.tier) !== itemTier) console.warn('[stripe-checkout] ignored client tier on a one-time session', JSON.stringify({ client_tier: String(body.tier).slice(0, 40), recorded: itemTier }));
    metadata = {
      tier: itemTier.slice(0, 40),
      planName: productName,
      kind: priced.kind,          // server-decided — a client can no longer flip this to 'book-order'
      price_source: priced.source
    };
    // REVIEW FIX P2-1: the Walk-Through is recognised by the Sentinel webhook from this SERVER-set marker (only
    // when the server catalogue priced the session — the client cannot set `product`, see META_ALLOW).
    if (pdId === WALKTHROUGH_PRODUCT_ID && priced.source === 'catalogue') metadata.product = WALKTHROUGH_PRODUCT_ID;
    // Callers may attach extra metadata (e.g. concierge book-order fee breakdown). Keys are allow-listed,
    // values are strings capped at 480 chars, and for book orders the fee breakdown is the SERVER's numbers.
    if (body.meta && typeof body.meta === 'object') {
      META_ALLOW.forEach(function (k) {
        if (body.meta[k] != null && String(body.meta[k]) !== '') metadata[k] = String(body.meta[k]).slice(0, 480);
      });
    }
    if (priced.kind === 'book-order' && priced.bookMeta) {
      const bm = priced.bookMeta;
      metadata.item_cents = String(bm.item);
      metadata.delivery_cents = String(bm.delivery);
      metadata.supply_cents = String(bm.supply);
      metadata.admin_cents = String(bm.admin);
      metadata.services_cents = String(bm.services);
      metadata.services = bm.labels.join(', ');
    }
    // Optional: callers may pass a relative successPath (e.g. "/unlock.html") to
    // land digital buyers on a delivery page. Defaults to homepage (unchanged).
    const sp = safeSuccessPath(body.successPath);
    if (body.successPath != null && !sp) console.warn('[stripe-checkout] rejected successPath (must be a single-slash relative path)');
    successUrl = origin + (sp
      ? sp + (sp.indexOf('?') >= 0 ? '&' : '?') + 'checkout=success&session_id={CHECKOUT_SESSION_ID}'
      : '/checkout-success.html?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    cancelUrl  = origin + '/checkout-success.html?checkout=canceled';
  } else {
    // Branch 2: existing ARIA tier subscription
    const tier = String(body.tier || '').toLowerCase();
    const priceId = PRICE_MAP[tier];
    if (!priceId) {
      return j(400, { error: 'Unknown tier: ' + tier });
    }
    lineItems = [{ price: priceId, quantity: 1 }];
    // SUBSCRIPTION_TIERS (module scope, above): subscription tiers vs one-time catalog items.
    mode = SUBSCRIPTION_TIERS.has(tier) ? 'subscription' : 'payment';
    metadata = {
      tier: tier,
      planName: body.planName || tier,
      kind: SUBSCRIPTION_TIERS.has(tier) ? 'aria-plan' : 'iis-catalog'
    };
    // REVIEW FIX P2-1: the fixed-price Walk-Through (STRIPE_PRICE_WALKTHROUGH, staged) carries the same server-set marker.
    if (tier === 'walkthrough') metadata.product = WALKTHROUGH_PRODUCT_ID;
    // SENTINEL-BACKEND 2026-10-14 (audit B11): an ARIA Sentinel desktop tier returns to /downloads/ — the page
    // that renders the "your key is on its way to <email>; download below" success state — not to /aria, where
    // nothing happened and nothing explained where the key was. The Sentinel webhook (sentinel-stripe-webhook)
    // mints + emails the key on checkout.session.completed; metadata.tier is what it reads (sentinel_* only).
    if (mode === 'subscription' && tier.startsWith('sentinel_')) {
      successUrl = origin + '/downloads/?checkout=success&session_id={CHECKOUT_SESSION_ID}';
      cancelUrl  = origin + '/plans/?checkout=canceled';
    } else if (mode === 'subscription') {
      // Catalog items return to homepage success path; ARIA-web subscription tiers return to /aria.
      successUrl = origin + '/aria?checkout=success&session_id={CHECKOUT_SESSION_ID}';
      cancelUrl  = origin + '/aria?checkout=canceled';
    } else {
      const sp = safeSuccessPath(body.successPath);
      if (body.successPath != null && !sp) console.warn('[stripe-checkout] rejected successPath (must be a single-slash relative path)');
      successUrl = origin + (sp || '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
      cancelUrl  = origin + '/?checkout=canceled';
    }
  }

  try {
    const sessionParams = {
      mode: mode,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      // Explicit payment_method_types so new Stripe accounts don't fall through auto-detect
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: metadata,
    };
    // Concierge/physical orders collect a shipping address + phone so we can fulfil.
    if (body.collectShipping) {
      sessionParams.shipping_address_collection = { allowed_countries: ['US', 'CA'] };
      sessionParams.phone_number_collection = { enabled: true };
    }
    // SENTINEL-BACKEND 2026-10-14: a Sentinel subscription carries its tier on the SUBSCRIPTION too, so the
    // customer.subscription.* webhook events (which do not see the Checkout Session's metadata) can tell a
    // Sentinel plan from an ARIA-web plan without a price lookup.
    if (mode === 'subscription' && metadata && typeof metadata.tier === 'string' && metadata.tier.startsWith('sentinel_')) {
      sessionParams.subscription_data = { metadata: { tier: metadata.tier, kind: 'aria-plan', product: 'aria-sentinel' } };
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

// Exposed for tests (pure; no Stripe calls).
exports._pricing = { resolveOneTimePrice, safeSuccessPath, bookTotals, ONE_TIME_CATALOGUE, CATALOGUE_FULL_PRICE, BOOKS, MAX_ONE_TIME_CENTS, MIN_ONE_TIME_CENTS };
// REVIEW FIXES 2026-10-14: the server's own plan table (stripe-confirm names a paid subscription's plan from the price
// Stripe charged) + the Walk-Through marker the Sentinel webhook recognises + the Stripe test seam.
exports._plans = { PRICE_MAP, SUBSCRIPTION_TIERS, subscriptionTierForPriceId, WALKTHROUGH_PRODUCT_ID };
exports._setStripeFactory = _setStripeFactory;
