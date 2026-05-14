// aperture-email-report — sends post-session report to user via Workspace SMTP relay
// Sender: ahmad.wasee@iisupp.net (Workspace), subject "Issue - YYYY-MM-DD"
// Requires env: SMTP_APP_PASSWORD (Google app password for the sender account)
// Requires Workspace admin: SMTP relay service enabled for the domain

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

  const { to, name, sessionId, summary, conversation, metrics } = body;
  if (!to || !sessionId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'to + sessionId required' }) };
  }

  // Graceful fallback if SMTP env not configured
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'ahmad.wasee@iisupp.net';
  const senderName = 'Integrated IT Support';

  if (!smtpPass) {
    console.log('[aperture-email-report] SMTP_APP_PASSWORD not set — would have emailed:', to, sessionId);
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        ok: true,
        queued: true,
        note: 'SMTP not yet configured; report logged but not emailed. Set SMTP_APP_PASSWORD env var in Netlify to enable.'
      })
    };
  }

  // Build subject + HTML
  const today = new Date().toISOString().slice(0, 10);
  const subject = `Issue - ${today}`;
  const html = renderReport({ name, sessionId, summary, conversation, metrics });

  // Send via Workspace SMTP relay
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.gmail.com',
      port: 587,
      secure: false,
      auth: { user: senderEmail, pass: smtpPass },
      requireTLS: true
    });
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      html,
      text: textVersion(summary)
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, to, subject }) };
  } catch (e) {
    console.error('[aperture-email-report] send failed:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

function renderReport({ name, sessionId, summary, conversation, metrics }) {
  const niceName = name || 'there';
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
INTEGRATED IT SUPPORT INC.  ·  (647) 581-3182  ·  iisupp.net
</td></tr>
</table>
</body></html>`;
}

function textVersion(summary) {
  return `Hi — here's a summary of your ARIA session:\n\n${summary || 'Issue resolved.'}\n\n— Integrated IT Support Inc.\n(647) 581-3182 · iisupp.net`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
