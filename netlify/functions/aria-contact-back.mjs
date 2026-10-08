// aria-contact-back v0.5 — schedules a reconnect, emails user the ARIA link + .ics
// POST /.netlify/functions/aria-contact-back
//
// 2026-10-08 (audit top-10 #9d): v0.4 could only send through Gmail SMTP and answered `202 {ok:true,
// queued:true}` when SMTP_APP_PASSWORD was missing — nothing was queued. The booking is still persisted
// first; mail now goes through lib/notify.mjs (Resend first, SMTP fallback; the .ics is attached on both)
// and the response is honest: ok:false + scheduled:true + emailSent:false when no provider confirmed.
// Also: invalid date/time → 400 (was an unhandled 500); blob key uses the hashed email; date/time escaped.

import { getStore } from '@netlify/blobs';
import { sendEmail, hashIdentity, sanitizeEmailHtml } from './lib/notify.mjs';
import contacts from './lib/contacts.cjs';

const SESSION_ID_RE = /^[A-Za-z0-9_.@-]{1,120}$/;

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) {
    return jsonResp(400, cors, { error: 'date must be YYYY-MM-DD and time HH:MM' });
  }

  let userObj = user;
  if (!userObj && sessionId && SESSION_ID_RE.test(String(sessionId))) {
    try {
      const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
      const meta = await sessions.get(`${sessionId}/meta.json`, { type: 'json' });
      if (meta) userObj = meta.user;
    } catch {}
  }
  if (!userObj || !userObj.email) return jsonResp(400, cors, { error: 'user email required' });

  // build ISO timestamp (assume user-local time as submitted)
  const startMs = new Date(`${date}T${time}:00`).getTime();
  if (!Number.isFinite(startMs)) return jsonResp(400, cors, { error: 'invalid date/time' });
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(startMs + 30 * 60 * 1000).toISOString();

  // reconnect link — includes a hint param so /aria opens contextually
  const reconnect = `https://iisupp.net/aria?reconnect=1&u=${encodeURIComponent(userObj.email)}`;

  // persist booking FIRST (for admin visibility) — the email is a courtesy, the booking is the record
  let stored = false;
  try {
    const bookings = getStore({ name: 'aria-bookings', consistency: 'strong' });
    await bookings.setJSON(`${Date.now()}_${hashIdentity(userObj.email)}.json`, {
      sessionId: sessionId && SESSION_ID_RE.test(String(sessionId)) ? sessionId : null, date, time, user: userObj, createdAt: Date.now()
    });
    stored = true;
  } catch (e) { console.error('[aria-contact-back] booking NOT stored:', e.message); }

  const senderEmail = process.env.SMTP_SENDER || contacts.SUPPORT_EMAIL;
  const adminEmail = contacts.SUPPORT_EMAIL;

  const ics = buildIcs({
    startISO, endISO,
    summary: `ARIA Reconnect — ${userObj.firstName || ''} ${userObj.lastName || ''}`.trim(),
    description: `User scheduled a reconnect with ARIA.\n\nReconnect link: ${reconnect}\nEmail: ${userObj.email}\nPhone: ${userObj.phone || '(none)'}\nCompany: ${userObj.company || '(none)'}`,
    organizer: senderEmail,
    attendees: [userObj.email, adminEmail]
  });

  const subject = `Your ARIA reconnect — ${date} at ${time}`;
  const html = renderUserCallbackEmail({ user: userObj, date, time, reconnect });
  const text = `Hi ${userObj.firstName || ''}, your ARIA reconnect is scheduled for ${date} at ${time}.\n\nLink: ${reconnect}\n\n— Integrated IT Support Inc.`;
  const r = await sendEmail({ to: userObj.email, bcc: [adminEmail], subject, html, text, tag: 'contact-back', icalEvent: { filename: 'aria-reconnect.ics', method: 'REQUEST', content: ics } });

  if (r.ok) return jsonResp(200, cors, { ok: true, scheduled: true, stored, emailSent: true, reconnect, via: r.provider });
  console.error('[aria-contact-back] confirmation NOT delivered', JSON.stringify({ error: r.error, attempts: r.attempts }));
  return jsonResp(r.dormant ? 202 : 502, cors, {
    ok: false, scheduled: stored, stored, emailSent: false, queued: false, reconnect,
    reason: r.dormant ? 'no email provider configured (set RESEND_API_KEY + RESEND_FROM)' : 'email delivery failed',
    note: stored
      ? `Your reconnect for ${date} at ${time} is booked on our side, but the confirmation email could not be sent. Keep this link: ${reconnect}`
      : `We could not record the booking or send a confirmation. Please call ${contacts.SUPPORT_PHONE}.`
  });
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
    <p style="font-size:13.5px;line-height:1.7;color:#d8e0e6;margin:0 0 18px 0;">Your reconnect with ARIA is scheduled for <strong style="color:#2dd4bf;">${escapeHtml(date)} at ${escapeHtml(time)}</strong>. We’ve added it to our calendar and attached a calendar invite so you can add it to yours.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${escapeHtml(reconnect)}" style="display:inline-block;padding:14px 28px;background:#2dd4bf;color:#050810;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;font-weight:700;">Open ARIA at that time</a>
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
