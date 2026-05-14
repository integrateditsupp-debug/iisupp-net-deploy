// aria-contact-back v0.4 — schedules a reconnect, emails user the ARIA link + .ics
// POST /.netlify/functions/aria-contact-back

import { getStore } from '@netlify/blobs';
import nodemailer from 'nodemailer';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const { sessionId, date, time, user } = body;
  if (!date || !time) return jsonResp(400, cors, { error: 'date + time required' });

  let userObj = user;
  if (!userObj && sessionId) {
    try {
      const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
      const meta = await sessions.get(`${sessionId}/meta.json`, { type: 'json' });
      if (meta) userObj = meta.user;
    } catch {}
  }
  if (!userObj || !userObj.email) return jsonResp(400, cors, { error: 'user email required' });

  // build ISO timestamp (assume user-local time as submitted)
  const startISO = new Date(`${date}T${time}:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + 30 * 60 * 1000).toISOString();

  // reconnect link — includes a hint param so /aria opens contextually
  const reconnect = `https://iisupp.net/aria?reconnect=1&u=${encodeURIComponent(userObj.email)}`;

  // persist booking (for admin visibility)
  try {
    const bookings = getStore({ name: 'aria-bookings', consistency: 'strong' });
    await bookings.setJSON(`${Date.now()}_${userObj.email}.json`, {
      sessionId, date, time, user: userObj, createdAt: Date.now()
    });
  } catch {}

  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'integrateditsupp@iisupp.net';
  const smtpAuthUser = process.env.SMTP_AUTH_USER || 'ahmad.wasee@iisupp.net';
  const adminEmail = 'integrateditsupp@iisupp.net';

  if (!smtpPass) {
    return jsonResp(202, cors, { ok: true, queued: true, reason: 'SMTP not configured' });
  }

  const ics = buildIcs({
    startISO, endISO,
    summary: `ARIA Reconnect — ${userObj.firstName || ''} ${userObj.lastName || ''}`.trim(),
    description: `User scheduled a reconnect with ARIA.\n\nReconnect link: ${reconnect}\nEmail: ${userObj.email}\nPhone: ${userObj.phone || '(none)'}\nCompany: ${userObj.company || '(none)'}`,
    organizer: senderEmail,
    attendees: [userObj.email, adminEmail]
  });

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: smtpAuthUser, pass: smtpPass }
    });

    // user email
    await transporter.sendMail({
      from: `"Integrated IT Support" <${senderEmail}>`,
      to: userObj.email,
      cc: adminEmail,
      subject: `Your ARIA reconnect — ${date} at ${time}`,
      html: renderUserCallbackEmail({ user: userObj, date, time, reconnect }),
      text: `Hi ${userObj.firstName || ''}, your ARIA reconnect is scheduled for ${date} at ${time}.\n\nLink: ${reconnect}\n\n— Integrated IT Support Inc.`,
      icalEvent: {
        filename: 'aria-reconnect.ics',
        method: 'REQUEST',
        content: ics
      }
    });

    return jsonResp(200, cors, { ok: true, scheduled: true, reconnect });
  } catch (e) {
    console.error('[aria-contact-back] send failed:', e.message);
    return jsonResp(500, cors, { ok: false, error: e.message });
  }
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

function buildIcs({ startISO, endISO, summary, description, organizer, attendees }) {
  const fmt = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dtstart = fmt(startISO);
  const dtend = fmt(endISO);
  const uid = `${Date.now()}@iisupp.net`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Integrated IT Support//ARIA//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
    `ORGANIZER:mailto:${organizer}`,
    ...(attendees || []).map(a => `ATTENDEE;CUTYPE=INDIVIDUAL;RSVP=TRUE:mailto:${a}`),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

function renderUserCallbackEmail({ user, date, time, reconnect }) {
  const company = user.company ? `<div style="font-family:'Inter',sans-serif;font-size:18px;color:#d8e0e6;margin-top:10px;font-weight:600;letter-spacing:0.02em;">${escapeHtml(user.company)}</div>` : '';
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#050810;color:#d8e0e6;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#050810;">
  <tr><td style="padding-bottom:18px;border-bottom:1px solid #1a2b35;text-align:center;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#2dd4bf;">ARIA - RECONNECT SCHEDULED</div>
    ${company}
  </td></tr>
  <tr><td style="padding:22px 0;">
    <p style="font-size:14px;color:#d8e0e6;margin:0 0 18px 0;">Hi ${escapeHtml(user.firstName || '')},</p>
    <p style="font-size:13.5px;line-height:1.7;color:#d8e0e6;margin:0 0 18px 0;">Your reconnect with ARIA is scheduled for <strong style="color:#2dd4bf;">${date} at ${time}</strong>. We’ve added it to our calendar and attached a calendar invite so you can add it to yours.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${reconnect}" style="display:inline-block;padding:14px 28px;background:#2dd4bf;color:#050810;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;font-weight:700;">Open ARIA at that time</a>
    </p>
    <p style="font-size:12px;color:#98a8b3;line-height:1.6;margin:24px 0 0 0;">Need to reach us sooner? Call <strong style="color:#d8e0e6;">(647) 581-3182</strong>.</p>
  </td></tr>
  <tr><td style="padding-top:32px;border-top:1px solid #1a2b35;font-size:11px;color:#6b7c87;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">
    INTEGRATED IT SUPPORT INC.
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
