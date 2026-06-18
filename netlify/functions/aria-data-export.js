/**
 * aria-data-export — PIPEDA "right of access" endpoint
 *  POST { email } -> 200 JSON of everything ARIA has on the user
 *
 *  Compliance basis: PIPEDA Principle 9 (Individual Access). Must respond
 *  within 30 days. We respond instantly because all per-user data lives in:
 *    - Stripe (subscription + invoices)  -> queried via Stripe API
 *    - localStorage on user's browser    -> we cannot read remotely; user must
 *                                            run /aria-data-export.html locally
 *    - aria-receipt-email send log       -> not retained server-side currently
 *
 *  For now this endpoint returns: confirmation of receipt + the data we DO
 *  hold server-side (Stripe customer + invoice list) + instructions for
 *  the localStorage-side dump. Logs every request for audit.
 */
const Stripe = require('stripe');

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
  }

  const result = {
    request_received_at: new Date().toISOString(),
    email_requested: email,
    pipeda_principle: 'PIPEDA Principle 9 (Individual Access)',
    response_window_days: 30,
    server_side_data: { stripe: null, error: null },
    client_side_data: {
      where_to_find: 'localStorage on your browser at iisupp.net/aria',
      keys_we_store: [
        'aria_user_email', 'aria_user_profile',
        'aria_trial_consumed_<email>', 'aria_device_elapsed_ms',
        'aria_reminder_sent_5min_<email>', 'aria_reminder_sent_expired_<email>',
        'iis_cookie_consent', 'aria_session'
      ],
      how_to_export: 'Open iisupp.net/aria-data-export.html in your browser — it will dump every key/value we have on you locally and offer download as JSON.',
      how_to_clear: 'Click Log Out in ARIA, or open browser devtools console and run `Object.keys(localStorage).filter(k=>k.startsWith("aria_")).forEach(k=>localStorage.removeItem(k))`'
    },
    contact_for_more: 'ahmad.wasee@iisupp.net (Privacy Officer, IIS Inc.)'
  };

  // Try to pull Stripe customer record + recent invoices
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const stripe = Stripe(stripeKey);
      const search = await stripe.customers.search({ query: `email:"${email}"`, limit: 5 });
      const customers = search.data || [];
      if (customers.length === 0) {
        result.server_side_data.stripe = { customer_found: false, note: 'No Stripe record for this email.' };
      } else {
        const c = customers[0];
        const invs = await stripe.invoices.list({ customer: c.id, limit: 25 });
        result.server_side_data.stripe = {
          customer_found: true,
          customer_id: c.id,
          created_at: new Date(c.created * 1000).toISOString(),
          name: c.name,
          email: c.email,
          phone: c.phone,
          subscription_count: (c.subscriptions && c.subscriptions.data && c.subscriptions.data.length) || 0,
          invoice_count: (invs.data || []).length,
          invoices: (invs.data || []).map(i => ({
            id: i.id,
            created_at: new Date(i.created * 1000).toISOString(),
            status: i.status,
            amount_paid: i.amount_paid,
            currency: i.currency,
            hosted_invoice_url: i.hosted_invoice_url
          }))
        };
      }
    } else {
      result.server_side_data.error = 'STRIPE_SECRET_KEY not configured';
    }
  } catch (e) {
    result.server_side_data.error = 'Stripe lookup failed: ' + e.message;
  }

  // Audit log (server-side only — request itself, not the response body)
  console.log('[aria-data-export]', JSON.stringify({
    at: result.request_received_at,
    email: email,
    server_side_found: !!(result.server_side_data.stripe && result.server_side_data.stripe.customer_found)
  }));

  return { statusCode: 200, headers, body: JSON.stringify(result, null, 2) };
};
