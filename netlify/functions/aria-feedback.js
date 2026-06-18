/**
 * aria-feedback — Per-message thumbs feedback collection.
 *  POST { msg_id, vote: 'up'|'down', text?, intent?, comment? }
 *  -> Logs vote, emails Ahmad on downvotes for quality review.
 *
 *  Cat 4 (trust + safety) + Cat 24 (AI safety + governance — eval signal).
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

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const vote = String(body.vote || '').toLowerCase();
  if (!['up', 'down'].includes(vote)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'vote must be "up" or "down"' }) };
  }
  const at = new Date().toISOString();
  const entry = {
    at,
    vote,
    msg_id: String(body.msg_id || '').slice(0, 120),
    intent: String(body.intent || '').slice(0, 60),
    text: String(body.text || '').slice(0, 600),
    comment: String(body.comment || '').slice(0, 600),
    email: String(body.email || '').toLowerCase().slice(0, 120)
  };

  console.log('[aria-feedback]', JSON.stringify(entry));

  // On downvotes, email Ahmad immediately so quality issues surface fast
  if (vote === 'down') {
    try {
      const to = process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
      const html = `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #fb7185;padding-top:18px"><h2 style="margin:0 0 14px;color:#c41e3a;font-family:Cinzel,serif">👎 ARIA downvote</h2><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0;color:#999;width:120px">When</td><td style="padding:6px 0">${esc(at)}</td></tr><tr><td style="padding:6px 0;color:#999">User email</td><td style="padding:6px 0">${esc(entry.email) || '<em>anonymous</em>'}</td></tr><tr><td style="padding:6px 0;color:#999">Intent</td><td style="padding:6px 0"><code>${esc(entry.intent) || '—'}</code></td></tr><tr><td style="padding:6px 0;color:#999">Message ID</td><td style="padding:6px 0"><code>${esc(entry.msg_id) || '—'}</code></td></tr></table>${entry.text ? `<h3 style="margin:18px 0 6px;font-family:Cinzel,serif;color:#0b1f3a">ARIA's reply that got the downvote</h3><pre style="background:#f5f4ef;border-left:3px solid #fb7185;padding:12px 16px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:12.5px">${esc(entry.text)}</pre>` : ''}${entry.comment ? `<h3 style="margin:18px 0 6px;font-family:Cinzel,serif;color:#0b1f3a">User comment</h3><pre style="background:#fef9eb;border-left:3px solid #c5a059;padding:12px 16px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:12.5px">${esc(entry.comment)}</pre>` : ''}<p style="margin:18px 0 0;color:#666;font-size:12px;border-top:1px solid #eee;padding-top:12px">Auto-routed by aria-feedback function. Address pattern in next KB expansion.</p></div></div>`;
      await sendResend(to, '[ARIA downvote] ' + (entry.intent || 'unknown intent'), html);
    } catch (e) { console.warn('[aria-feedback] alert mail failed:', e.message); }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, recorded: at }) };
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
