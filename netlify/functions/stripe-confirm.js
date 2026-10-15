/**
 * After Stripe Checkout success, this is called server-side:
 * 1. Retrieves session from Stripe
 * 2. Issues a license via aria-license
 * 3. Triggers welcome email via Resend
 *
 * 2026-10-08 (audit top-10 #2/#8):
 *  - aria-license `issue` is internal-only now; this function sends `x-internal-token` (INTERNAL_WEBHOOK_SECRET).
 *  - Idempotent: the first confirmation of a session is stored in Blobs (`confirmed-<session.id>`) and any
 *    replay returns the SAME license without minting another or re-sending the welcome mail.
 *  - Internal call goes to process.env.URL (not the request Host header).
 *  - Welcome mail goes through lib/notify.mjs; the response says whether it was actually delivered.
 *
 * SENTINEL REVIEW FIXES 2026-10-14 (P0-1, ARIA-web half): a license is issued ONLY for a paid SUBSCRIPTION
 * session, and the plan is the tier whose price the subscription actually charges — read from the subscription's
 * line item and mapped through stripe-checkout's own PRICE_MAP. The old code issued `session.metadata.tier`
 * (default 'pro') for any paid session: a $1 one-time checkout carrying tier "enterprise" came back with an
 * Enterprise ARIA-web license. A one-time session → 422 not-an-aria-subscription (nothing issued, nothing mailed);
 * a subscription whose price the server does not know → no license, the owner is paged to issue it by hand.
 */
const { BRAND, OWNER_EMAIL, SUPPORT_PHONE, SUPPORT_TEL } = require('./lib/contacts.cjs');

const STORE_NAME = 'stripe-confirm';
const PAID = new Set(['paid', 'no_payment_required']);

// Lazy Stripe client with a test seam (same pattern as sentinel-stripe-webhook / stripe-checkout).
let _stripeFactory = null;
/** Test seam: fn(secretKey) → a Stripe-like client ({ checkout: { sessions: { retrieve } }, subscriptions: { retrieve } }). */
exports._setStripeFactory = (fn) => { _stripeFactory = typeof fn === 'function' ? fn : null; };
function stripeClient(secretKey) {
  if (_stripeFactory) return _stripeFactory(secretKey);
  const Stripe = require('stripe');
  return Stripe(secretKey);
}

/** The tier the server's own price table assigns to the subscription's (first) price, or null. */
async function planFromSubscription(stripe, session) {
  const ref = session.subscription;
  let sub = ref && typeof ref === 'object' ? ref : null;
  if (!sub || !sub.items) {
    const id = typeof ref === 'string' ? ref : (ref && ref.id) || '';
    if (!id) return { tier: null, reason: 'no-subscription' };
    sub = await stripe.subscriptions.retrieve(id);
  }
  const item = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  const price = item && item.price;
  const { _plans } = require('./stripe-checkout.js');
  const tier = price ? _plans.subscriptionTierForPriceId(price.id) : null;
  return { tier, reason: tier ? null : 'price-not-in-server-table', priceId: price ? String(price.id || '') : '' };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return j(500, { error: 'Stripe not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const sessionId = String(body.session_id || '').trim();
  if (!sessionId) return j(400, { error: 'session_id required' });
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(sessionId)) return j(400, { error: 'session_id malformed' });

  const stripe = stripeClient(stripeKey);
  const store = await openStore(event);
  const confirmKey = 'confirmed-' + sessionId;

  // Idempotency: a replayed session_id returns the stored outcome — no second license, no second email.
  if (store) {
    try {
      const prior = await store.get(confirmKey, { type: 'json' });
      if (prior && prior.response) {
        console.log('[stripe-confirm] replay for session', sessionId.slice(-8), '— returning stored result');
        return j(200, { ...prior.response, replayed: true, first_confirmed_at: prior.at });
      }
    } catch (e) { console.warn('[stripe-confirm] idempotency read failed:', e.message); }
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer'] });
    // REVIEW FIX P0-1: only a SUBSCRIPTION session is an ARIA plan purchase. A one-time (payment-mode) session —
    // whatever its metadata says — never yields a license.
    if (session.mode !== 'subscription') {
      console.warn('[stripe-confirm] not a subscription session — no license', JSON.stringify({ session: sessionId.slice(-8), mode: String(session.mode || '') }));
      return j(422, { ok: false, error: 'not-an-aria-subscription', license_issued: false });
    }
    if (!PAID.has(session.payment_status)) {
      return j(402, { error: 'Payment not completed' });
    }

    const email = session.customer_details?.email || session.customer_email || (session.customer && session.customer.email);
    if (!email) return j(400, { error: 'No customer email on session' });

    // The plan is the tier whose price the subscription charges (server table) — never session.metadata.tier.
    const priced = await planFromSubscription(stripe, session);
    const tier = priced.tier;
    const planName = tier || 'ARIA';
    if (session.metadata && session.metadata.tier && tier && session.metadata.tier !== tier) {
      console.warn('[stripe-confirm] session metadata.tier ignored — the price decides', JSON.stringify({ metadata_tier: String(session.metadata.tier).slice(0, 40), price_tier: tier }));
    }

    // Issue license (internal call, authenticated with the internal token)
    const origin = process.env.URL || process.env.SITE_BASE_URL || (event.headers.host ? `https://${event.headers.host}` : 'https://iisupp.net');
    const internalToken = process.env.INTERNAL_WEBHOOK_SECRET || process.env.ARIA_ADMIN_TOKEN;
    let license = {};
    let licenseError = null;
    if (!tier) {
      licenseError = `subscription price ${priced.priceId || '(none)'} is not in the server price table (${priced.reason}) — license must be issued manually`;
      console.error('[stripe-confirm] ' + licenseError);
    } else if (!internalToken) {
      licenseError = 'INTERNAL_WEBHOOK_SECRET not configured — license must be issued manually';
      console.error('[stripe-confirm] ' + licenseError);
    } else {
      try {
        const licenseRes = await fetch(`${origin}/.netlify/functions/aria-license`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-token': internalToken },
          body: JSON.stringify({ action: 'issue', plan: tier, email, source: 'stripe-paid' }),
        });
        license = await licenseRes.json().catch(() => ({}));
        if (!licenseRes.ok || !license.token) {
          licenseError = 'license service returned ' + licenseRes.status + (license && license.error ? ': ' + license.error : '');
          console.error('[stripe-confirm] ' + licenseError);
        }
      } catch (e) {
        licenseError = 'license service unreachable';
        console.error('[stripe-confirm] license call failed:', e.message);
      }
    }

    // Welcome email (honest result)
    let welcome = { ok: false, error: 'skipped' };
    if (license.token) {
      welcome = await sendWelcomeEmail(email, license.token, planName).catch(e => ({ ok: false, error: e.message }));
      if (!welcome.ok) console.error('[stripe-confirm] welcome email not delivered:', welcome.error);
    }
    if (licenseError) {
      // Page the owner so a paid customer never waits on a silent failure.
      try {
        const { notify, sanitizeEmailHtml: esc } = await import('./lib/notify.mjs');
        await notify({
          recipients: [{ email: process.env.ORDER_NOTIFY_EMAIL || OWNER_EMAIL, role: 'owner' }],
          subject: '[ACTION] Paid checkout without license — ' + sessionId.slice(-10),
          html: `<p>A paid Stripe checkout completed but no license was issued.</p><ul><li>Session: <code>${esc(sessionId)}</code></li><li>Plan: ${esc(tier)}</li><li>Customer: ${esc(email)}</li><li>Reason: ${esc(licenseError)}</li></ul><p>Issue the license manually (aria-license action=issue with the admin token) and email the customer.</p>`,
          tag: 'stripe-confirm-license-failed',
        });
      } catch (e) { console.warn('[stripe-confirm] ops alert failed:', e.message); }
    }

    const response = {
      ok: true,
      license: license.token || null,
      email,
      plan: tier,
      license_issued: !!license.token,
      license_error: licenseError,
      welcome_email_sent: !!welcome.ok,
    };
    if (store) {
      try { await store.setJSON(confirmKey, { at: new Date().toISOString(), response }); }
      catch (e) { console.warn('[stripe-confirm] idempotency write failed:', e.message); }
    }
    return j(200, response);
  } catch (err) {
    console.error('[stripe-confirm] error:', err.message);
    return j(500, { error: `Could not confirm payment. Please call ${SUPPORT_PHONE} with your receipt.` });
  }
};

// SENTINEL-BACKEND 2026-10-14 (audit B1): Lambda-compat functions must hand the event's Blobs credentials to
// @netlify/blobs (connectLambda) before getStore, and strong consistency is unavailable in that mode (every
// read threw). lib/sentinel-store.cjs does both; null still means "idempotency disabled for this invocation".
async function openStore(event) {
  try {
    const { openStore: open } = require('./lib/sentinel-store.cjs');
    const store = await open(STORE_NAME, event);
    if (!store) console.warn('[stripe-confirm] Blobs unavailable — idempotency disabled for this invocation');
    return store;
  } catch (e) {
    console.warn('[stripe-confirm] Blobs unavailable — idempotency disabled for this invocation:', e.message);
    return null;
  }
}

async function sendWelcomeEmail(email, license, plan) {
  const { sendEmail, sanitizeEmailHtml: escape } = await import('./lib/notify.mjs');
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#000;color:#f5f5f0;padding:40px;">
    <div style="max-width:600px;margin:0 auto;border:1px solid #c5a059;border-radius:12px;padding:32px;background:#0a0a0a;">
      <h1 style="color:#c5a059;font-family:'Times New Roman',serif;font-size:36px;margin:0 0 16px;">Welcome to ARIA</h1>
      <p style="font-size:16px;line-height:1.6;">Thank you for subscribing to <strong>${escape(plan)}</strong>.</p>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Your License Token</h2>
      <div style="background:#1a1a1a;border:1px solid #c5a059;padding:18px;border-radius:8px;font-family:monospace;font-size:18px;color:#c5a059;text-align:center;letter-spacing:2px;">${escape(license)}</div>
      <p style="font-size:14px;color:#aaa;margin-top:8px;">Save this. You'll need it to activate ARIA on each device.</p>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Quick Start</h2>
      <ol style="font-size:15px;line-height:1.8;">
        <li>Visit <a href="https://iisupp.net/aria" style="color:#c5a059;">iisupp.net/aria</a> on any device</li>
        <li>Activate with the license above</li>
        <li>Tap the mic and start talking — ARIA's ready to help 24/7</li>
      </ol>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Need Help?</h2>
      <p style="font-size:15px;line-height:1.6;">📞 <a href="tel:${escape(SUPPORT_TEL)}" style="color:#c5a059;">${escape(SUPPORT_PHONE)}</a> — 24/7 support<br>
      ✉️ <a href="mailto:${escape(OWNER_EMAIL)}" style="color:#c5a059;">${escape(OWNER_EMAIL)}</a></p>
      <p style="font-size:12px;color:#888;margin-top:32px;border-top:1px solid #333;padding-top:16px;">
      ${escape(BRAND)} Inc. · iisupp.net · ${escape(SUPPORT_PHONE)}<br>
      ARIA — Senior IT Helpdesk in your pocket.</p>
    </div></body></html>`;

  return sendEmail({
    to: email,
    from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
    subject: `Welcome to ARIA — Your ${plan} License Inside`,
    html,
    tag: 'welcome-license',
  });
}

function j(s, b) { return { statusCode: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }; }
