const { checkRateLimit, rateLimitResponse } = require('./_rate-limit');

/**
 * aria-warm-handoff — Live-agent warm handoff from ARIA chat.
 *  POST { email, name?, chat_summary, last_intent, urgency }
 *  -> Sends Ahmad a rich-context page with everything he needs to step in.
 *
 *  Cat 20 — Real-time collaboration. Closes the gap where users wanted
 *  a human mid-conversation but had no path.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const limit = checkRateLimit(event, { scope: 'aria-warm-handoff', limit: 8, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return rateLimitResponse(limit, headers);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const summary = String(body.chat_summary || '').trim().slice(0, 4000);
  const lastIntent = String(body.last_intent || '').trim();
  const urgency = String(body.urgency || 'normal').trim();
  const sessionStart = body.session_start || '';

  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };

  const at = new Date().toISOString();
  const ahmad = process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  const subject = `[HANDOFF · ${urgency.toUpperCase()}] ${name || email} wants live help`;

  const html = `<div style="max-width:620px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;line-height:1.6;font-size:15px;background:#fff;padding:24px"><div style="border-top:4px solid ${urgency==='urgent' ? '#ff4d4f' : '#c5a059'};padding-top:18px"><h2 style="margin:0 0 8px;color:#0b1f3a;font-family:Cinzel,serif">🔴 LIVE-AGENT REQUEST</h2><p style="margin:0 0 18px;color:#666">A user just hit the "Talk to a human" button mid-ARIA-session. They expect a real human reply within minutes.</p><table style="width:100%;border-collapse:collapse;font-size:14px;background:#f8f7f3;border-radius:8px;padding:0"><tr><td style="padding:10px 14px;color:#999;width:130px">Email</td><td style="padding:10px 14px"><strong>${esc(email)}</strong></td></tr>${name ? `<tr><td style="padding:10px 14px;color:#999">Name</td><td style="padding:10px 14px">${esc(name)}</td></tr>` : ''}${lastIntent ? `<tr><td style="padding:10px 14px;color:#999">Last intent</td><td style="padding:10px 14px"><code>${esc(lastIntent)}</code></td></tr>` : ''}<tr><td style="padding:10px 14px;color:#999">Urgency</td><td style="padding:10px 14px"><strong style="color:${urgency==='urgent' ? '#ff4d4f' : '#c5a059'}">${esc(urgency.toUpperCase())}</strong></td></tr>${sessionStart ? `<tr><td style="padding:10px 14px;color:#999">Session started</td><td style="padding:10px 14px">${esc(sessionStart)}</td></tr>` : ''}<tr><td style="padding:10px 14px;color:#999">Handoff at</td><td style="padding:10px 14px">${esc(at)}</td></tr></table>${summary ? `<h3 style="margin:22px 0 8px;color:#0b1f3a;font-family:Cinzel,serif">CHAT CONTEXT</h3><pre style="background:#f5f4ef;border-radius:8px;padding:14px 16px;white-space:pre-wrap;word-break:break-word;font-family:'JetBrains Mono',Menlo,monospace;font-size:12.5px;color:#333;border-left:3px solid #c5a059;margin:0">${esc(summary)}</pre>` : ''}<div style="margin:22px 0 0;padding:14px 16px;background:#fef9eb;border-left:3px solid #c5a059;border-radius:8px"><p style="margin:0;color:#666;font-size:13px"><strong style="color:#c5a059">FASTEST PATH:</strong> Reply directly to ${esc(email)} — they're expecting you. Or call them if a phone was provided.</p></div><p style="margin:22px 0 0;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:12px">Logged via /aria. Integrated IT Support · (647) 581-3182</p></div></div>`;

  await sendResend(ahmad, subject, html).catch(e => console.warn('[warm-handoff] mail error:', e.message));
  // Also email the customer so they know someone heard them
  await sendResend(email, "Got you — Ahmad is being paged now", `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;font-size:15px;background:#fff;padding:24px"><div style="border-top:3px solid #c5a059;padding-top:18px"><p>Hi${name ? ' ' + esc(name.split(' ')[0]) : ''},</p><p>Your handoff request just hit Ahmad's inbox with your full context. He'll reply directly within minutes (usually faster during business hours).</p><p>If you need to add anything, just reply to this email.</p><p>— ARIA on behalf of Integrated IT Support</p><p style="margin:18px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">Direct line if it's urgent: (647) 581-3182</p></div></div>`).catch(e => console.warn('[warm-handoff] customer mail error:', e.message));

  console.log('[aria-warm-handoff] handoff queued for', email, 'urgency:', urgency);
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Ahmad is being paged now.' }) };
};

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function sendResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html }) });
    if (r.ok) return true;
    if (r.status === 403) { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Integrated IT Support <onboarding@resend.dev>', to: [to], subject, html }) }); return true; }
    return false;
  } catch { return false; }
}
