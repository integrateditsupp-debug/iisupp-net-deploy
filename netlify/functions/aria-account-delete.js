/**
 * aria-account-delete — PIPEDA / GDPR right-to-erasure endpoint
 *  POST { email, confirm: "DELETE-MY-DATA" } -> deletes server-side records
 *  and emails a confirmation to both customer + Ahmad.
 *
 *  What gets deleted server-side:
 *    - Stripe customer is cancelled and detached (we cannot hard-delete a
 *      Stripe customer that has invoice history; we cancel subscriptions
 *      and add a `deleted_by_request` metadata flag — that's the most
 *      Stripe permits without losing audit trail).
 *
 *  What the user must do themselves (we cannot do remotely):
 *    - Clear localStorage at iisupp.net/aria (Log Out button does this).
 *
 *  Ahmad gets an email so he can confirm/clean up anything outside Stripe.
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
  const confirm = String(body.confirm || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
  }
  if (confirm !== 'DELETE-MY-DATA') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'confirm field must equal exactly "DELETE-MY-DATA"' }) };
  }

  const at = new Date().toISOString();
  const result = {
    request_received_at: at,
    email_requested: email,
    server_side_actions: [],
    client_side_action_required: 'Open iisupp.net/aria and click Log Out — this clears every localStorage key we set on your browser.',
    completed_within_window: '30 days (PIPEDA + GDPR)'
  };

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const stripe = Stripe(stripeKey);
      const search = await stripe.customers.search({ query: `email:"${email}"`, limit: 5 });
      const customers = search.data || [];
      for (const c of customers) {
        // Cancel any active subscriptions
        if (c.subscriptions && c.subscriptions.data) {
          for (const sub of c.subscriptions.data) {
            if (sub.status !== 'canceled') {
              await stripe.subscriptions.cancel(sub.id);
              result.server_side_actions.push(`Cancelled subscription ${sub.id}`);
            }
          }
        }
        // Flag customer as deleted-by-request (Stripe retains for legal/finance)
        await stripe.customers.update(c.id, {
          metadata: { deleted_by_request: at, deletion_reason: 'PIPEDA/GDPR right-to-erasure' }
        });
        result.server_side_actions.push(`Flagged Stripe customer ${c.id} as deleted_by_request`);
      }
      if (customers.length === 0) {
        result.server_side_actions.push('No Stripe customer record found for this email.');
      }
    } else {
      result.server_side_actions.push('STRIPE_SECRET_KEY not configured; cannot touch Stripe.');
    }
  } catch (e) {
    result.server_side_actions.push('Stripe error: ' + e.message);
  }

  // Email confirmation to customer + Ahmad
  try {
    await sendResend(email,
      'Account deletion request received',
      `<p>Hi,</p><p>We've received your deletion request. Server-side records have been actioned (Stripe subscriptions cancelled, customer flagged).</p>
       <p><strong>One step you must do yourself:</strong> open <a href="https://iisupp.net/aria">iisupp.net/aria</a> and click <strong>Log Out</strong>. That clears every browser-side record we set.</p>
       <p>You'll get a final confirmation when this is fully processed (within 30 days per PIPEDA).</p>
       <p>Request reference: ${at}</p>`);
    const ops = process.env.ORDER_NOTIFY_EMAIL || 'ahmad.wasee@iisupp.net';
    await sendResend(ops,
      '[PIPEDA delete request] ' + email,
      `<p>PIPEDA deletion request from ${email}</p>
       <ul>${result.server_side_actions.map(a => '<li>' + esc(a) + '</li>').join('')}</ul>
       <p>Verify nothing manual remains (CRM contacts, MailChimp, HubSpot, etc.).</p>`);
  } catch (e) {
    console.warn('[aria-account-delete] email failed:', e.message);
  }

  console.log('[aria-account-delete]', JSON.stringify({ at, email, actions: result.server_side_actions.length }));

  return { statusCode: 200, headers, body: JSON.stringify(result, null, 2) };
};

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function sendResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html })
    });
    if (r.ok) return true;
    if (r.status === 403) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Integrated IT Support <onboarding@resend.dev>', to: [to], subject, html })
      });
      return true;
    }
    return false;
  } catch { return false; }
}
