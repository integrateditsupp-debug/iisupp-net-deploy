/**
 * aria-welcome-email-ab — Wraps welcome email send with deterministic A/B split.
 *  POST { customer_id, email, name } -> { variant, sent_template }
 *  Variant chosen via hash(customer_id) % 2.
 *  Records send_at + variant in aria-welcome-ab-log blob for later analysis.
 *  Cat 2 — Activation / onboarding.
 */
const crypto = require('crypto');

const VARIANTS = {
  A: {
    name: 'value_first',
    subject: 'Welcome to ARIA — your first AI ticket starts here',
    preview: 'One sentence to ARIA and you get a triaged, sourced answer in 8s.',
    body: function(name) { return [
      'Hey ' + (name || 'there') + ',',
      '',
      "ARIA's now live on your account. The fastest first win:",
      '',
      "1) Type any IT problem at https://iisupp.net/aria — even one sentence.",
      "2) ARIA returns a triaged answer with source citations in <10s.",
      "3) Thumbs-up if it solved you, thumbs-down if not (we learn from both).",
      '',
      "You also have founder-direct access. Reply to this email any time.",
      '',
      '— Ahmad, Integrated IT Support'
    ].join('\\n'); }
  },
  B: {
    name: 'social_proof_first',
    subject: 'You\'re in. Here\'s how 73% of customers get value in 24h',
    preview: 'Start with the 3-question health check — typical time: 4 minutes.',
    body: function(name) { return [
      'Hey ' + (name || 'there') + ',',
      '',
      "Welcome. ARIA's now live on your account.",
      '',
      "Most of our customers see value within 24h by doing this:",
      '',
      "- Run the 3-question health check: https://iisupp.net/health-check (4 min)",
      "- Try one real support question at https://iisupp.net/aria",
      "- Reply to this email with what you wish AROC handled differently — I read every one.",
      '',
      "Booking a 15-min walkthrough? https://iisupp.net/book",
      '',
      '— Ahmad, Integrated IT Support'
    ].join('\\n'); }
  }
};

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const cid = String(body.customer_id || body.email || '');
  const email = String(body.email || '').toLowerCase().trim();
  const name = String(body.name || '').slice(0, 100);
  if (!cid || !email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'customer_id and email required' }) };

  // Deterministic split
  const hash = crypto.createHash('sha256').update(cid).digest('hex');
  const variantKey = (parseInt(hash.slice(0, 8), 16) % 2 === 0) ? 'A' : 'B';
  const v = VARIANTS[variantKey];

  let sent = false;
  let provider = null;
  let error = null;

  // Send via Resend if RESEND_API_KEY else log
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'ARIA <hello@iisupp.net>',
          to: email,
          subject: v.subject,
          text: v.body(name),
          reply_to: 'ahmad.wasee@iisupp.net'
        })
      });
      sent = r.ok;
      provider = 'resend';
      if (!r.ok) error = (await r.text()).slice(0, 200);
    } catch (e) { error = e.message; }
  }

  // Log
  try {
    const { getStore } = require('@netlify/blobs');
    const log = getStore({ name: 'aria-welcome-ab-log' });
    await log.setJSON('wab-' + cid + '-' + Date.now(), {
      ts: Date.now(),
      customer_id: cid,
      email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 32),
      variant: variantKey,
      variant_name: v.name,
      sent,
      provider,
      error
    });
  } catch {}

  return { statusCode: 200, headers, body: JSON.stringify({
    ok: true, variant: variantKey, variant_name: v.name, sent, provider, error
  })};
};
