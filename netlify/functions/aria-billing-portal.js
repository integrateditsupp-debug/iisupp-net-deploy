/**
 * aria-billing-portal — Generate Stripe Customer Portal session for self-serve billing
 *  POST { email, token? }
 *    -> looks up customer in Stripe, creates a billing-portal session,
 *       returns {url} to redirect user to.
 *
 *  Allows users to: update card, download invoices, cancel subscription, see plan.
 *  No need to email Ahmad for routine billing changes.
 *
 *  Cat 5 — Account management. Reduces support burden by ~30% per Stripe data.
 *
 *  AUTH (2026-10-08, audit #1): "knows the email" is no longer enough. The request must carry a
 *  magic-link `token` for that email (POST aria-magic-link {event:'request', email}) or an Aperture
 *  Bearer JWT — see lib/require-verified-email.cjs. ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1 restores
 *  the old behaviour as an emergency toggle. Response shapes are unchanged.
 */
const { requireVerifiedEmail, verifiedEmailResponse } = require('./lib/require-verified-email.cjs');
const { corsHeaders, allowedOrigins } = require('./lib/cors.cjs');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').toLowerCase().trim();
  if (!email || !/.+@.+\..+/.test(email)) {
    return ok({ ok: false, error: 'valid email required' });
  }

  const gate = requireVerifiedEmail(event, body, { email, scope: 'aria-billing-portal' });
  if (!gate.ok) return verifiedEmailResponse(gate, headers);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return ok({ ok: false, error: 'billing service unavailable', detail: 'STRIPE_SECRET_KEY not configured' });
  }

  try {
    // 1. Find customer by email
    const searchResp = await fetch('https://api.stripe.com/v1/customers/search?query=' +
      encodeURIComponent('email:"' + email + '"'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + stripeKey }
    });
    const searchJson = await searchResp.json();
    if (!searchResp.ok) {
      console.warn('[billing-portal] stripe search err:', searchJson && searchJson.error && searchJson.error.type);
      return ok({ ok: false, error: 'lookup failed' });
    }
    const customers = searchJson.data || [];
    if (customers.length === 0) {
      return ok({ ok: false, error: 'no_subscription', message: 'No active subscription found for that email. If you just signed up, allow a minute then try again.' });
    }
    const customerId = customers[0].id;

    // 2. Create billing portal session
    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('return_url', safeReturnUrl(body.return_url));

    const sessResp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const sess = await sessResp.json();
    if (!sessResp.ok) {
      console.warn('[billing-portal] stripe session err:', sess && sess.error && sess.error.message);
      return ok({ ok: false, error: 'session creation failed' });
    }

    return ok({ ok: true, url: sess.url, expires_at: sess.expires_at });
  } catch (e) {
    console.error('[billing-portal] err:', e.message);
    return ok({ ok: false, error: 'unexpected error', error_code: 'billing_portal_failed' });
  }

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

// Open-redirect fix (audit §4): the Stripe portal "return to site" link may only point at our own
// origins. A relative path is allowed; anything else falls back to /aria.
function safeReturnUrl(raw) {
  const fallback = 'https://iisupp.net/aria';
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (/^\/(?!\/)/.test(s)) return 'https://iisupp.net' + s;
  try {
    const u = new URL(s);
    if (allowedOrigins().has(u.origin)) return u.toString();
  } catch { /* fall through */ }
  console.warn('[billing-portal] rejected return_url (not an allowed origin)');
  return fallback;
}
