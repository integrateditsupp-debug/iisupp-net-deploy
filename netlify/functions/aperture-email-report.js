// aperture-email-report v0.3 — sends post-session report
// Per Ahmad 2026-05-14 PM: SMTP_APP_PASSWORD kept failing with 535 BadCredentials.
// v0.3 prefers Resend HTTP API (no 2FA dance, no app password drama) and falls
// back to direct Gmail SMTP if Resend isn't configured or fails.
//
// Required Netlify env vars (in priority order):
//   RESEND_API_KEY    — preferred. Get one at https://resend.com (free 3000/month)
//   RESEND_FROM       — verified sender like "Integrated IT Support <noreply@iisupp.net>"
// Optional fallback (only used if Resend fails):
//   SMTP_APP_PASSWORD — 16-char Google App Password (no spaces; account must have 2FA)
//   SMTP_SENDER       — sender email (default: ahmad.wasee@iisupp.net)
//   SMTP_HOST         — default: smtp.gmail.com
//   SMTP_PORT         — default: 465 (SSL); 587 STARTTLS auto-fallback
//
// Returns { ok:true, sent:true, via:'resend'|'smtp', ... } on success.
// Returns 500 with full diagnostic if both paths fail.

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

  const today = new Date().toISOString().slice(0, 10);
  const subject = `Issue - ${today}`;
  const html = renderReport({ name, sessionId, summary, conversation, metrics, endedBy });
  const text = textVersion(summary, endedBy);

  const errors = [];

  // ============= PATH 1: Resend (preferred) =============
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          html,
          text
        })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.id) {
        console.log('[aperture-email-report] sent via resend', { to, sessionId, msgId: j.id });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, via: 'resend', to, subject, msgId: j.id }) };
      }
      errors.push(`resend: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
      console.warn('[aperture-email-report] resend failed', errors[errors.length - 1]);
    } catch (e) {
      errors.push(`resend: ${e.message}`);
      console.warn('[aperture-email-report] resend exception', e.message);
    }
  } else {
    errors.push('resend: RESEND_API_KEY not set');
  }

  // ============= PATH 2: Gmail SMTP fallback =============
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'ahmad.wasee@iisupp.net';
  const senderName = 'Integrated IT Support';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const useSsl = smtpPort === 465;

  if (smtpPass) {
    const tryConfigs = [
      { host: smtpHost, port: smtpPort, secure: useSsl },
      { host: smtpHost, port: 587, secure: false, requireTLS: true }
    ];
    for (const cfg of tryConfigs) {
      try {
        const transporter = nodemailer.createTransport({
          ...cfg,
          auth: { user: senderEmail, pass: smtpPass.replace(/\s+/g, '') }  // strip spaces in case
        });
        const info = await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to,
          subject,
          html,
          text
        });
        console.log('[aperture-email-report] sent via smtp', { to, sessionId, host: cfg.host, port: cfg.port, msgId: info.messageId });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true, via: 'smtp', to, subject, host: cfg.host, port: cfg.port, msgId: info.messageId }) };
      } catch (e) {
        errors.push(`smtp ${cfg.port}: ${e.message}`);
        console.warn('[aperture-email-report] smtp cfg failed', { port: cfg.port, err: e.message });
      }
    }
  } else {
    errors.push('smtp: SMTP_APP_PASSWORD not set');
  }

  // ============= ALL PATHS FAILED =============
  console.error('[aperture-email-report] all email paths failed:', errors);
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      error: 'all email paths failed',
      attempts: errors,
      hint: 'Resend (preferred): set RESEND_API_KEY + RESEND_FROM (verified domain). Or fix SMTP_APP_PASSWORD: regenerate at https://myaccount.google.com/apppasswords (no spaces, 2FA-on, sender account = SMTP_SENDER).'
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
