/**
 * stripe-webhook — receives Stripe events.
 *  - Logs subscription lifecycle events (existing behaviour).
 *  - On checkout.session.completed for a concierge book order
 *    (metadata.kind === 'book-order'), sends two emails via Resend:
 *      1) the customer: a branded "thank you for choosing us" confirmation;
 *      2) IIS ops: a fulfilment order with the customer's shipping address and
 *         our contact info (supplier is never referenced).
 *    Email failures are logged but never fail the webhook.
 */
const Stripe = require('stripe');

const META = {
  brand: 'Integrated IT Support',
  email: 'ahmad.wasee@iisupp.net',
  phone: '(647) 581-3182',
  tel: '+16475813182'
};

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

  console.log('[stripe-webhook] Received:', evt.type);

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
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed':
      console.log('[stripe-webhook] Event:', evt.type, 'customer:', evt.data.object.customer);
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

  // 1) Customer — branded thank-you (supplier never mentioned)
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
      <p>Questions? Just reply to this email or call ${META.phone}.</p>
      <p style="margin-top:22px">Warmly,<br><strong>${META.brand}</strong></p>
    `);
    await sendResend(email, `Thank you for choosing ${META.brand} — order confirmed`, html);
  } else {
    console.warn('[stripe-webhook] book-order had no customer email; skipped customer mail');
  }

  // 2) IIS ops — fulfilment order (our contact + customer's shipping address)
  const opsHtml = shell(`
    <h1 style="margin:0 0 6px;font:600 20px/1.2 Georgia,serif;color:#0b1f3a">New book order to fulfil</h1>
    <p style="margin:0 0 16px;color:#555">Place the order with our vendor and ship to the address below. Bill IIS contact details on any paperwork that reaches the customer.</p>
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
async function sendResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || `${META.brand} <noreply@iisupp.net>`;
  if (!key) { console.warn('[stripe-webhook] RESEND_API_KEY not set; skipped:', subject); return false; }
  const send = (fromAddr) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddr, to: [to], subject, html })
  });
  try {
    const r = await send(from);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) { console.log('[stripe-webhook] emailed', to, 'msg', j.id); return true; }
    console.warn('[stripe-webhook] resend failed', r.status, JSON.stringify(j).slice(0, 200));
    // Domain-not-verified fallback (delivers only to the Resend account owner).
    if (r.status === 403 || JSON.stringify(j).toLowerCase().includes('not verified')) {
      const r2 = await send('Integrated IT Support <onboarding@resend.dev>');
      const j2 = await r2.json().catch(() => ({}));
      if (r2.ok && j2.id) { console.log('[stripe-webhook] emailed via onboarding fallback', to); return true; }
    }
    return false;
  } catch (e) { console.warn('[stripe-webhook] resend exception', e.message); return false; }
}
