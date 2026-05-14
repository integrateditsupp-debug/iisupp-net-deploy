// aria-session-end — V2 ESM function (auto-wires Netlify Blobs)
// POST /.netlify/functions/aria-session-end

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

  const { sessionId, status, summary, userIssue } = body;
  if (!sessionId || !['resolved', 'escalated'].includes(status)) {
    return jsonResp(400, cors, { error: 'sessionId + status (resolved|escalated) required' });
  }

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
  const meta = await sessions.get(`${sessionId}/meta.json`, { type: 'json' });
  if (!meta) return jsonResp(404, cors, { error: 'session not found' });
  const eventsRaw = (await sessions.get(`${sessionId}/events.jsonl`, { type: 'text' })) || '';
  const events = eventsRaw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  meta.status = status;
  meta.endedAt = Date.now();
  meta.summary = summary || meta.summary || null;
  meta.userIssue = userIssue || meta.userIssue || extractUserIssue(events);
  await sessions.setJSON(`${sessionId}/meta.json`, meta);

  await sessions.set(`${sessionId}/events.jsonl`,
    eventsRaw + JSON.stringify({ type: status, ts: Date.now(), payload: { summary, userIssue } }) + '\n');

  const subject = `Ticket ${meta.ticket}`;
  const userEmail = meta.user.email;
  const internalEmail = 'integrateditsupp@iisupp.net';
  const html = renderReport(meta, events);

  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'ahmad.wasee@iisupp.net';

  if (!smtpPass) {
    console.log('[aria-session-end] SMTP not configured; report logged. Ticket:', meta.ticket, 'to:', userEmail);
    return jsonResp(202, cors, {
      ok: true, ticket: meta.ticket, emailSent: false, queued: true,
      reason: 'SMTP_APP_PASSWORD env var not set'
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: senderEmail, pass: smtpPass }
    });
    await transporter.sendMail({
      from: `"Integrated IT Support" <${senderEmail}>`,
      to: userEmail,
      cc: internalEmail,
      subject,
      html,
      text: textVersion(meta)
    });
    return jsonResp(200, cors, { ok: true, ticket: meta.ticket, emailSent: true, to: userEmail });
  } catch (e) {
    console.error('[aria-session-end] email send failed:', e.message);
    return jsonResp(500, cors, { ok: false, ticket: meta.ticket, emailSent: false, error: e.message });
  }
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

function extractUserIssue(events) {
  const firstUserMsg = events.find(e => e.type === 'message_user');
  return firstUserMsg ? (firstUserMsg.payload && firstUserMsg.payload.text) : null;
}

function textVersion(meta) {
  return `Thank you for contacting Integrated IT Support Inc. via ARIA - AI.

Your issue: ${meta.userIssue || '(see web report)'}
Status: ${meta.status === 'resolved' ? 'Resolved' : 'Escalated'}
Your reference number is ${meta.ticket}.

${meta.status === 'escalated' ? 'If escalated, we will be with you shortly. Someone will call you at the number you provided.' : 'If anything resurfaces, reply to this email and reference your ticket number.'}

— Integrated IT Support Inc.
(647) 581-3182 · iisupp.net`;
}

function renderReport(meta, events) {
  const messages = events.filter(e => e.type === 'message_user' || e.type === 'message_aria');
  const convHtml = messages.map(m => {
    const isUser = m.type === 'message_user';
    const role = isUser ? 'USER' : 'ARIA';
    const text = escapeHtml((m.payload && m.payload.text) || '');
    return `<tr><td style="padding:10px 0;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:${isUser ? '#98a8b3' : '#2dd4bf'};text-transform:uppercase;margin-bottom:4px;">${role}</div>
      <div style="padding:12px 14px;background:${isUser ? '#0d1824' : '#0a1219'};border:1px solid ${isUser ? '#243a47' : '#2dd4bf33'};color:#d8e0e6;font-size:13px;line-height:1.55;">${text}</div>
    </td></tr>`;
  }).join('');

  const derived = meta.derived || {};
  const layers = derived.layers || [];
  const layersHtml = layers.slice(0, 8).map(([n, p]) =>
    `<tr><td style="padding:3px 16px 3px 0;color:#d8e0e6;font-family:'JetBrains Mono',monospace;font-size:11px;width:140px;">${n}</td>
     <td style="padding:3px 12px 3px 0;width:200px;">
       <div style="background:#0a1219;height:6px;border:1px solid #243a47;">
         <div style="background:#2dd4bf;height:100%;width:${Math.min(100, p * 2.5)}%;"></div>
       </div>
     </td>
     <td style="padding:3px 0;color:#2dd4bf;font-family:'JetBrains Mono',monospace;font-size:11px;text-align:right;">${p}%</td></tr>`
  ).join('');

  const cls = meta.classification || {};
  const statusColor = meta.status === 'resolved' ? '#4ade80' : '#fbbf24';
  const statusLabel = meta.status === 'resolved' ? 'RESOLVED' : 'ESCALATED';
  const durationSec = meta.endedAt && meta.startedAt ? Math.round((meta.endedAt - meta.startedAt) / 1000) : 0;

  return `<!DOCTYPE html>
<html><body style="margin:0;background:#050810;color:#d8e0e6;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#050810;">
  <tr><td style="padding-bottom:18px;border-bottom:1px solid #1a2b35;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#2dd4bf;">APERTURE · SESSION REPORT</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#d8e0e6;margin-top:6px;letter-spacing:0.05em;">${meta.ticket}</div>
  </td></tr>
  <tr><td style="padding:22px 0 0 0;">
    <p style="font-size:14px;color:#d8e0e6;margin:0 0 16px 0;">Thank you for contacting Integrated IT Support Inc. via ARIA — AI.</p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 8px 0;"><strong style="color:#98a8b3;">Your issue:</strong> ${escapeHtml(meta.userIssue || '(see transcript below)')}</p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 8px 0;"><strong style="color:#98a8b3;">Status:</strong> <span style="color:${statusColor};font-weight:600;">${statusLabel}</span></p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 16px 0;"><strong style="color:#98a8b3;">Your reference number:</strong> <span style="color:#2dd4bf;font-family:'JetBrains Mono',monospace;">${meta.ticket}</span></p>
    ${meta.status === 'escalated'
      ? `<p style="padding:14px;background:#1f160a;border:1px solid #fbbf24;color:#fbbf24;font-size:12.5px;margin:0 0 20px 0;">We will be with you shortly. Someone will call you at <span style="color:#d8e0e6;font-family:'JetBrains Mono',monospace;">${escapeHtml(meta.user.phone || '')}</span>.</p>`
      : ''}
  </td></tr>
  <tr><td style="padding:0 0 18px 0;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:10px;">APERTURE METRICS</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;font-family:'JetBrains Mono',monospace;font-size:11px;">
      <tr><td style="padding:5px 0;color:#98a8b3;width:160px;">Category</td><td style="padding:5px 0;color:#2dd4bf;">${(cls.tier || '—')} · ${(cls.difficulty || '—')}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Framework lead</td><td style="padding:5px 0;color:#2dd4bf;">${derived.framework ? (derived.framework.roman + ' ' + derived.framework.name) : '—'}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Resolution time</td><td style="padding:5px 0;color:#2dd4bf;">${durationSec}s</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Messages</td><td style="padding:5px 0;color:#d8e0e6;">${derived.messages || messages.length}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Agents fired</td><td style="padding:5px 0;color:#d8e0e6;">${derived.agentsUnique || '—'} unique · ${derived.agentsTotal || '—'} total</td></tr>
    </table>
  </td></tr>
  ${layersHtml ? `<tr><td style="padding:0 0 18px 0;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:10px;">ARCHITECTURE LAYER USAGE <span style="color:#6b7c87;text-transform:none;letter-spacing:0;">(derived from message signals)</span></div>
    <table cellpadding="0" cellspacing="0">${layersHtml}</table>
  </td></tr>` : ''}
  <tr><td style="padding:6px 0 12px 0;border-top:1px solid #1a2b35;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin:14px 0 8px 0;">CONVERSATION</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${convHtml}</table>
  </td></tr>
  <tr><td style="padding-top:32px;border-top:1px solid #1a2b35;font-size:11px;color:#6b7c87;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">
    INTEGRATED IT SUPPORT INC.  ·  (647) 581-3182  ·  iisupp.net
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
