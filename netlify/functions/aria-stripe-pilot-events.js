/**
 * aria-stripe-pilot-events — Listens to Stripe webhook events for pilot lifecycle
 *  customer.subscription.created -> queue welcome email (immediate)
 *  invoice.payment_succeeded (first time) -> mark customer activated
 *  
 *  Sister to stripe-webhook.js — focuses ONLY on pilot lifecycle, doesn't touch billing logic.
 *  Cat 15 — Lifecycle automation.
 */
const crypto = require('crypto');

function verifyStripeSig(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(',').forEach(p => { const [k, v] = p.split('='); parts[k] = v; });
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const signed = ts + '.' + payload;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const secret = process.env.STRIPE_PILOT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (secret && !verifyStripeSig(event.body, sig, secret)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'invalid signature' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const type = body.type;
  const obj = body.data?.object || {};

  let store = null;
  try {
    const { getStore } = require('@netlify/blobs');
    store = getStore({ name: 'aria-pilot-state', consistency: 'strong' });
  } catch {}

  // customer.subscription.created — kick off welcome email
  if (type === 'customer.subscription.created') {
    const customerId = obj.customer;
    let custEmail = null, custName = null;
    try {
      const r = await fetch('https://api.stripe.com/v1/customers/' + customerId, {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const j = await r.json();
      custEmail = j.email; custName = j.name;
    } catch {}

    if (custEmail) {
      // Send welcome email immediately
      await sendWelcome(custEmail, custName);
      // Mark pilot started
      if (store) await store.setJSON('pilot-' + customerId, {
        email: custEmail,
        name: custName,
        sub_id: obj.id,
        started_at: Date.now(),
        welcomed: true
      });
    }
    return ok({ ok: true, action: 'welcomed', customer: customerId });
  }

  // invoice.payment_succeeded — first payment = activated
  if (type === 'invoice.payment_succeeded') {
    const customerId = obj.customer;
    if (store) {
      try {
        const state = await store.get('pilot-' + customerId, { type: 'json' });
        if (state && !state.activated) {
          state.activated = true;
          state.activated_at = Date.now();
          await store.setJSON('pilot-' + customerId, state);
        }
      } catch {}
    }
    return ok({ ok: true, action: 'activated', customer: customerId });
  }

  return ok({ ok: true, ignored: type });

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

async function sendWelcome(email, name) {
  if (!process.env.RESEND_API_KEY) return;
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.6;padding:20px">
    <p style="font-size:15px">Hi ${firstName},</p>
    <p style="font-size:15px">Welcome aboard — you're one of the first IIS / ARIA paying customers.</p>
    <p style="font-size:15px"><strong>Right now (5 min):</strong></p>
    <ol style="font-size:14px">
      <li>Try a real IT question at <a href="https://iisupp.net/aria">https://iisupp.net/aria</a></li>
      <li>If ARIA gets it wrong, hit the thumbs-down — that signal trains the next answer</li>
      <li>Save the URL on your phone too</li>
    </ol>
    <p style="font-size:15px"><strong>This week:</strong></p>
    <ul style="font-size:14px">
      <li>Day 3 I'll check in with a 30-second "anything not landing?" message</li>
      <li>Day 7 I'll send a real check-in with what I see on your account</li>
      <li>Anytime: reply to this email or text +1-647-581-3182 — that's me, not a queue</li>
    </ul>
    <p style="font-size:15px"><strong>What we promise:</strong> ARIA never makes changes to your accounts (passwords, licenses, group memberships) without your admin approving each one via email.</p>
    <p style="font-size:15px">What's the one IT issue your team hits most often? Reply with it — that goes into your account-specific tuning.</p>
    <p style="font-size:15px">Ahmad Wasee<br>Founder, Integrated IT Support Inc.<br>iisupp.net · 647-581-3182</p>
  </div>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Ahmad at IIS <ahmad.wasee@iisupp.net>',
        to: [email],
        subject: 'Welcome to ARIA — ' + firstName + ", here's what happens next",
        html
      })
    });
  } catch (e) { console.warn('[stripe-pilot] welcome mail err:', e.message); }
}
