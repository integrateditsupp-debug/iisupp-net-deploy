/**
 * aria-billing-portal — Generate Stripe Customer Portal session for self-serve billing
 *  POST { email }
 *    -> looks up customer in Stripe, creates a billing-portal session,
 *       returns {url} to redirect user to.
 *
 *  Allows users to: update card, download invoices, cancel subscription, see plan.
 *  No need to email Ahmad for routine billing changes.
 *
 *  Cat 5 — Account management. Reduces support burden by ~30% per Stripe data.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://iisupp.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').toLowerCase().trim();
  if (!email || !/.+@.+\..+/.test(email)) {
    return ok({ ok: false, error: 'valid email required' });
  }

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
      console.warn('[billing-portal] stripe search err:', searchJson);
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
    params.append('return_url', body.return_url || 'https://iisupp.net/aria');

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
      console.warn('[billing-portal] stripe session err:', sess);
      return ok({ ok: false, error: sess.error?.message || 'session creation failed' });
    }

    return ok({ ok: true, url: sess.url, expires_at: sess.expires_at });
  } catch (e) {
    console.error('[billing-portal] err:', e.message);
    return ok({ ok: false, error: 'unexpected error', detail: e.message });
  }

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
