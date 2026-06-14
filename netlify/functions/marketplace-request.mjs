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
    cartItems: Array.isArray(body.cartItems) ? body.cartItems.slice(0, 20).map(cleanCartItem).filter(Boolean) : [],
    cartSubtotal: moneyNumber(body.cartSubtotal),
    cartAdminFee: moneyNumber(body.cartAdminFee),
    cartTotal: moneyNumber(body.cartTotal),
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
    ${lead.cartItems.length ? `<h2>Cart</h2>${cartHtml(lead)}` : ''}
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

function moneyNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function cleanCartItem(row) {
  if (!row || typeof row !== 'object') return null;
  const title = clean(row.title, 180);
  if (!title) return null;
  return {
    id: clean(row.id, 80),
    title,
    type: clean(row.type, 40),
    category: clean(row.category, 120),
    vendor: clean(row.vendor, 240),
    qty: Math.max(1, Math.min(99, Math.round(Number(row.qty || 1)) || 1)),
    vendorPrice: moneyNumber(row.vendorPrice),
    adminFee: moneyNumber(row.adminFee),
    total: moneyNumber(row.total)
  };
}

function dollars(n) {
  return '$' + Math.round(Number(n || 0)).toLocaleString('en-CA');
}

function cartHtml(lead) {
  const rows = lead.cartItems.map((i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #2a2418;">${esc(i.qty)} x ${esc(i.title)}<br><small>${esc(i.category)} / ${esc(i.vendor)}</small></td>
      <td style="padding:8px;border-bottom:1px solid #2a2418;text-align:right;">${esc(dollars(i.vendorPrice))}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2418;text-align:right;">${esc(dollars(i.adminFee))}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2418;text-align:right;">${esc(dollars(i.total * i.qty))}</td>
    </tr>
  `).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th align="left" style="padding:8px;border-bottom:1px solid #c5a059;">Item</th>
          <th align="right" style="padding:8px;border-bottom:1px solid #c5a059;">Vendor</th>
          <th align="right" style="padding:8px;border-bottom:1px solid #c5a059;">IIS fee</th>
          <th align="right" style="padding:8px;border-bottom:1px solid #c5a059;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><b>Estimated vendor subtotal:</b> ${esc(dollars(lead.cartSubtotal))}<br>
    <b>Estimated IIS admin fee:</b> ${esc(dollars(lead.cartAdminFee))}<br>
    <b>Estimated total:</b> ${esc(dollars(lead.cartTotal))}</p>
  `;
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
