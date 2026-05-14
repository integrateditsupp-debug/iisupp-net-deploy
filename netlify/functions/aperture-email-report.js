// aperture-email-report v0.2 — sends post-session report via Gmail SMTP
// Per Ahmad 2026-05-14 PM: email reports were failing with "535 Bad Credentials"
// when using smtp-relay.gmail.com. v0.2 switches to direct smtp.gmail.com which
// works with a standard Google App Password (no Workspace admin relay setup needed).
//
// Required Netlify env vars:
//   SMTP_APP_PASSWORD   — 16-char Google App Password from https://myaccount.google.com/apppasswords
//                         (account MUST have 2FA enabled to generate one)
//   SMTP_SENDER         — sender email (default: ahmad.wasee@iisupp.net)
//   SMTP_HOST           — optional override (default: smtp.gmail.com)
//   SMTP_PORT           — optional override (default: 465 SSL)
//
// If SMTP_APP_PASSWORD is missing, function returns 202 with a queued note (no failure).
// If credentials are bad, function returns 500 with the actual error.

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

  const { to, name, sessionId, summary, conversation, metrics, endedBy } = body;
  if (!to || !sessionId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'to + sessionId required' }) };
  }

  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'ahmad.wasee@iisupp.net';
  const senderName = 'Integrated IT Support';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const useSsl = smtpPort === 465;

  if (!smtpPass) {
    console.warn('[aperture-email-report] SMTP_APP_PASSWORD not set — would have emailed:', to, sessionId);
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        ok: true,
        queued: true,
        note: 'SMTP not configured. Set SMTP_APP_PASSWORD env var in Netlify (16-char Google App Password from https://myaccount.google.com/apppasswords; requires 2FA on the sender account).'
      })
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const subject = `Issue - ${today}`;
  const html = renderReport({ name, sessionId, summary, conversation, metrics, endedBy });

  // v0.2: try smtp.gmail.com (default) which works with any Google App Password.
  // Fallback path: if 465 SSL fails, try 587 STARTTLS.
  const tryConfigs = [
    { host: smtpHost, port: smtpPort, secure: useSsl },
    { host: smtpHost, port: 587, secure: false, requireTLS: true }
  ];

  let lastErr = null;
  for (const cfg of tryConfigs) {
    try {
      const transporter = nodemailer.createTransport({
        ...cfg,
        auth: { user: senderEmail, pass: smtpPass }
      });
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        html,
        text: textVersion(summary, endedBy)
      });
      console.log('[aperture-email-report] sent', { to, sessionId, host: cfg.host, port: cfg.port, msgId: info.messageId });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, to, subject, host: cfg.host, port: cfg.port, msgId: info.messageId }) };
    } catch (e) {
      lastErr = e;
      console.warn('[aperture-email-report] cfg failed', { host: cfg.host, port: cfg.port, err: e.message });
    }
  }
  console.error('[aperture-email-report] all SMTP attempts failed:', lastErr && lastErr.message);
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      error: lastErr ? lastErr.message : 'unknown smtp error',
      hint: 'If 535 BadCredentials: regenerate the Google App Password at https://myaccount.google.com/apppasswords (must be 2FA-protected sender account). Update SMTP_APP_PASSWORD env var in Netlify.'
    })
  };
};

function renderReport({ name, sessionId, summary, conversation, metrics, endedBy }) {
  const niceName = name || 'there';
  const endNote = endedBy === 'aria' ? 'ARIA closed the session.' : (endedBy === 'user' ? 'You closed the session.' : '');
  const conv = (conversation || []).map(m =>
    `<div style="margin:12px 0;"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;">${m.from}</div><div style="padding:10px 14px;background:#0d1824;border:1px solid #243a47;color:#d8e0e6;margin-top:4px;border-radius:2px;">${escapeHtml(m.text||'')}</div></div>`
  ).join('');
  const layers = metrics && metrics.layers ? metrics.layers.map(([n,p]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#d8e0e6;font-family:'JetBrains Mono',monospace;font-size:11px;">${n}</td><td style="padding:4px 0;color:#2dd4bf;font-family:'JetBrains Mono',monospace;font-size:11px;">${p}%</td></tr>`).join('') : '';
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#050810;color:#d8e0e6;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;">
<tr><td style="padding-bottom:16px;border-bottom:1px solid #1a2b35;">
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#2dd4bf;">APERTURE · SESSION REPORT</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#6b7c87;margin-top:4px;">${sessionId}</div>
${endNote ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#6b7c87;margin-top:4px;">${endNote}</div>` : ''}
</td></tr>
<tr><td style="padding:24px 0 16px 0;">
<p style="font-size:14px;color:#d8e0e6;margin:0 0 16px 0;">Hi ${escapeHtml(niceName)},</p>
<p style="font-size:13px;color:#98a8b3;line-height:1.6;margin:0 0 16px 0;">Here's the full picture of how ARIA worked your issue. The transcript is below, plus what ARIA used to think through it. Reply to this email if you'd like to chat with a human.</p>
</td></tr>
<tr><td style="padding:0 0 24px 0;">
<div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:8px;">RESOLUTION SUMMARY</div>
<div style="padding:14px;background:#0a1219;border:1px solid #2dd4bf;color:#d8e0e6;font-size:13px;line-height:1.6;">${escapeHtml(summary || 'Resolved.')}</div>
</td></tr>
${layers ? `<tr><td style="padding:0 0 24px 0;">
<div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:8px;">ARCHITECTURE LAYER USAGE</div>
<table cellpadding="0" cellspacing="0" style="width:auto;">${layers}</table>
</td></tr>` : ''}
<tr><td>
<div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:8px;">CONVERSATION</div>
${conv}
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid #1a2b35;font-size:11px;color:#6b7c87;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">
INTEGRATED IT SUPPORT INC. · (647) 581-3182 · iisupp.net
</td></tr>
</table>
</body></html>`;
}

function textVersion(summary, endedBy) {
  const endNote = endedBy === 'aria' ? '\n\n(ARIA closed this session.)' : (endedBy === 'user' ? '\n\n(You closed this session.)' : '');
  return `Hi — here's a summary of your ARIA session:\n\n${summary || 'Issue resolved.'}${endNote}\n\n— Integrated IT Support Inc.\n(647) 581-3182 · iisupp.net`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
