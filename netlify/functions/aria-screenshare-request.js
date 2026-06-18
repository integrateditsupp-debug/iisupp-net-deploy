/**
 * aria-screenshare-request — Tenant-initiated screen share request flow
 *  POST { email, name, urgency, context, room_pref }
 *    -> generates a one-time room URL (Whereby / Daily / Google Meet stub), emails tenant + Ahmad
 *
 *  Privacy: tenant must approve from their end; Ahmad must accept invite to join.
 *  No auto-join, no recording without explicit consent in the meeting itself.
 *
 *  Cat 20 — Live remote support / screen share.
 */
const crypto = require('crypto');
const { redact } = require('./_pii-redact');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://iisupp.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').toLowerCase().trim();
  const name = String(body.name || '').trim();
  const urgency = ['normal','urgent'].includes(body.urgency) ? body.urgency : 'normal';
  const context = String(body.context || '').slice(0, 1000);

  if (!email || !/.+@.+\..+/.test(email)) {
    return ok({ ok: false, error: 'valid email required' });
  }

  const room = generateRoomLink();
  const reqId = crypto.randomBytes(8).toString('hex');

  // Email tenant — they receive the join link only after Ahmad accepts
  await sendTenantConfirmation(email, name, reqId, urgency);

  // Page Ahmad with full context + the room URL
  await sendAhmadAlert({ email, name, urgency, context, room, reqId });

  return ok({
    ok: true,
    request_id: reqId,
    status: 'pending_admin_acceptance',
    message: 'We received your request. A technician will reach out within ' + (urgency === 'urgent' ? '15 minutes' : '2 business hours') + ' with a private screen-share link.'
  });

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};

function generateRoomLink() {
  // v0.1 stub: produces a Whereby-pattern room slug. Replace with real provider API on integration.
  // In production: call Whereby/Daily/Jitsi API with createMeeting()
  const slug = crypto.randomBytes(6).toString('hex');
  return {
    provider: 'pending-provider-api',
    url: 'https://meet.iisupp.net/r/' + slug,
    slug,
    expires_at: Date.now() + 24 * 3600 * 1000,
    note: 'Replace this with Whereby/Daily API call on provider integration'
  };
}

async function sendTenantConfirmation(email, name, reqId, urgency) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const sla = urgency === 'urgent' ? '15 minutes' : '2 business hours';
  const html =
    '<div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:20px;color:#111">' +
    '<h2 style="color:#d4af37">Screen-share request received</h2>' +
    '<p>Hi ' + (name || 'there') + ',</p>' +
    '<p>We got your request for live screen-share support. A technician will reach out within <strong>' + sla + '</strong> with a secure room link.</p>' +
    '<p><strong>What happens next:</strong></p>' +
    '<ol><li>You will get a follow-up email with a one-time screen-share link.</li><li>You click it to join — nothing installs on your computer.</li><li>The session ends when you close the tab. No recording without your explicit consent.</li></ol>' +
    '<p>Reference ID: <code>' + reqId + '</code></p>' +
    '<p>If this was a mistake, just ignore this email.</p>' +
    '<p style="color:#888;font-size:12px;margin-top:24px">Integrated IT Support Inc. · iisupp.net</p>' +
    '</div>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
        to: [email],
        subject: 'We received your screen-share request — IIS',
        html
      })
    });
  } catch (e) { console.warn('[screenshare] tenant mail failed:', e.message); }
}

async function sendAhmadAlert(payload) {
  const to = process.env.ARIA_HANDOFF_TO || 'ahmad.wasee@iisupp.net';
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('[screenshare] RESEND_API_KEY missing'); return; }
  const html =
    '<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">' +
    '<h2 style="color:' + (payload.urgency === 'urgent' ? '#dc2626' : '#d4af37') + '">' +
    (payload.urgency === 'urgent' ? 'URGENT: ' : '') + 'Screen-share request</h2>' +
    '<p><strong>From:</strong> ' + redact(payload.name || '?') + ' &lt;' + redact(payload.email) + '&gt;</p>' +
    '<p><strong>Context:</strong> ' + redact(payload.context || '(none provided)') + '</p>' +
    '<p><strong>Pre-allocated room:</strong> <a href="' + payload.room.url + '">' + payload.room.url + '</a></p>' +
    '<p style="background:#fffbea;border-left:4px solid #d4af37;padding:12px;border-radius:6px">When you are ready, forward the room URL to the tenant. Do NOT auto-share — manual approval each time.</p>' +
    '<p>Ref ID: <code>' + payload.reqId + '</code></p>' +
    '</div>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
        to: [to],
        subject: '[ARIA screen-share] ' + payload.urgency.toUpperCase() + ' — ' + payload.email,
        html
      })
    });
  } catch (e) { console.warn('[screenshare] admin mail failed:', e.message); }
}
