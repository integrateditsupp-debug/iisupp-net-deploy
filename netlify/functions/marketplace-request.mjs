// POST /.netlify/functions/marketplace-request
// Captures Marketplace sourcing checks before payment. No charge is created here.
// Payment happens only after IIS confirms vendor availability, shipping, final
// total, vendor/source disclosure, and buyer approval.

import { getStore } from '@netlify/blobs';

const ADMIN_EMAIL = 'ahmad.wasee@iisupp.net';
const SUPPORT_PHONE = '(647) 581-3182';

export default async (request) => {
  const headers = cors();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, headers, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return json(400, headers, { error: 'invalid JSON' }); }

  const lead = {
    item: clean(body.item, 160),
    name: clean(body.name, 160),
    email: clean(body.email, 320),
    phone: clean(body.phone, 80),
    country: clean(body.country, 80),
    city: clean(body.city, 120),
    postalCode: clean(body.postalCode, 40),
    budget: clean(body.budget, 80),
    notes: clean(body.notes, 2500),
    acceptedTerms: body.acceptedTerms === true,
    source: clean(body.source || 'marketplace', 200),
    createdAt: new Date().toISOString(),
    ua: request.headers.get('user-agent') || null,
    ip: request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || null
  };

  const missing = [];
  ['item', 'name', 'email', 'country', 'city', 'postalCode'].forEach((k) => {
    if (!lead[k]) missing.push(k);
  });
  if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) {
    return json(400, headers, { error: 'valid email required', field: 'email' });
  }
  if (missing.length) return json(400, headers, { error: 'missing required fields', fields: missing });
  if (!lead.acceptedTerms) return json(400, headers, { error: 'terms acknowledgement required', field: 'acceptedTerms' });

  const key = `${Date.now()}_${lead.email.replace(/[^a-z0-9]/gi, '_')}.json`;
  try {
    const store = getStore({ name: 'marketplace-requests', consistency: 'strong' });
    await store.setJSON(key, lead);
  } catch (e) {
    console.error('[marketplace-request] blob store failed:', e.message);
  }

  const sent = await notify(lead).catch((e) => {
    console.error('[marketplace-request] email failed:', e.message);
    return false;
  });

  return json(sent ? 200 : 202, headers, {
    ok: true,
    queued: !sent,
    message: sent
      ? 'Sourcing check received. IIS will verify shipping and final pricing before payment.'
      : `Sourcing check saved. If you need speed, call ${SUPPORT_PHONE}.`
  });
};

async function notify(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const fromEmail = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  const salesTo = process.env.SALES_NOTIFY_EMAIL || ADMIN_EMAIL;

  const adminHtml = shell(`
    <h1>Marketplace sourcing check</h1>
    <p><b>Item:</b> ${esc(lead.item)}</p>
    <p><b>Buyer:</b> ${esc(lead.name)} &lt;${esc(lead.email)}&gt; ${lead.phone ? ' / ' + esc(lead.phone) : ''}</p>
    <p><b>Ship check:</b> ${esc(lead.city)}, ${esc(lead.country)} ${esc(lead.postalCode)}</p>
    <p><b>Budget:</b> ${esc(lead.budget || 'not provided')}</p>
    <p><b>Notes:</b><br>${esc(lead.notes || 'none').replace(/\n/g, '<br>')}</p>
    <hr>
    <p><b>Required before payment:</b> confirm vendor ships to the region, final landed cost, vendor/source disclosure, warranty/return terms, and buyer approval. Then send Stripe checkout.</p>
  `);

  const buyerHtml = shell(`
    <h1>We received your Marketplace request</h1>
    <p>Hi ${esc(firstName(lead.name))},</p>
    <p>We will check whether <b>${esc(lead.item)}</b> can ship to <b>${esc(lead.city)}, ${esc(lead.country)} ${esc(lead.postalCode)}</b>.</p>
    <p>No payment has been taken. If the item can ship, we will send the final price, vendor/source details, warranty/return notes, and a Stripe checkout link for approval.</p>
    <p>Questions? Reply here or call ${SUPPORT_PHONE}.</p>
  `);

  const send = (to, subject, html, replyTo) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [to], reply_to: replyTo || undefined, subject, html })
  });

  const admin = await send(salesTo, `Marketplace sourcing check - ${lead.item}`, adminHtml, lead.email);
  if (!admin.ok) return false;
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [lead.email],
      subject: 'Your IIS Marketplace sourcing check',
      html: buyerHtml
    })
  }).catch(() => {});
  return true;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function json(status, headers, body) {
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function firstName(name) {
  return clean(name, 80).split(/\s+/)[0] || 'there';
}

function shell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#050505;color:#e7e3d8;font-family:Arial,sans-serif;padding:26px;">
    <div style="max-width:620px;margin:0 auto;border:1px solid #c5a059;border-radius:14px;background:#090909;padding:26px;">
      <div style="font-size:11px;letter-spacing:3px;color:#c5a059;text-transform:uppercase;margin-bottom:18px;">Integrated IT Support Marketplace</div>
      <div style="font-size:14px;line-height:1.75;color:#e7e3d8;">${inner}</div>
      <p style="font-size:11px;color:#888;border-top:1px solid #2a2418;padding-top:14px;margin-top:22px;">Integrated IT Support Inc. - ${ADMIN_EMAIL} - ${SUPPORT_PHONE}</p>
    </div>
  </body></html>`;
}
