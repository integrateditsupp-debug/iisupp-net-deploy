// aria-health-lead.mjs — captures a 60-Second IT Health Check lead. $0:
// persists to blobs for admin visibility, emails the owner if SMTP is set,
// otherwise queues (202). Mirrors aria-contact-back's env + email pattern so
// no new secrets/services are introduced. Public, POST-only, CORS-open.
//
// POST /.netlify/functions/aria-health-lead
//   body: { name, email, company?, phone?, score, grade, answers?, risks?, source? }
//   -> { ok, queued? }

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
  if (request.method !== 'POST') return resp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return resp(400, cors, { error: 'invalid JSON' }); }

  const email = String(body.email || '').trim();
  const name = String(body.name || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return resp(400, cors, { error: 'valid email required' });
  }

  const lead = {
    name,
    email,
    company: String(body.company || '').trim() || null,
    phone: String(body.phone || '').trim() || null,
    size: String(body.size || '').trim() || null,
    industry: String(body.industry || '').trim() || null,
    spend: String(body.spend || '').trim() || null,
    score: Number.isFinite(+body.score) ? +body.score : null,
    grade: String(body.grade || '').trim() || null,
    answers: body.answers && typeof body.answers === 'object' ? body.answers : null,
    risks: Array.isArray(body.risks) ? body.risks.slice(0, 6).map(String) : null,
    strengths: Array.isArray(body.strengths) ? body.strengths.slice(0, 8).map(String) : null,
    source: String(body.source || 'health-check').trim(),
    ua: request.headers.get('user-agent') || null,
    createdAt: Date.now()
  };

  // persist for admin visibility (best-effort)
  try {
    const store = getStore({ name: 'aria-leads', consistency: 'strong' });
    await store.setJSON(`health/${lead.createdAt}_${email.replace(/[^a-z0-9]/gi, '_')}.json`, lead);
  } catch {}

  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const senderEmail = process.env.SMTP_SENDER || 'integrateditsupp@iisupp.net';
  const smtpAuthUser = process.env.SMTP_AUTH_USER || 'ahmad.wasee@iisupp.net';
  const adminEmail = 'integrateditsupp@iisupp.net';

  if (!smtpPass) {
    // captured + stored, but no live email — surface success so the UX is unbroken
    return resp(202, cors, { ok: true, queued: true, reason: 'SMTP not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
      auth: { user: smtpAuthUser, pass: smtpPass }
    });

    // 1) owner notification — a new qualified lead with their self-scored risks
    await transporter.sendMail({
      from: `"IIS Health Check" <${senderEmail}>`,
      to: adminEmail,
      subject: `IT Health Check lead — ${lead.company || name || email} · ${lead.size || 'size ?'} · ${lead.industry || 'sector ?'} · ${lead.score ?? '?'}/100 (${lead.grade || '?'})`,
      html: renderAdminEmail(lead),
      text: `New IT Health Check lead\n\nName: ${name}\nEmail: ${email}\nCompany: ${lead.company || '(none)'}\nPhone: ${lead.phone || '(none)'}\n\nSize: ${lead.size || '(not given)'}\nSector: ${lead.industry || '(not given)'}\nSpending now: ${lead.spend || '(not given)'}\nSuggested tier: ${tierHint(lead.size)}\nBudget read: ${budgetRead(lead.spend, lead.size)}\nLead with: ${angleHint(lead.industry)}\n\nScore: ${lead.score}/100 (${lead.grade})\nRisks: ${(lead.risks || []).join('; ') || '(none)'}\nAlready covered: ${(lead.strengths || []).join('; ') || '(none)'}\nSource: ${lead.source}`
    });

    // 2) prospect auto-reply — delivers the "full report" promise, soft review CTA
    await transporter.sendMail({
      from: `"Integrated IT Support" <${senderEmail}>`,
      to: email,
      cc: adminEmail,
      subject: `Your IT Health Check results${lead.grade ? ` — grade ${lead.grade}` : ''}`,
      html: renderProspectEmail(lead),
      text: `Hi ${name || 'there'}, thanks for running the 60-Second IT Health Check.\n\nYour score: ${lead.score}/100 (${lead.grade}).\n\nTop things to look at:\n${(lead.risks || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '— Your basics look solid.'}\n\nWant a senior tech to walk through these with you (no charge, ~20 min)? Just reply to this email or call (647) 581-3182.\n\n— Integrated IT Support Inc.`
    });

    return resp(200, cors, { ok: true, sent: true });
  } catch (e) {
    console.error('[aria-health-lead] send failed:', e.message);
    // lead is already stored; do not lose it on email failure
    return resp(202, cors, { ok: true, queued: true, reason: 'email deferred' });
  }
};

function resp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// Routes a self-reported headcount to the matching published retainer tier so a
// lead arrives already sized. Internal only — never shown to the prospect.
function tierHint(size) {
  switch (size) {
    case '1–10':            return 'Tier 1 · Operational Foundation · $6,000–$10,000/mo';
    case '11–50':           return 'Tier 2 · Business Continuity · $14,000–$24,000/mo';
    case '51–200':          return 'Tier 3 · Enterprise Operations · $30,000–$60,000/mo';
    case 'More than 200':   return 'Tier 3+ · Enterprise Operations · $30,000–$60,000/mo, multi-site scoping';
    default:                return 'Size not given — ask before quoting';
  }
}

// Reads current spend against the tier they'd land in — tells you whether this is a
// budget conversation or a value one before you pick up the phone.
function budgetRead(spend, size) {
  if (!spend || spend === 'Not sure') return 'Budget unknown — qualify on the call';
  const floor = { '1–10': 6000, '11–50': 14000, '51–200': 30000, 'More than 200': 30000 }[size] || null;
  const band = {
    'Nothing — we handle it ourselves': 0,
    'Under $2,000': 1500,
    '$2,000 – $7,500': 4750,
    '$7,500 – $20,000': 13750,
    'More than $20,000': 25000
  }[spend];
  if (band === undefined || floor === null) return `Spending ${spend}`;
  if (band === 0) return 'Spending nothing today — greenfield, expect sticker shock, lead with risk not price';
  if (band >= floor) return `Already at/above tier floor (${spend} vs $${floor.toLocaleString()}/mo) — displacement play, price is not the objection`;
  return `Below tier floor (${spend} vs $${floor.toLocaleString()}/mo) — gap to close, lead with consequence not features`;
}

// The angle to lead with on the follow-up, by sector.
function angleHint(industry) {
  switch (industry) {
    case 'Accounting / bookkeeping': return 'Filing-season downtime multiplier';
    case 'Legal':                    return 'Confidentiality → Law Society / client-notification exposure';
    case 'Healthcare / clinic':      return 'PHIPA accountability incl. EMR vendor boundary';
    case 'Real estate / brokerage':  return 'Deposit-redirect / BEC fraud — email auth, not training';
    default:                         return 'General SMB continuity';
  }
}

function strengthsList(strengths) {
  if (!strengths || !strengths.length) return '<p style="margin:0;color:#9aa3ad;">Nothing scored as fully covered.</p>';
  return `<ul style="margin:0;padding-left:18px;color:#9aa3ad;font-size:13px;line-height:1.7;">${strengths.map(s => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('')}</ul>`;
}

function risksList(risks) {
  if (!risks || !risks.length) return '<p style="margin:0;color:#9aa3ad;">Your basics look solid — no major red flags surfaced.</p>';
  return `<ul style="margin:0;padding-left:18px;color:#d8e0e6;font-size:13.5px;line-height:1.7;">${risks.map(r => `<li style="margin-bottom:8px;">${escapeHtml(r)}</li>`).join('')}</ul>`;
}

function renderAdminEmail(lead) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#050505;color:#e7e3d8;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
  <tr><td style="padding-bottom:16px;border-bottom:1px solid #2a2418;">
    <div style="font-size:11px;letter-spacing:3px;color:#c5a059;font-family:monospace;">NEW IT HEALTH CHECK LEAD</div>
  </td></tr>
  <tr><td style="padding:18px 0;font-size:14px;line-height:1.8;color:#d8e0e6;">
    <strong>${escapeHtml(lead.name || '(no name)')}</strong> &middot; ${escapeHtml(lead.company || 'company not given')}<br>
    <a href="mailto:${escapeHtml(lead.email)}" style="color:#c5a059;">${escapeHtml(lead.email)}</a>${lead.phone ? ` &middot; ${escapeHtml(lead.phone)}` : ''}<br>
    <span style="font-size:22px;color:#f1dca7;font-weight:700;">${lead.score ?? '?'}/100</span> &nbsp;grade <strong>${escapeHtml(lead.grade || '?')}</strong>
  </td></tr>
  <tr><td style="padding:6px 0 14px;">
    <div style="background:#0c0a06;border:1px solid #2a2418;border-left:2px solid #c5a059;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.8;color:#d8e0e6;">
      <div style="font-size:11px;letter-spacing:2px;color:#9aa3ad;margin-bottom:8px;">QUALIFICATION</div>
      <strong>Size:</strong> ${escapeHtml(lead.size || 'not given')}<br>
      <strong>Sector:</strong> ${escapeHtml(lead.industry || 'not given')}<br>
      <strong>Spending now:</strong> ${escapeHtml(lead.spend || 'not given')}<br>
      <strong>Suggested tier:</strong> ${escapeHtml(tierHint(lead.size))}<br>
      <strong>Budget read:</strong> ${escapeHtml(budgetRead(lead.spend, lead.size))}<br>
      <strong>Lead with:</strong> ${escapeHtml(angleHint(lead.industry))}
    </div>
  </td></tr>
  <tr><td style="padding:6px 0 18px;">
    <div style="font-size:11px;letter-spacing:2px;color:#9aa3ad;margin-bottom:8px;">SELF-REPORTED RISKS</div>
    ${risksList(lead.risks)}
  </td></tr>
  <tr><td style="padding:0 0 18px;">
    <div style="font-size:11px;letter-spacing:2px;color:#9aa3ad;margin-bottom:8px;">ALREADY COVERED</div>
    ${strengthsList(lead.strengths)}
  </td></tr>
  <tr><td style="padding-top:16px;border-top:1px solid #2a2418;font-size:11px;color:#6b7c87;font-family:monospace;letter-spacing:2px;">SOURCE: ${escapeHtml(lead.source)}</td></tr>
</table></body></html>`;
}

function renderProspectEmail(lead) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#050505;color:#e7e3d8;font-family:Inter,system-ui,sans-serif;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#050505;">
  <tr><td style="padding-bottom:18px;border-bottom:1px solid #2a2418;text-align:center;">
    <div style="font-family:monospace;font-size:11px;letter-spacing:3px;color:#c5a059;">INTEGRATED IT SUPPORT &middot; IT HEALTH CHECK</div>
  </td></tr>
  <tr><td style="padding:24px 0;text-align:center;">
    <div style="font-size:13px;color:#9aa3ad;letter-spacing:1px;margin-bottom:6px;">YOUR SCORE</div>
    <div style="font-size:54px;font-weight:900;background:linear-gradient(135deg,#c5a059,#f1dca7,#b38728);-webkit-background-clip:text;background-clip:text;color:#f1dca7;line-height:1;">${lead.score ?? '?'}<span style="font-size:22px;color:#9aa3ad;">/100</span></div>
    <div style="font-size:15px;color:#f1dca7;letter-spacing:2px;margin-top:8px;">GRADE ${escapeHtml(lead.grade || '?')}</div>
  </td></tr>
  <tr><td style="padding:0 0 8px;">
    <p style="font-size:14px;color:#d8e0e6;margin:0 0 14px;">Hi ${escapeHtml(lead.name || 'there')}, thanks for running the check. Here are the things worth a closer look:</p>
    <div style="background:#0c0a06;border:1px solid #2a2418;border-radius:10px;padding:18px;">${risksList(lead.risks)}</div>
  </td></tr>
  ${lead.strengths && lead.strengths.length ? `<tr><td style="padding:16px 0 0;">
    <p style="font-size:13px;color:#9aa3ad;margin:0 0 10px;">And to be fair about it — here's what you already have covered:</p>
    <div style="background:#0a0805;border:1px solid #1c180f;border-radius:10px;padding:16px 18px;">${strengthsList(lead.strengths)}</div>
  </td></tr>` : ''}
  <tr><td style="padding:24px 0;text-align:center;">
    <p style="font-size:13.5px;color:#d8e0e6;line-height:1.7;margin:0 0 18px;">Want a senior tech to walk through these with you? It's a free ~20-minute review — no pitch, no obligation.</p>
    <a href="mailto:integrateditsupp@iisupp.net?subject=Free%20IT%20review%20after%20my%20Health%20Check" style="display:inline-block;padding:14px 30px;background:linear-gradient(135deg,#c5a059,#f1dca7,#b38728);color:#050505;font-family:monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;font-weight:700;border-radius:6px;">Book my free review</a>
    <p style="font-size:12px;color:#9aa3ad;margin:18px 0 0;">or call <strong style="color:#e7e3d8;">(647) 581-3182</strong></p>
  </td></tr>
  <tr><td style="padding-top:28px;border-top:1px solid #2a2418;font-size:11px;color:#6b7c87;text-align:center;font-family:monospace;letter-spacing:2px;">INTEGRATED IT SUPPORT INC.</td></tr>
</table></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
