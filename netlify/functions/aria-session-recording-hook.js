/**
 * aria-session-recording-hook — Whereby webhook receiver for session events
 *  POST { type, data } (Whereby webhook payload)
 *  - room.session.ended → log + extract recording URL → notify Ahmad
 *  - room.client.joined → log participant event
 *  Cat 20 — Live remote support audit trail.
 */
const crypto = require('crypto');

function verifyWherebySig(payload, header, secret) {
  if (!header || !secret) return true; // skip if not configured
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const sig = event.headers['whereby-signature'] || event.headers['Whereby-Signature'];
  if (process.env.WHEREBY_WEBHOOK_SECRET && !verifyWherebySig(event.body, sig, process.env.WHEREBY_WEBHOOK_SECRET)) {
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
