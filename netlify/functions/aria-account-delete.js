/**
 * aria-account-delete — PIPEDA / GDPR right-to-erasure endpoint
 *  POST { email, confirm: "DELETE-MY-DATA", token? } -> deletes server-side records
 *  and emails a confirmation to both customer + Ahmad.
 *
 *  What gets deleted server-side:
 *    - Stripe customer is cancelled and detached (we cannot hard-delete a
 *      Stripe customer that has invoice history; we cancel subscriptions
 *      and add a `deleted_by_request` metadata flag — that's the most
 *      Stripe permits without losing audit trail).
 *    - (2026-10-08, audit #10) every Netlify Blobs store that holds the person's content —
 *      sessions/transcripts, session memory, cross-device memory, learning turns, traces, leads,
 *      bookings, calls, tickets, licenses — via lib/user-data.mjs. The response lists `stores_purged`
 *      and a tombstone stops aria-backup-cron from re-snapshotting the purged keys.
 *
 *  What the user must do themselves (we cannot do remotely):
 *    - Clear localStorage at iisupp.net/aria (Log Out button does this).
 *
 *  Ahmad gets an email so he can confirm/clean up anything outside Stripe.
 *
 *  AUTH (2026-10-08, audit #1): a deletion request must prove mailbox ownership — magic-link `token`
 *  for the email or an Aperture Bearer JWT (lib/require-verified-email.cjs); otherwise a stranger could
 *  cancel a paying customer's subscription. ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1 is the emergency toggle.
 */
const Stripe = require('stripe');
const { requireVerifiedEmail, verifiedEmailResponse } = require('./lib/require-verified-email.cjs');
const { corsHeaders } = require('./lib/cors.cjs');
const { OWNER_EMAIL, SUPPORT_PHONE } = require('./lib/contacts.cjs');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
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

  const gate = requireVerifiedEmail(event, body, { email, scope: 'aria-account-delete' });
  if (!gate.ok) return verifiedEmailResponse(gate, headers);

  const at = new Date().toISOString();
  const result = {
    request_received_at: at,
    email_requested: email,
    verified_via: gate.via,
    server_side_actions: [],
    stores_purged: {},
    keys_purged: 0,
    purge_errors: [],
    tombstone: null,
    client_side_action_required: 'Open iisupp.net/aria and click Log Out — this clears every localStorage key we set on your browser.',
    completed_within_window: '30 days (PIPEDA + GDPR)'
  };

  // 1. Stripe — cancel subscriptions, flag the customer (we cannot hard-delete a customer with invoices).
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const stripe = Stripe(stripeKey);
      const search = await stripe.customers.search({ query: `email:"${email}"`, limit: 5 });
      const customers = search.data || [];
      for (const c of customers) {
        // Cancel any active subscriptions (search() does not expand subscriptions — list them explicitly)
        let subs = [];
        try { subs = (await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20 })).data || []; }
        catch (e) { subs = (c.subscriptions && c.subscriptions.data) || []; }
        for (const sub of subs) {
          if (sub.status !== 'canceled') {
            await stripe.subscriptions.cancel(sub.id);
            result.server_side_actions.push(`Cancelled subscription ${sub.id}`);
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
    console.error('[aria-account-delete] stripe error:', e.message);
    result.server_side_actions.push('Stripe error — the finance team has been notified to complete this step manually.');
    result.purge_errors.push('stripe');
  }

  // 2. Netlify Blobs — every store that holds the person's content.
  try {
    const { purgeUserData } = await import('./lib/user-data.mjs');
    const purge = await purgeUserData(email, { phone: body.phone });
    result.stores_purged = purge.purged;
    result.keys_purged = purge.keys_purged.length;
    result.tombstone = purge.tombstone;
    for (const [store, n] of Object.entries(purge.purged)) {
      if (n > 0) result.server_side_actions.push(`Purged ${n} record(s) from ${store}`);
    }
    if (purge.errors.length) {
      result.purge_errors.push(...purge.errors.map((e) => String(e).split(':')[0]));
      console.warn('[aria-account-delete] purge errors:', purge.errors);
    }
  } catch (e) {
    console.error('[aria-account-delete] purge failed:', e.message);
    result.purge_errors.push('blobs');
    result.server_side_actions.push('Stored-content purge could not run — it has been queued for manual completion within the 30-day window.');
  }

  // 3. Email confirmation to customer + Ahmad — wording reflects what ACTUALLY happened (Rule 14).
  const purgedList = Object.entries(result.stores_purged).filter(([, n]) => n > 0).map(([s, n]) => `${s} (${n})`);
  const pending = result.purge_errors.length > 0;
  let emailDelivered = false;
  try {
    const { notify, sanitizeEmailHtml: esc } = await import('./lib/notify.mjs');
    const customerHtml = `<p>Hi,</p>
       <p>We've received your deletion request for <strong>${esc(email)}</strong>.</p>
       <p><strong>Done now:</strong></p>
       <ul>${result.server_side_actions.map(a => '<li>' + esc(a) + '</li>').join('')}</ul>
       ${purgedList.length ? `<p>Stored records removed: ${esc(purgedList.join(', '))}.</p>` : '<p>No stored chat or account records were found under this email.</p>'}
       ${pending ? '<p><strong>Still in progress:</strong> one or more systems could not be reached automatically. A person will finish those steps and you will get a final confirmation within 30 days (PIPEDA).</p>' : '<p>This completes the server-side erasure. Stripe keeps invoice history as required by tax and accounting law.</p>'}
       <p><strong>One step you must do yourself:</strong> open <a href="https://iisupp.net/aria">iisupp.net/aria</a> and click <strong>Log Out</strong>. That clears every browser-side record we set.</p>
       <p>Request reference: ${esc(at)}</p>
       <p style="font-size:12px;color:#777">Integrated IT Support Inc. · ${esc(SUPPORT_PHONE)}</p>`;
    const opsHtml = `<p>PIPEDA deletion request from ${esc(email)} (verified via ${esc(gate.via)})</p>
       <ul>${result.server_side_actions.map(a => '<li>' + esc(a) + '</li>').join('')}</ul>
       <p>Stores purged: ${esc(JSON.stringify(result.stores_purged))}</p>
       ${pending ? `<p><strong>ACTION NEEDED:</strong> automatic purge hit errors in: ${esc(result.purge_errors.join(', '))}. Finish manually within 30 days.</p>` : ''}
       <p>Verify nothing manual remains (CRM contacts, MailChimp, HubSpot, etc.).</p>`;
    const r = await notify({
      recipients: [
        { email, role: 'customer' },
      ],
      subject: 'Account deletion request received',
      html: customerHtml,
      tag: 'account-delete-customer',
    });
    emailDelivered = !!(r.results[0] && r.results[0].email && r.results[0].email.ok);
    await notify({
      recipients: [{ email: process.env.ORDER_NOTIFY_EMAIL || OWNER_EMAIL, role: 'owner' }],
      subject: '[PIPEDA delete request] ' + email,
      html: opsHtml,
      tag: 'account-delete-ops',
    });
  } catch (e) {
    console.warn('[aria-account-delete] email failed:', e.message);
  }
  result.confirmation_email_sent = emailDelivered;
  if (!emailDelivered) result.confirmation_email_note = 'The confirmation email could not be delivered; the erasure above still ran. Keep the request reference.';

  console.log('[aria-account-delete]', JSON.stringify({ at, email_hash: (await import('./lib/notify.mjs')).hashIdentity(email), actions: result.server_side_actions.length, keys_purged: result.keys_purged, via: gate.via }));

  return { statusCode: 200, headers, body: JSON.stringify(result, null, 2) };
};
