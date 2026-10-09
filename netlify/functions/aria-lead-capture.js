const { checkRateLimit, rateLimitResponse, hashKey } = require('./_rate-limit');
const { SALES_EMAIL, OWNER_EMAIL, SUPPORT_PHONE, SUPPORT_TEL } = require('./lib/contacts.cjs');
const { handleCaptureGet } = require('./lib/capture-read.cjs');

/**
 * aria-lead-capture — Capture a "talk to sales" lead from the /aria chat.
 *  POST { name, email, company, phone?, message? }
 *  -> Emails Ahmad with the lead + sends customer a confirmation
 *
 *  Revenue path: Category 15 (Sales/CRM). Closes the gap where users
 *  ready to buy had no path from chat to a sales conversation.
 *
 *  2026-10-08 (audit §5 / top-10 #9): the lead is PERSISTED to Blobs (`aria-leads`, key lead/<ts>_<hash>)
 *  BEFORE any email (pattern marketplace-request.mjs), mail goes through lib/notify.mjs, and when the owner
 *  alert could not be delivered the response says so — ok:false, stored:true, delivered:false — with the
 *  fallback email/phone, instead of "Lead captured" over a lost email. The success shape is unchanged.
 *
 *  2026-10-09 (small-tasks close-out, task 2): GET read path, admin-token gated (lib/capture-read.cjs).
 *  GET ?since=<iso>&limit=<n> → { ok:true, count, items:[...] } newest first, capped at 200, 401/503 without
 *  a valid token. The POST path below is unchanged.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod === 'GET') return handleCaptureGet(event, { storeName: 'aria-leads', prefix: 'lead/', scope: 'aria-lead-capture' });
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const limit = checkRateLimit(event, { scope: 'aria-lead-capture', limit: 12, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return rateLimitResponse(limit, headers);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const company = String(body.company || '').trim();
  const phone = String(body.phone || '').trim();
  const message = String(body.message || '').trim();
  const lastIntent = String(body.last_intent || '').trim();
  const source = String(body.source || '/aria').trim();

  if (!name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name + email required' }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
  }

  const at = new Date().toISOString();
  const ahmad = process.env.SALES_NOTIFY_EMAIL || process.env.ORDER_NOTIFY_EMAIL || SALES_EMAIL;

  // 1) persist FIRST — the lead is the asset, the email is the courtesy
  const leadRecord = { at, name, email, company: company || null, phone: phone || null, message: message || null, last_intent: lastIntent || null, source, ua: (event.headers && event.headers['user-agent']) || null };
  let stored = false;
  let leadKey = null;
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-leads', consistency: 'strong' });
    leadKey = `lead/${Date.now()}_${hashKey(email).slice(0, 16)}`;
    await store.setJSON(leadKey, leadRecord);
    stored = true;
  } catch (e) {
    console.error('[aria-lead-capture] lead NOT stored:', e.message);
  }

  // Email Ahmad — formatted as a sales-ready lead
  const opsHtml = shell(`
    <h2 style="font-family:Cinzel,serif;color:#c5a059;font-size:18px;margin:0 0 14px">NEW LEAD — ARIA chat</h2>
    <p style="margin:0 0 14px"><strong>${esc(name)}</strong> just asked to talk to sales from <code>${esc(source)}</code>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">
      <tr><td style="padding:6px 0;color:#999;width:120px">Name</td><td style="padding:6px 0"><strong>${esc(name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#999">Email</td><td style="padding:6px 0"><a href="mailto:${esc(email)}" style="color:#c5a059;text-decoration:none"><strong>${esc(email)}</strong></a></td></tr>
      <tr><td style="padding:6px 0;color:#999">Company</td><td style="padding:6px 0"><strong>${esc(company || '—')}</strong></td></tr>
      ${phone ? `<tr><td style="padding:6px 0;color:#999">Phone</td><td style="padding:6px 0"><a href="tel:${esc(phone)}" style="color:#c5a059;text-decoration:none">${esc(phone)}</a></td></tr>` : ''}
      ${lastIntent ? `<tr><td style="padding:6px 0;color:#999">Last intent</td><td style="padding:6px 0"><code>${esc(lastIntent)}</code></td></tr>` : ''}
    </table>
    ${message ? `<div style="background:rgba(197,160,89,.08);border-left:2px solid #c5a059;padding:12px 16px;border-radius:6px;margin:14px 0"><strong style="color:#c5a059;display:block;margin-bottom:6px">THEIR MESSAGE</strong>${esc(message)}</div>` : ''}
    <p style="margin:20px 0 0;color:#666;font-size:12px">Logged at ${at}. Fastest response wins.</p>
  `);
  // Confirmation to lead
  const leadHtml = shell(`
    <h2 style="font-family:Cinzel,serif;color:#c5a059;font-size:18px;margin:0 0 14px">Got it — Ahmad will reach out shortly</h2>
    <p style="margin:0 0 14px">Hi ${esc(name.split(' ')[0])},</p>
    <p style="margin:0 0 14px">Thanks for reaching out from ARIA. Ahmad — founder of Integrated IT Support — has been notified and will get back to you within the next business day, usually faster.</p>
    ${message ? `<div style="background:rgba(197,160,89,.08);border-left:2px solid #c5a059;padding:12px 16px;border-radius:6px;margin:14px 0">${esc(message)}</div>` : ''}
    <p style="margin:14px 0 0">In the meantime if you want to start ARIA again or browse plans, head to <a href="https://iisupp.net/aria" style="color:#c5a059">iisupp.net/aria</a> or <a href="https://iisupp.net/plans" style="color:#c5a059">iisupp.net/plans</a>.</p>
    <p style="margin:14px 0 0">Direct line if urgent: <a href="tel:${esc(SUPPORT_TEL)}" style="color:#c5a059">${esc(SUPPORT_PHONE)}</a></p>
  `);

  // 2) emails — both in parallel, both honest
  const [ops, conf] = await Promise.all([
    sendResend(ahmad, `[LEAD] ${name} · ${email}${company ? ' · ' + company : ''}`, opsHtml, email),
    sendResend(email, 'Got your message — Ahmad will reach out shortly', leadHtml)
  ]).catch(e => { console.warn('[aria-lead-capture] email error:', e.message); return [{ ok: false, error: e.message }, { ok: false, error: e.message }]; });

  console.log('[aria-lead-capture] lead captured:', JSON.stringify({ at, email_hash: hashKey(email).slice(0, 16), source, stored, key: leadKey, ops_delivered: !!ops.ok, confirmation_delivered: !!conf.ok }));

  if (ops.ok) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Lead captured — Ahmad will reach out shortly.', stored, delivered: true, confirmation_sent: !!conf.ok }) };
  }
  // The owner alert did not go out: say so, keep the lead, hand the visitor a path that works today.
  console.error('[aria-lead-capture] owner alert NOT delivered', JSON.stringify({ key: leadKey, error: ops.error, attempts: ops.attempts }));
  return { statusCode: stored ? 200 : 502, headers, body: JSON.stringify({
    ok: false,
    stored,
    delivered: false,
    confirmation_sent: !!conf.ok,
    error: ops.dormant ? 'email_not_configured' : 'email_delivery_failed',
    message: stored
      ? `Your details are saved on our side, but our alert email did not go through. To make sure you are not kept waiting, email ${OWNER_EMAIL} or call ${SUPPORT_PHONE} and mention ARIA.`
      : `We could not save your request right now. Please email ${OWNER_EMAIL} or call ${SUPPORT_PHONE} and mention ARIA.`,
    fallback: { email: OWNER_EMAIL, phone: SUPPORT_PHONE }
  }) };
};

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function shell(inner) {
  return `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;line-height:1.6;font-size:15px;background:#fff;padding:24px"><div style="border-top:3px solid #c5a059;padding-top:18px">${inner}<p style="margin:24px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">Integrated IT Support Inc. · ${esc(SUPPORT_PHONE)} · ${esc(OWNER_EMAIL)}</p></div></div>`;
}

// Honest sender (lib/notify.mjs): ok only when Resend/SMTP confirmed the message.
async function sendResend(to, subject, html, replyTo) {
  try {
    const { sendEmail } = await import('./lib/notify.mjs');
    return await sendEmail({ to, subject, html, replyTo, tag: 'lead-capture' });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
