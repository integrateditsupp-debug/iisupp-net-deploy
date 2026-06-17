// aria-receipt-email v1 — sends end-of-session receipt to the user's email.
// Mirrors aperture-email-report.js pattern: Resend primary, SMTP fallback.
//
// Required env (priority order):
//   RESEND_API_KEY    + RESEND_FROM   — preferred (https://resend.com)
//   SMTP_APP_PASSWORD + SMTP_SENDER   — fallback Gmail App Password
//
// POST body: { to, firstName, lastName, company, sessionId, topics: [..], thread: [..] }
// Returns: { ok:true, sent:true, via:'resend'|'smtp' } on success.

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const to = String(body.to || '').trim();
  const firstName = String(body.firstName || '').trim();
  const lastName  = String(body.lastName  || '').trim();
  const company   = String(body.company   || '').trim();
  const sessionId = String(body.sessionId || '').trim();
  const topics    = Array.isArray(body.topics) ? body.topics : [];
  const thread    = Array.isArray(body.thread) ? body.thread : [];

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid `to` email required' }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const subject = `ARIA session receipt — ${today} (#${sessionId || 'session'})`;
  const html = renderReceiptHTML({ firstName, lastName, company, sessionId, topics, thread, today });
  const text = renderReceiptText({ firstName, lastName, company, sessionId, topics, thread, today });

  const errors = [];

  // ============= Path 1: Resend =============
  const resendKey = process.env.RESEND_API_KEY;
  const rawFrom = process.env.RESEND_FROM || 'ARIA — Integrated IT Support <noreply@iisupp.net>';
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: rawFrom,
          to: [to],
          bcc: ['ahmad.wasee@iisupp.net'],
          subject,
          html,
          text,
          reply_to: 'ahmad.wasee@iisupp.net'
        })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, via: 'resend', id: data && data.id }) };
      errors.push({ via: 'resend', status: r.status, data });
    } catch (e) {
      errors.push({ via: 'resend', error: String(e && e.message || e) });
    }
  } else {
    errors.push({ via: 'resend', skipped: 'RESEND_API_KEY not set' });
  }

  // ============= Path 2: Gmail SMTP fallback =============
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const smtpUser = process.env.SMTP_SENDER || 'ahmad.wasee@iisupp.net';
  if (smtpPass) {
    try {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: true,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const info = await transport.sendMail({
        from: '"ARIA — Integrated IT Support" <' + smtpUser + '>',
        to, bcc: 'ahmad.wasee@iisupp.net',
        subject, html, text,
        replyTo: 'ahmad.wasee@iisupp.net'
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, via: 'smtp', id: info.messageId }) };
    } catch (e) {
      errors.push({ via: 'smtp', error: String(e && e.message || e) });
    }
  } else {
    errors.push({ via: 'smtp', skipped: 'SMTP_APP_PASSWORD not set' });
  }

  return { statusCode: 500, headers, body: JSON.stringify({ ok: false, sent: false, errors }) };
};

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderReceiptHTML({ firstName, lastName, company, sessionId, topics, thread, today }){
  const topicList = topics.length
    ? '<ul style="margin:0 0 14px 18px;padding:0;color:#222;">' + topics.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>'
    : '<p style="color:#666;font-style:italic;margin:0 0 14px;">No discrete topics captured.</p>';
  const threadHTML = thread.length
    ? '<ol style="margin:0 0 14px 18px;padding:0;color:#222;line-height:1.5;">' + thread.slice(-20).map(m => {
        const role = m.role === 'you' ? '<strong>You:</strong> ' : '<strong>ARIA:</strong> ';
        return '<li style="margin:4px 0;">' + role + esc(m.text || '') + '</li>';
      }).join('') + '</ol>'
    : '';
  return '<!doctype html><html><body style="margin:0;padding:0;background:#0a0908;font-family:Inter,Arial,sans-serif;color:#222;">' +
    '<div style="max-width:640px;margin:0 auto;background:#fff;padding:32px 28px;">' +
      '<h1 style="font-family:\'Cinzel\',Georgia,serif;color:#1a1410;font-size:22px;letter-spacing:0.05em;margin:0 0 6px;">ARIA Session Receipt</h1>' +
      '<p style="margin:0 0 18px;color:#666;font-size:13px;">' + esc(today) + ' · Session #' + esc(sessionId) + '</p>' +
      '<p style="margin:0 0 16px;font-size:15px;">Hi ' + esc(firstName || 'there') + ',</p>' +
      '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Thank you for using ARIA today. Here is a copy of your session for your records.</p>' +
      '<h2 style="font-family:\'Cinzel\',Georgia,serif;color:#1a1410;font-size:15px;letter-spacing:0.04em;margin:20px 0 8px;border-bottom:1px solid #e5dcc4;padding-bottom:6px;">Profile</h2>' +
      '<p style="margin:0 0 6px;font-size:14px;"><strong>Name:</strong> ' + esc(firstName) + ' ' + esc(lastName) + '</p>' +
      '<p style="margin:0 0 6px;font-size:14px;"><strong>Company:</strong> ' + esc(company || '—') + '</p>' +
      '<p style="margin:0 0 14px;font-size:14px;"><strong>Email:</strong> ' + esc(firstName ? '' : '') + '</p>' +
      '<h2 style="font-family:\'Cinzel\',Georgia,serif;color:#1a1410;font-size:15px;letter-spacing:0.04em;margin:20px 0 8px;border-bottom:1px solid #e5dcc4;padding-bottom:6px;">Topics covered</h2>' +
      topicList +
      (threadHTML ? '<h2 style="font-family:\'Cinzel\',Georgia,serif;color:#1a1410;font-size:15px;letter-spacing:0.04em;margin:20px 0 8px;border-bottom:1px solid #e5dcc4;padding-bottom:6px;">Conversation transcript</h2>' + threadHTML : '') +
      '<p style="margin:24px 0 6px;font-size:14px;color:#666;">Need follow-up? Reply to this email — it goes straight to Integrated IT Support.</p>' +
      '<p style="margin:0;font-size:14px;color:#666;">Or open ARIA again any time at <a href="https://iisupp.net/aria" style="color:#a47826;">iisupp.net/aria</a>.</p>' +
      '<hr style="border:0;border-top:1px solid #e5dcc4;margin:24px 0 14px;">' +
      '<p style="margin:0;font-size:11px;color:#999;text-align:center;">Integrated IT Support Inc. · Whitby · Ontario · Global · (647) 581-3182</p>' +
    '</div>' +
    '</body></html>';
}

function renderReceiptText({ firstName, lastName, company, sessionId, topics, thread, today }){
  const lines = [];
  lines.push('ARIA Session Receipt');
  lines.push(today + ' · Session #' + sessionId);
  lines.push('');
  lines.push('Hi ' + (firstName || 'there') + ',');
  lines.push('');
  lines.push('Thank you for using ARIA today. Here is a copy of your session for your records.');
  lines.push('');
  lines.push('PROFILE');
  lines.push('  Name: ' + firstName + ' ' + lastName);
  lines.push('  Company: ' + (company || '—'));
  lines.push('');
  lines.push('TOPICS COVERED');
  if (topics.length) topics.forEach(t => lines.push('  - ' + t));
  else lines.push('  (none captured)');
  lines.push('');
  if (thread.length) {
    lines.push('CONVERSATION');
    thread.slice(-20).forEach(m => {
      const role = m.role === 'you' ? 'You: ' : 'ARIA: ';
      lines.push('  ' + role + (m.text || ''));
    });
  }
  lines.push('');
  lines.push('Reply to this email if you need follow-up — it goes straight to Integrated IT Support.');
  lines.push('Or open ARIA any time at https://iisupp.net/aria');
  return lines.join('\n');
}
