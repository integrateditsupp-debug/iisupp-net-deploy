/**
 * After Stripe Checkout success, this is called server-side:
 * 1. Retrieves session from Stripe
 * 2. Issues a license via aria-license
 * 3. Triggers welcome email via Resend
 */
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return j(500, { error: 'Stripe not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const sessionId = body.session_id;
  if (!sessionId) return j(400, { error: 'session_id required' });

  const stripe = Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer'] });
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return j(402, { error: 'Payment not completed' });
    }

    const tier = (session.metadata && session.metadata.tier) || 'pro';
    const planName = (session.metadata && session.metadata.planName) || 'ARIA';
    const email = session.customer_details?.email || session.customer_email || (session.customer && session.customer.email);

    if (!email) return j(400, { error: 'No customer email on session' });

    // Issue license
    const origin = `https://${event.headers.host}`;
    const licenseRes = await fetch(`${origin}/.netlify/functions/aria-license`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'issue', plan: tier, email, source: 'stripe-paid' }),
    });
    const license = await licenseRes.json().catch(() => ({}));

    // Send welcome email via Resend (non-blocking)
    if (process.env.RESEND_API_KEY && license.token) {
      sendWelcomeEmail(email, license.token, planName).catch(e => console.error('[stripe-confirm] email:', e.message));
    }

    return j(200, { ok: true, license: license.token, email, plan: tier });
  } catch (err) {
    console.error('[stripe-confirm] error:', err.message);
    return j(500, { error: 'Could not confirm payment. Please call (647) 581-3182 with your receipt.' });
  }
};

async function sendWelcomeEmail(email, license, plan) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const fromEmail = process.env.RESEND_FROM || 'ARIA <noreply@iisupport.net>';

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#000;color:#f5f5f0;padding:40px;">
    <div style="max-width:600px;margin:0 auto;border:1px solid #c5a059;border-radius:12px;padding:32px;background:#0a0a0a;">
      <h1 style="color:#c5a059;font-family:'Times New Roman',serif;font-size:36px;margin:0 0 16px;">Welcome to ARIA</h1>
      <p style="font-size:16px;line-height:1.6;">Thank you for subscribing to <strong>${escape(plan)}</strong>.</p>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Your License Token</h2>
      <div style="background:#1a1a1a;border:1px solid #c5a059;padding:18px;border-radius:8px;font-family:monospace;font-size:18px;color:#c5a059;text-align:center;letter-spacing:2px;">${escape(license)}</div>
      <p style="font-size:14px;color:#aaa;margin-top:8px;">Save this. You'll need it to activate ARIA on each device.</p>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Quick Start</h2>
      <ol style="font-size:15px;line-height:1.8;">
        <li>Visit <a href="https://iisupport.net/aria" style="color:#c5a059;">iisupport.net/aria</a> on any device</li>
        <li>Activate with the license above</li>
        <li>Tap the mic and start talking — ARIA's ready to help 24/7</li>
      </ol>
      <h2 style="color:#c5a059;font-size:18px;margin-top:32px;">Need Help?</h2>
      <p style="font-size:15px;line-height:1.6;">📞 <a href="tel:6475813182" style="color:#c5a059;">(647) 581-3182</a> — 24/7 support<br>
      ✉️ <a href="mailto:integrateditsupp@gmail.com" style="color:#c5a059;">integrateditsupp@gmail.com</a></p>
      <p style="font-size:12px;color:#888;margin-top:32px;border-top:1px solid #333;padding-top:16px;">
      Integrated IT Support Inc. · iisupport.net · 647-581-3182<br>
      ARIA — Senior IT Helpdesk in your pocket.</p>
    </div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: `Welcome to ARIA — Your ${plan} License Inside`,
      html,
    }),
  });
}

function escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function j(s, b) { return { statusCode: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }; }
