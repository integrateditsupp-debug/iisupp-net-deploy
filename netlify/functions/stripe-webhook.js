/**
 * stripe-webhook — receives Stripe events.
 *  - Logs subscription lifecycle events (existing behaviour).
 *  - On checkout.session.completed for a concierge book order
 *    (metadata.kind === 'book-order'), sends two emails via Resend:
 *      1) the customer: a branded confirmation;
 *      2) IIS ops: a fulfilment order with the customer's shipping address.
 *    Vendor/source disclosure must happen in the quote or order summary before
 *    payment when a third-party vendor materially fulfils the order.
 *    Email failures are logged but never fail the webhook.
 *
 *  2026-10-08 (audit top-10 #8):
 *    - events are de-duplicated by event.id (Blobs store `stripe-webhook-events`); Stripe retries and
 *      replays return 200 {received:true, duplicate:true} without re-sending mail.
 *    - customer.subscription.deleted now REVOKES the customer's ARIA license(s) (aria-licenses
 *      by-email/<email> → active:false) instead of only logging.
 *    - email goes through lib/notify.mjs (honest result; the webhook still never fails on mail errors).
 */
const Stripe = require('stripe');
const contacts = require('./lib/contacts.cjs');

const META = {
  brand: contacts.BRAND,
  email: contacts.OWNER_EMAIL,
  phone: contacts.SUPPORT_PHONE,
  tel: contacts.SUPPORT_TEL
};

const EVENTS_STORE = 'stripe-webhook-events';

exports.handler = async (event) => {
  const stripeKey   = process.env.STRIPE_SECRET_KEY;
  const webhookSec  = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSec) {
    return { statusCode: 500, body: 'Webhook not configured' };
  }
  const stripe = Stripe(stripeKey);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, webhookSec);
  } catch (err) {
    console.error('[stripe-webhook] Signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log('[stripe-webhook] Received:', evt.type, evt.id);

  // Dedupe: Stripe retries deliveries; the same event.id must not trigger a second email / revoke.
  const seen = await markEventSeen(evt.id, evt.type);
  if (seen === 'duplicate') {
    console.log('[stripe-webhook] duplicate event ignored:', evt.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
  }

  switch (evt.type) {
    case 'checkout.session.completed': {
      const s = evt.data.object;
      console.log('[stripe-webhook] checkout completed, customer:', s.customer, 'kind:', s.metadata && s.metadata.kind);
      if (s.metadata && s.metadata.kind === 'book-order') {
        try { await handleBookOrder(stripe, s); }
        catch (e) { console.error('[stripe-webhook] book-order email error:', e.message); }
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      console.log('[stripe-webhook] Event:', evt.type, 'customer:', evt.data.object.customer);
      break;
    case 'customer.subscription.deleted':
      console.log('[stripe-webhook] Event:', evt.type, 'customer:', evt.data.object.customer);
      try { await revokeLicensesForSubscription(stripe, evt.data.object); }
      catch (e) { console.error('[stripe-webhook] license revoke error:', e.message); }
      break;
    case 'invoice.payment_failed':
      try { await handlePaymentFailed(stripe, evt.data.object); }
      catch (e) { console.error('[stripe-webhook] payment_failed handler error:', e.message); }
      break;
    case 'invoice.payment_succeeded':
      try { await handlePaymentRecovered(stripe, evt.data.object); }
      catch (e) { console.error('[stripe-webhook] payment_succeeded recovery email error:', e.message); }
      break;
    default:
      console.log('[stripe-webhook] Unhandled:', evt.type);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

/* ---- concierge book order fulfilment emails ---------------------------- */
async function handleBookOrder(stripe, sessionObj) {
  // Re-fetch the session so we reliably get customer + shipping details.
  let s = sessionObj;
  try { s = await stripe.checkout.sessions.retrieve(sessionObj.id); }
  catch (e) { console.warn('[stripe-webhook] session retrieve failed, using event copy:', e.message); }

  const m = s.metadata || {};
  const cust = s.customer_details || {};
  const ship = s.shipping_details
    || (s.collected_information && s.collected_information.shipping_details)
    || s.shipping || {};
  const addr = (ship && ship.address) || cust.address || {};
  const shipName = (ship && ship.name) || cust.name || 'Customer';
  const email = cust.email;
  const phone = cust.phone || '';
  const fmt = (c) => '$' + (Number(c || 0) / 100).toFixed(2);
  const total = fmt(s.amount_total);
  const ref = s.id;
  const addrHtml = [
    addr.line1, addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '),
    addr.country
  ].filter(Boolean).join('<br>') || '(no address on file — follow up with customer)';

  // 1) Customer: branded thank-you with transparent sourcing language.
  if (email) {
    const html = shell(`
      <h1 style="margin:0 0 14px;font:600 22px/1.2 Georgia,serif;color:#0b1f3a">Thank you for choosing us</h1>
      <p>Hi ${esc(shipName.split(' ')[0] || 'there')},</p>
      <p>Your order is confirmed and we're already on it. We're sourcing <strong>${esc(m.book || 'your item')}</strong>${m.author ? ' by ' + esc(m.author) : ''} and will have it delivered to you.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <tr><td style="padding:6px 0;color:#555">Order reference</td><td style="padding:6px 0;text-align:right;color:#0b1f3a"><code>${esc(ref).slice(-12)}</code></td></tr>
        <tr><td style="padding:6px 0;color:#555">Total paid</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0b1f3a">${total}</td></tr>
      </table>
      <p>Delivery is estimated today and reconciled to the final shipping cost once your order ships — we'll make it right either way. You'll get tracking as soon as it's on the move.</p>
      <p style="font-size:12px;color:#777">If a third-party vendor fulfils any part of the order, the material vendor/source details and terms must be disclosed in the order summary or tracking handoff.</p>
      <p>Questions? Just reply to this email or call ${META.phone}.</p>
      <p style="margin-top:22px">Warmly,<br><strong>${META.brand}</strong></p>
    `);
    await sendResend(email, `Thank you for choosing ${META.brand} — order confirmed`, html);
  } else {
    console.warn('[stripe-webhook] book-order had no customer email; skipped customer mail');
  }

  // 2) IIS ops: fulfilment order with compliance reminder.
  const opsHtml = shell(`
    <h1 style="margin:0 0 6px;font:600 20px/1.2 Georgia,serif;color:#0b1f3a">New book order to fulfil</h1>
    <p style="margin:0 0 16px;color:#555">Place the order with the approved vendor and ship to the address below. Do not misrepresent IIS or the buyer. Use IIS contact details only where vendor terms allow, and forward material vendor updates to the customer.</p>
    <h3 style="margin:14px 0 4px;color:#0b1f3a">${esc(m.book || 'Item')}</h3>
    <p style="margin:0 0 14px;color:#555">${esc(m.author || '')}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:5px 0;color:#555">Item (vendor)</td><td style="padding:5px 0;text-align:right">${fmt(m.item_cents)}</td></tr>
      <tr><td style="padding:5px 0;color:#555">Delivery (est.)</td><td style="padding:5px 0;text-align:right">${fmt(m.delivery_cents)}</td></tr>
      <tr><td style="padding:5px 0;color:#555">Supply &amp; sourcing fee</td><td style="padding:5px 0;text-align:right">${fmt(m.supply_cents)}</td></tr>
      <tr><td style="padding:5px 0;color:#555">Admin / processing (15%)</td><td style="padding:5px 0;text-align:right">${fmt(m.admin_cents)}</td></tr>
      ${Number(m.services_cents) ? `<tr><td style="padding:5px 0;color:#555">Services: ${esc(m.services || '')}</td><td style="padding:5px 0;text-align:right">${fmt(m.services_cents)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;border-top:1px solid #ddd;font-weight:700;color:#0b1f3a">Charged</td><td style="padding:8px 0;border-top:1px solid #ddd;text-align:right;font-weight:700;color:#0b1f3a">${total}</td></tr>
    </table>
    <h3 style="margin:18px 0 4px;color:#0b1f3a">Ship to</h3>
    <p style="margin:0;line-height:1.6">${esc(shipName)}<br>${addrHtml}</p>
    <p style="margin:10px 0 0;color:#555">Customer email: ${esc(email || '—')}${phone ? ' · ' + esc(phone) : ''}</p>
    <p style="margin:6px 0 0;color:#555">Order ref: <code>${esc(ref)}</code></p>
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0">
    <p style="margin:0;color:#555;font-size:13px">IIS contact (use on customer-facing paperwork): ${META.brand} · ${META.email} · ${META.phone}</p>
  `);
  const notify = process.env.ORDER_NOTIFY_EMAIL || META.email;
  await sendResend(notify, `New book order · ${(m.book || 'Concierge').slice(0, 80)} · ${total}`, opsHtml);
}

function shell(inner) {
  return `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;line-height:1.6;font-size:15px">
    <div style="border-top:3px solid #c5a059;padding:22px 4px 0">${inner}
    <p style="margin:26px 0 0;font-size:11px;color:#999">Integrated IT Support Inc. · ${META.phone} · ${META.email}</p></div></div>`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Email via the shared honest helper (lib/notify.mjs). Returns true ONLY when the provider confirmed.
async function sendResend(to, subject, html) {
  try {
    const { sendEmail, hashIdentity } = await import('./lib/notify.mjs');
    const r = await sendEmail({ to, subject, html, from: process.env.RESEND_FROM || `${META.brand} <noreply@iisupp.net>`, tag: 'stripe-webhook' });
    if (r.ok) { console.log('[stripe-webhook] emailed', hashIdentity(to), 'via', r.provider, 'msg', r.id); return true; }
    console.warn('[stripe-webhook] email NOT delivered', hashIdentity(to), r.error, (r.attempts || []).join(' | ').slice(0, 300));
    return false;
  } catch (e) { console.warn('[stripe-webhook] email exception', e.message); return false; }
}

// ---- Idempotency ---------------------------------------------------------
// Returns 'new' | 'duplicate' | 'unknown' (Blobs unavailable → process the event; never drop it).
async function markEventSeen(eventId, type) {
  if (!eventId) return 'unknown';
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: EVENTS_STORE, consistency: 'strong' });
    const key = 'evt-' + eventId;
    const prior = await store.get(key, { type: 'json' });
    if (prior) return 'duplicate';
    await store.setJSON(key, { id: eventId, type, first_seen: Date.now() });
    return 'new';
  } catch (e) {
    console.warn('[stripe-webhook] dedupe store unavailable:', e.message);
    return 'unknown';
  }
}

// ---- License revocation on cancel ---------------------------------------
async function revokeLicensesForSubscription(stripe, sub) {
  let email = null;
  try {
    const customer = await stripe.customers.retrieve(sub.customer);
    email = customer && customer.email ? String(customer.email).trim().toLowerCase() : null;
  } catch (e) { console.warn('[stripe-webhook] cannot fetch customer for revoke:', e.message); }
  if (!email) { console.warn('[stripe-webhook] subscription.deleted without customer email; no license to revoke'); return; }
  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); } catch (e) { console.warn('[stripe-webhook] Blobs unavailable; license not revoked'); return; }
  const store = getStore({ name: 'aria-licenses', consistency: 'strong' });
  const seen = new Set();
  for (const beKey of ['by-email/' + email]) {
    const be = await store.get(beKey, { type: 'json' }).catch(() => null);
    const token = be && be.token;
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const rec = await store.get(token, { type: 'json' }).catch(() => null);
    if (!rec) continue;
    if (rec.active === false) { console.log('[stripe-webhook] license already inactive', token.slice(0, 9) + '…'); continue; }
    rec.active = false;
    rec.revokedAt = new Date().toISOString();
    rec.revokedReason = 'customer.subscription.deleted:' + sub.id;
    await store.setJSON(token, rec);
    console.log('[stripe-webhook] revoked license', token.slice(0, 9) + '… for subscription', sub.id);
  }
  if (!seen.size) console.log('[stripe-webhook] no license on file for cancelled subscription', sub.id);
}


/* ---- Failed-payment dunning ------------------------------------------ */
async function handlePaymentFailed(stripe, invoice) {
  const customerId = invoice.customer;
  const attemptCount = Number(invoice.attempt_count || 1);
  const amountDue = Number(invoice.amount_due || 0);
  const currency = (invoice.currency || 'usd').toUpperCase();
  const nextAttempt = invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null;
  let customer;
  try { customer = await stripe.customers.retrieve(customerId); }
  catch (e) { console.warn('[stripe-webhook] cant fetch customer for dunning:', e.message); return; }
  const email = customer && customer.email;
  if (!email) { console.warn('[stripe-webhook] no email on customer; skipping dunning'); return; }
  const name = (customer.name || email.split('@')[0] || 'there').split(' ')[0];
  const fmtAmt = '$' + (amountDue / 100).toFixed(2) + ' ' + currency;
  const updatePortal = invoice.hosted_invoice_url || ('mailto:' + META.email + '?subject=Update%20my%20payment%20method');

  let subject, body;
  if (attemptCount === 1) {
    subject = 'Heads-up: your ARIA payment did not go through';
    body = `<p>Hi ${esc(name)},</p>
      <p>The card on file for your ARIA subscription was declined on your most recent charge (${esc(fmtAmt)}).</p>
      <p>This happens — usually a temporary issue with the bank. Stripe will automatically retry on ${nextAttempt ? esc(nextAttempt.toDateString()) : 'a future date'}, but the fastest path is to update your card now:</p>
      <p><a href="${esc(updatePortal)}" style="background:#c5a059;color:#1a1410;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">Update payment method &rarr;</a></p>
      <p>Service stays on — no interruption.</p>`;
  } else if (attemptCount === 2) {
    subject = 'Second try failed — quick fix to keep ARIA running';
    body = `<p>Hi ${esc(name)},</p>
      <p>Your ARIA charge (${esc(fmtAmt)}) was declined a second time. Service is still active for now.</p>
      <p>Update your card so the next retry succeeds and we don't have to pause anything:</p>
      <p><a href="${esc(updatePortal)}" style="background:#c5a059;color:#1a1410;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">Update payment method &rarr;</a></p>
      <p>If you'd rather pay a different way (bank transfer, invoice), reply to this email and we'll arrange it.</p>`;
  } else if (attemptCount === 3) {
    subject = 'Urgent — ARIA payment failed three times';
    body = `<p>Hi ${esc(name)},</p>
      <p>Stripe has now tried the card on file three times and each charge of ${esc(fmtAmt)} was declined.</p>
      <p>To avoid service interruption, please update your payment method or send a quick note about what's going on:</p>
      <p><a href="${esc(updatePortal)}" style="background:#c5a059;color:#1a1410;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">Update payment method &rarr;</a></p>
      <p>Direct line if you want to handle this by phone: <a href="${META.tel}">${META.phone}</a>.</p>`;
  } else {
    subject = 'Final notice — ARIA service will pause if we cannot collect';
    body = `<p>Hi ${esc(name)},</p>
      <p>We've made multiple attempts to charge the card on file (${esc(fmtAmt)}) without success.</p>
      <p>This is the last reminder before we have to pause ARIA service on your account. Please update your card or get in touch directly so we can sort this out:</p>
      <p><a href="${esc(updatePortal)}" style="background:#c5a059;color:#1a1410;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">Update payment method &rarr;</a></p>
      <p>Direct line: <a href="${META.tel}">${META.phone}</a>. Reply to this email and a real person on our side will help — no autoresponder.</p>`;
  }

  // Customer email
  await sendResend(email, subject, shell(body));
  // Internal copy to Ahmad so he can intervene
  const opsSubject = '[payment_failed attempt ' + attemptCount + '] ' + email + ' · ' + fmtAmt;
  const opsBody = `<p>Stripe payment failed.</p>
    <ul>
      <li>Customer: ${esc(email)} (${esc(customerId)})</li>
      <li>Attempt: ${attemptCount}</li>
      <li>Amount: ${esc(fmtAmt)}</li>
      <li>Next retry: ${nextAttempt ? esc(nextAttempt.toISOString()) : 'unknown'}</li>
      <li>Invoice URL: ${esc(invoice.hosted_invoice_url || '—')}</li>
    </ul>
    <p>Customer email auto-sent. Step in if attempt &ge; 3 and the customer is high-value.</p>`;
  const ops = process.env.ORDER_NOTIFY_EMAIL || META.email;
  await sendResend(ops, opsSubject, shell(opsBody));
}

async function handlePaymentRecovered(stripe, invoice) {
  // Only fire recovery email if the previous invoice had attempt_count > 0 (i.e. it was failing)
  if (!invoice.attempt_count || invoice.attempt_count <= 1) return;
  const customerId = invoice.customer;
  let customer;
  try { customer = await stripe.customers.retrieve(customerId); }
  catch (e) { return; }
  const email = customer && customer.email;
  if (!email) return;
  const name = (customer.name || email.split('@')[0] || 'there').split(' ')[0];
  await sendResend(email,
    'Payment recovered — ARIA stays on',
    shell(`<p>Hi ${esc(name)},</p>
      <p>Your most recent payment went through. You're all set — ARIA stays on, no interruption.</p>
      <p>Thanks for sticking with us.</p>`));
}
