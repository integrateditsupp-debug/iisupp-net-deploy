// aria-session-end v0.4 — split user/admin email + smtp.gmail.com + company name at top
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

  const { sessionId, status, summary, userIssue, closureReason } = body;
  if (!sessionId || !['resolved', 'escalated', 'timeout', 'user_ended'].includes(status)) {
    return jsonResp(400, cors, { error: 'sessionId + valid status required' });
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
  meta.closureReason = closureReason || null;
  await sessions.setJSON(`${sessionId}/meta.json`, meta);

  await sessions.set(`${sessionId}/events.jsonl`,
    eventsRaw + JSON.stringify({ type: status, ts: Date.now(), payload: { summary, userIssue, closureReason } }) + '\n');

  const subject = `Ticket ${meta.ticket}`;
  const adminSubject = `[ADMIN] Ticket ${meta.ticket} · ${(meta.user && meta.user.company) || 'unknown company'} · ${status}`;
  const userEmail = meta.user.email;
  const adminEmail = 'integrateditsupp@iisupp.net';
  const userHtml = renderUserReport(meta, events);
  const adminHtml = renderAdminReport(meta, events);

  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'integrateditsupp@iisupp.net';
  const smtpAuthUser = process.env.SMTP_AUTH_USER || 'ahmad.wasee@iisupp.net';

  if (!smtpPass) {
    console.log('[aria-session-end] SMTP not configured. Ticket:', meta.ticket, 'to:', userEmail);
    return jsonResp(202, cors, {
      ok: true, ticket: meta.ticket, emailSent: false, queued: true,
      reason: 'SMTP_APP_PASSWORD env var not set'
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: smtpAuthUser, pass: smtpPass }
    });

    // user-safe email
    await transporter.sendMail({
      from: `"Integrated IT Support" <${senderEmail}>`,
      to: userEmail,
      subject,
      html: userHtml,
      text: textVersion(meta)
    });

    // admin email (includes admin-only section)
    await transporter.sendMail({
      from: `"ARIA Admin" <${senderEmail}>`,
      to: adminEmail,
      subject: adminSubject,
      html: adminHtml,
      text: 'See HTML version for full admin report.'
    });

    return jsonResp(200, cors, { ok: true, ticket: meta.ticket, emailSent: true, to: userEmail, admin: adminEmail });
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
  const statusLabel = meta.status === 'resolved' ? 'Resolved'
                    : meta.status === 'escalated' ? 'Escalated'
                    : meta.status === 'timeout' ? 'Closed (no response)'
                    : 'Closed by user';
  return `Thank you for contacting Integrated IT Support Inc. via ARIA - AI.

Your issue: ${meta.userIssue || '(see web report)'}
Status: ${statusLabel}
Your reference number is ${meta.ticket}.

${meta.status === 'escalated' ? 'A technician will call you shortly at the number you provided.' : ''}
${meta.status === 'timeout' ? 'The chat timed out because no response was received. Re-engage with ARIA at iisupp.net/aria when ready.' : ''}

- Integrated IT Support Inc.
(647) 581-3182 - iisupp.net`;
}

// ============= USER-SAFE REPORT =============
function renderUserReport(meta, events) {
  const messages = events.filter(e => e.type === 'message_user' || e.type === 'message_aria');
  const convHtml = messages.map(m => {
    const isUser = m.type === 'message_user';
    const role = isUser ? 'YOU' : 'ARIA';
    const text = escapeHtml((m.payload && m.payload.text) || '');
    return `<tr><td style="padding:10px 0;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:${isUser ? '#98a8b3' : '#2dd4bf'};text-transform:uppercase;margin-bottom:4px;">${role}</div>
      <div style="padding:12px 14px;background:${isUser ? '#0d1824' : '#0a1219'};border:1px solid ${isUser ? '#243a47' : '#2dd4bf33'};color:#d8e0e6;font-size:13px;line-height:1.55;">${text}</div>
    </td></tr>`;
  }).join('');

  const statusInfo = statusBlock(meta);
  const company = (meta.user && meta.user.company) ? escapeHtml(meta.user.company) : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;background:#050810;color:#d8e0e6;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#050810;">
  <tr><td style="padding-bottom:18px;border-bottom:1px solid #1a2b35;text-align:center;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#2dd4bf;">APERTURE - SESSION REPORT</div>
    ${company ? `<div style="font-family:'Inter',sans-serif;font-size:18px;color:#d8e0e6;margin-top:10px;font-weight:600;letter-spacing:0.02em;">${company}</div>` : ''}
    <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#98a8b3;margin-top:6px;letter-spacing:0.05em;">${meta.ticket}</div>
  </td></tr>
  <tr><td style="padding:22px 0 0 0;">
    <p style="font-size:14px;color:#d8e0e6;margin:0 0 16px 0;">Thank you for contacting Integrated IT Support Inc. via ARIA - AI.</p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 8px 0;"><strong style="color:#98a8b3;">Your issue:</strong> ${escapeHtml(meta.userIssue || '(see transcript below)')}</p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 8px 0;"><strong style="color:#98a8b3;">Status:</strong> <span style="color:${statusInfo.color};font-weight:600;">${statusInfo.label}</span></p>
    <p style="font-size:13px;color:#d8e0e6;margin:0 0 16px 0;"><strong style="color:#98a8b3;">Your reference number:</strong> <span style="color:#2dd4bf;font-family:'JetBrains Mono',monospace;">${meta.ticket}</span></p>
    ${statusInfo.notice}
  </td></tr>
  <tr><td style="padding:6px 0 12px 0;border-top:1px solid #1a2b35;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin:14px 0 8px 0;">CONVERSATION</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${convHtml}</table>
  </td></tr>
  <tr><td style="padding-top:32px;border-top:1px solid #1a2b35;font-size:11px;color:#6b7c87;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">
    INTEGRATED IT SUPPORT INC.  -  (647) 581-3182  -  iisupp.net
  </td></tr>
</table>
</body></html>`;
}

// ============= ADMIN REPORT (full details + admin-only section) =============
function renderAdminReport(meta, events) {
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
  const statusInfo = statusBlock(meta);
  const durationSec = meta.endedAt && meta.startedAt ? Math.round((meta.endedAt - meta.startedAt) / 1000) : 0;
  const company = (meta.user && meta.user.company) ? escapeHtml(meta.user.company) : '(no company)';

  // ===== ADMIN-ONLY: stub metrics until real telemetry lands =====
  const reconMemPct = stubReconstructiveMemoryPct(messages.length, durationSec);
  const growthDelta = stubGrowthDelta();
  const kbChanges = stubKbChanges(messages);
  const ariaLearnings = stubAriaLearnings(messages);
  const alternativeIdeas = stubAlternativeIdeas(messages);

  return `<!DOCTYPE html>
<html><body style="margin:0;background:#050810;color:#d8e0e6;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#050810;">
  <tr><td style="padding-bottom:18px;border-bottom:1px solid #1a2b35;text-align:center;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#fbbf24;">APERTURE - ADMIN SESSION REPORT</div>
    <div style="font-family:'Inter',sans-serif;font-size:18px;color:#d8e0e6;margin-top:10px;font-weight:600;letter-spacing:0.02em;">${company}</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#98a8b3;margin-top:6px;letter-spacing:0.05em;">${meta.ticket}</div>
  </td></tr>

  <!-- Contact + status -->
  <tr><td style="padding:22px 0 16px 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;font-size:12.5px;">
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;width:130px;">User</td><td style="padding:3px 0;color:#d8e0e6;">${escapeHtml((meta.user && meta.user.firstName) || '')} ${escapeHtml((meta.user && meta.user.lastName) || '')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Email</td><td style="padding:3px 0;color:#d8e0e6;">${escapeHtml((meta.user && meta.user.email) || '')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Phone</td><td style="padding:3px 0;color:#d8e0e6;">${escapeHtml((meta.user && meta.user.phone) || '')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Company</td><td style="padding:3px 0;color:#d8e0e6;">${company}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Status</td><td style="padding:3px 0;color:${statusInfo.color};font-weight:600;">${statusInfo.label}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Closure</td><td style="padding:3px 0;color:#d8e0e6;">${escapeHtml(meta.closureReason || '(see status)')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#98a8b3;">Issue</td><td style="padding:3px 0;color:#d8e0e6;">${escapeHtml(meta.userIssue || '(see transcript)')}</td></tr>
    </table>
  </td></tr>

  <!-- Aperture metrics -->
  <tr><td style="padding:0 0 18px 0;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:10px;">APERTURE METRICS</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;font-family:'JetBrains Mono',monospace;font-size:11px;">
      <tr><td style="padding:5px 0;color:#98a8b3;width:200px;">Category</td><td style="padding:5px 0;color:#2dd4bf;">${(cls.tier || '-')} - ${(cls.difficulty || '-')}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Framework lead</td><td style="padding:5px 0;color:#2dd4bf;">${derived.framework ? (derived.framework.roman + ' ' + derived.framework.name) : '-'}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Resolution time</td><td style="padding:5px 0;color:#2dd4bf;">${durationSec}s</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Messages</td><td style="padding:5px 0;color:#d8e0e6;">${derived.messages || messages.length}</td></tr>
      <tr><td style="padding:5px 0;color:#98a8b3;">Agents fired</td><td style="padding:5px 0;color:#d8e0e6;">${derived.agentsUnique || '-'} unique - ${derived.agentsTotal || '-'} total</td></tr>
    </table>
  </td></tr>

  ${layersHtml ? `<tr><td style="padding:0 0 18px 0;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin-bottom:10px;">ARCHITECTURE LAYER USAGE</div>
    <table cellpadding="0" cellspacing="0">${layersHtml}</table>
  </td></tr>` : ''}

  <!-- ============== ADMIN-ONLY SECTION ============== -->
  <tr><td style="padding:18px 16px;background:#1a1208;border:1px solid #fbbf24;margin:18px 0;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:14px;">ADMIN-ONLY -  ARIA INTERNAL STATE</div>

    <div style="margin-bottom:14px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">Reconstructive memory usage</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:18px;color:#2dd4bf;font-weight:600;">${reconMemPct}%</div>
      <div style="font-size:11px;color:#98a8b3;margin-top:4px;font-style:italic;">stub value - replace with real AROC telemetry in v0.5</div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">ARIA growth (since last 7d)</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#d8e0e6;">${growthDelta}</div>
      <div style="font-size:11px;color:#98a8b3;margin-top:4px;font-style:italic;">stub value - replace with real growth diff in v0.5</div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">KB articles touched / updated</div>
      <div style="font-size:12.5px;color:#d8e0e6;line-height:1.6;">${kbChanges}</div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">What ARIA learned this chat</div>
      <div style="font-size:12.5px;color:#d8e0e6;line-height:1.6;">${ariaLearnings}</div>
    </div>

    <div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">Alternative reasoning paths considered</div>
      <div style="font-size:12.5px;color:#d8e0e6;line-height:1.6;">${alternativeIdeas}</div>
    </div>
  </td></tr>

  <!-- transcript -->
  <tr><td style="padding:18px 0 12px 0;border-top:1px solid #1a2b35;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;color:#6b7c87;text-transform:uppercase;margin:14px 0 8px 0;">FULL CONVERSATION</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${convHtml}</table>
  </td></tr>

  <tr><td style="padding-top:32px;border-top:1px solid #1a2b35;font-size:11px;color:#6b7c87;text-align:center;font-family:'JetBrains Mono',monospace;letter-spacing:2px;">
    INTEGRATED IT SUPPORT INC. - ADMIN VIEW - DO NOT FORWARD
  </td></tr>
</table>
</body></html>`;
}

function statusBlock(meta) {
  if (meta.status === 'resolved') {
    return { label: 'RESOLVED', color: '#4ade80', notice: '' };
  }
  if (meta.status === 'escalated') {
    return {
      label: 'ESCALATED',
      color: '#fbbf24',
      notice: `<p style="padding:14px;background:#1f160a;border:1px solid #fbbf24;color:#fbbf24;font-size:12.5px;margin:0 0 20px 0;">A technician will call you shortly at <span style="color:#d8e0e6;font-family:'JetBrains Mono',monospace;">${escapeHtml((meta.user && meta.user.phone) || '')}</span>.</p>`
    };
  }
  if (meta.status === 'timeout') {
    return {
      label: 'CLOSED -  NO RESPONSE',
      color: '#f87171',
      notice: `<p style="padding:14px;background:#1a0d0d;border:1px solid #f87171;color:#f87171;font-size:12.5px;margin:0 0 20px 0;">The chat timed out because no response was received. Re-engage with ARIA at <a href="https://iisupp.net/aria" style="color:#2dd4bf;">iisupp.net/aria</a> when ready.</p>`
    };
  }
  return { label: 'CLOSED BY USER', color: '#98a8b3', notice: '' };
}

// ===== stub functions (replace with real telemetry in v0.5) =====
function stubReconstructiveMemoryPct(msgs, dur) {
  // mock formula: 50 + (msg count * 3) + (duration / 10), capped at 95
  return Math.min(95, Math.max(40, Math.round(50 + msgs * 3 + dur / 10)));
}
// stubs follow AROC-pattern-first-extension.md §4 — compressed operational state, not sentences.
function stubGrowthDelta() {
  return '<code style="color:#2dd4bf;font-family:JetBrains Mono,monospace;">kb.idx=+12 intent.acc=+3.4% resp.t=-0.8s growth.7d=+5.2%</code>';
}
function stubKbChanges(messages) {
  if (messages.length < 4) return '<code style="color:#98a8b3;font-family:JetBrains Mono,monospace;">kb.delta=0 reason=cached_pattern_match</code>';
  return '<code style="color:#98a8b3;font-family:JetBrains Mono,monospace;">kb.delta=0 reason=symbolic_state_reused (real diff in v0.5)</code>';
}
function stubAriaLearnings(messages) {
  const userMsgs = messages.filter(m => m.type === 'message_user').length;
  if (userMsgs < 2) return '<code style="color:#98a8b3;font-family:JetBrains Mono,monospace;">learn.novelty=0 reason=insufficient_turns</code>';
  return '<code style="color:#98a8b3;font-family:JetBrains Mono,monospace;">learn.pattern_reinforced=true edge_cases=0 (real extraction in v0.5)</code>';
}
function stubAlternativeIdeas(messages) {
  return '<code style="color:#98a8b3;font-family:JetBrains Mono,monospace;">paths.considered=3 selected.conf=0.87 (real branching log in v0.5)</code>';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
