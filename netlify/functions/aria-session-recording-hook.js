/**
 * aria-session-recording-hook — Whereby webhook receiver for session events
 *  POST { type, data } (Whereby webhook payload)
 *  - room.session.ended → log + extract recording URL → notify Ahmad
 *  - room.client.joined → log participant event
 *  Cat 20 — Live remote support audit trail.
 */
const crypto = require('crypto');

function verifyWherebySig(payload, header, secret) {
  if (!header || !secret) return false; // fail-closed (audit §7: used to return true when unconfigured)
  // Whereby signs as "t=<unix>,v1=<hex>" over "<t>.<body>"; a bare hex over the body is also accepted.
  const h = String(header);
  let expected, provided;
  const m = h.match(/t=(\d+),\s*v1=([0-9a-f]+)/i);
  if (m) {
    expected = crypto.createHmac('sha256', secret).update(m[1] + '.' + payload).digest('hex');
    provided = m[2];
  } else {
    expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    provided = h.trim();
  }
  const a = Buffer.from(expected), b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const sig = event.headers['whereby-signature'] || event.headers['Whereby-Signature'];
  if (!process.env.WHEREBY_WEBHOOK_SECRET) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'not-configured', hint: 'set WHEREBY_WEBHOOK_SECRET' }) };
  }
  if (!verifyWherebySig(event.body, sig, process.env.WHEREBY_WEBHOOK_SECRET)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'invalid signature' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const type = body.type || '';
  const data = body.data || {};

  let store;
  try { ({ getStore } = require('@netlify/blobs')); store = require('@netlify/blobs').getStore({ name: 'aria-session-events', consistency: 'eventual' }); }
  catch {}

  if (store) {
    try {
      await store.setJSON('event-' + Date.now() + '-' + (data.meetingId || 'na'), { type, data, received: Date.now() });
    } catch {}
  }

  if (type === 'room.session.ended' && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
          to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
          subject: '[IIS] Whereby session ended: ' + (data.meetingId || 'unknown'),
          html: '<p>Whereby session ended. Recording URL (if enabled): ' + (data.recordingUrl || '(none)') + '</p><pre>' + JSON.stringify(data, null, 2) + '</pre>'
        })
      });
    } catch {}
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, logged: type }) };
};
