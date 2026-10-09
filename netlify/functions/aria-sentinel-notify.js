/**
 * aria-sentinel-notify — RUN-CU / CU4 (2026-10-08). The desktop agent's one notification endpoint.
 *
 *   POST { v:'sentinel-notify-v1', event, title, recipeId, severity, platform, outcome, approvalId, expiresAt,
 *          summary, ts, subject, text, sms, channels:{email,sms}, recipients:[{role,name,email,phone}], device }
 *   headers: x-sentinel-key = sha256(licenseKey)   (or an internal/admin token — lib/admin-gate.cjs, fail-closed)
 *
 *   → { ok, event, email:{attempted,sent,dormant,error}, sms:{attempted,sent,dormant,error},
 *       approval:{id, approveUrl, denyUrl, expiresAt} | null, log:{key} }
 *
 * What it refuses (and says so): an unknown/revoked device key (401), a body over 24 KB (413), more than
 * 30 posts per 10 minutes per device (429), an unknown event / malformed recipients (400), and ANY text that
 * fails the Sentinel's own content-blind guard — raw paths, URLs, log lines, document text, usernames (422).
 * The guard is the desktop's mustBeTelemetrySafe, imported from the Sentinel tree so both ends share one
 * definition; if it cannot load the endpoint fails CLOSED (503), it never falls back to "probably fine".
 *
 * Rule 14: email/SMS counts come from lib/notify.mjs, which reports ok only on a provider-confirmed id.
 * Twilio unset → sms.dormant:true and sent:0 — the desktop shows "not sent", never "sent".
 * For approval-requested the ask is stored in the 'sentinel-approvals' Blobs store and the email carries
 * HMAC-signed Approve / Deny links that expire with the record (aria-sentinel-approval). No signing secret
 * configured → the record is still stored and the email says "approve in the app"; no unsigned link ever ships.
 */
'use strict';

const { checkRateLimit, rateLimitResponse, hashKey } = require('./_rate-limit.js');
const A = require('./lib/sentinel-approvals.cjs');

const MAX_BODY = 24 * 1024;
const MAX_RECIPIENTS = 8;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_RE = /^\+?[0-9()\-\s.]{7,20}$/;
const ROLE_RE = /^[a-z][a-z-]{1,19}$/;
const BRAND = 'ARIA Sentinel · Integrated IT Support';

function str(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : ''; }

/** Normalize + validate recipients: role/name/email/phone only; anything else is dropped, never guessed. */
function normalizeRecipients(list) {
  if (!Array.isArray(list)) return { ok: false, reason: 'recipients-not-a-list' };
  if (list.length > MAX_RECIPIENTS) return { ok: false, reason: 'too-many-recipients' };
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') return { ok: false, reason: 'bad-recipient' };
    const email = str(r.email, 254);
    const phone = str(r.phone, 24);
    if (email && !EMAIL_RE.test(email)) return { ok: false, reason: 'bad-recipient-email' };
    if (phone && !PHONE_RE.test(phone)) return { ok: false, reason: 'bad-recipient-phone' };
    if (!email && !phone) continue;
    const role = str(r.role, 20).toLowerCase();
    out.push({ role: ROLE_RE.test(role) ? role : 'contact', name: str(r.name, 80).replace(/[^\w .'\-]/g, '') || null, email: email || null, phone: phone || null });
  }
  return { ok: true, recipients: out };
}

/** The branded, content-blind email body. Every interpolated field is escaped; links only when signed. */
function renderEmailHtml({ event, title, severity, platform, text, links, expiresAt }) {
  const e = A.esc;
  const sevColor = { green: '#2e7d32', yellow: '#b26a00', red: '#b71c1c' }[severity] || '#444';
  const heading = { 'issue-detected': 'Issue detected', 'approval-requested': 'Approval needed', 'fix-executed': 'Fix completed', 'fix-failed': 'Needs a person', report: 'Report' }[event] || 'Notification';
  const buttons = links
    ? `<p style="margin:20px 0">
         <a href="${e(links.approveUrl)}" style="display:inline-block;padding:10px 18px;background:#1b5e20;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Approve</a>
         &nbsp;&nbsp;
         <a href="${e(links.denyUrl)}" style="display:inline-block;padding:10px 18px;background:#616161;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Deny</a>
       </p>
       <p style="color:#555;font-size:13px">The links work once and stop working at ${e(String(expiresAt || '').replace('T', ' ').slice(0, 16))} UTC. Nothing runs until someone approves.</p>`
    : (event === 'approval-requested' ? `<p style="color:#555;font-size:13px">Approve or deny in ARIA Sentinel → Control Center → Approvals. Nothing runs until someone approves.</p>` : '');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px;border:1px solid #e3e5e8">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${e(BRAND)}</div>
    <h1 style="font-size:20px;margin:10px 0 4px">${e(heading)}: ${e(title)}</h1>
    <div style="font-size:13px;color:${sevColor};font-weight:600;margin-bottom:14px">${e(severity)} severity${platform ? ' · ' + e(platform) : ''}</div>
    <p style="font-size:15px;line-height:1.5">${e(text)}</p>
    ${buttons}
    <hr style="border:0;border-top:1px solid #e3e5e8;margin:22px 0">
    <p style="font-size:12px;color:#6b7280;line-height:1.5">This message carries the issue name, severity and platform only — never device content, file names, paths or log lines. Reply to this email to reach Integrated IT Support.</p>
  </div></body></html>`;
}

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'POST').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: { 'cache-control': 'no-store' }, body: '' };
  if (method !== 'POST') return A.json(405, { ok: false, error: 'method-not-allowed' });
  if (Buffer.byteLength(String(event.body || ''), 'utf8') > MAX_BODY) return A.json(413, { ok: false, error: 'body-too-large' });

  const auth = await A.authenticate(event);
  if (!auth.ok) return A.json(auth.status || 401, { ok: false, error: auth.error });

  // Rate limit per device (tenant + device hash) — per IP for internal callers.
  const rlKey = hashKey(`sentinel-notify:${auth.kind === 'device' ? auth.tenant : A.clientIp(event)}`);
  const rl = checkRateLimit(event, { scope: 'sentinel-notify', key: rlKey, limit: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl, { 'cache-control': 'no-store' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return A.json(400, { ok: false, error: 'bad-json' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return A.json(400, { ok: false, error: 'bad-json' });
  if (body.v !== 'sentinel-notify-v1') return A.json(400, { ok: false, error: 'unsupported-version' });
  const ev = String(body.event || '');
  if (!A.NOTIFY_EVENTS.includes(ev)) return A.json(400, { ok: false, error: 'unknown-event' });

  const title = str(body.title, 120) || 'An issue on your device';
  const recipeId = A.TOKEN_RE.test(String(body.recipeId || '')) ? String(body.recipeId) : null;
  const severity = A.SEVERITIES.includes(body.severity) ? body.severity : 'yellow';
  const platform = str(body.platform, 16).replace(/[^a-z0-9-]/gi, '') || null;
  const device = A.TOKEN_RE.test(String(body.device || '')) ? String(body.device) : null;
  const subject = str(body.subject, 160) || `ARIA Sentinel: ${title}`;
  const text = str(body.text, 1200) || `${title} (${severity} severity).`;
  const sms = str(body.sms, 320);
  const channels = body.channels && typeof body.channels === 'object' ? { email: body.channels.email === true, sms: body.channels.sms === true } : { email: false, sms: false };
  const rcp = normalizeRecipients(body.recipients || []);
  if (!rcp.ok) return A.json(400, { ok: false, error: rcp.reason });

  // Content-blind guard — the Sentinel's own definition, fail-closed.
  const guard = await A.contentGuard();
  if (!guard || typeof guard.mustBeTelemetrySafe !== 'function') return A.json(503, { ok: false, error: 'content-guard-unavailable' });
  const safe = guard.mustBeTelemetrySafe({ payload: { title, recipeId, severity, platform, outcome: str(body.outcome, 40) || null, summary: body.summary && typeof body.summary === 'object' ? { period: str(body.summary.period, 40) } : null }, subject, text, sms });
  if (!safe.ok) return A.json(422, { ok: false, error: 'content-not-allowed', reason: safe.reason });

  // Approval-requested: store the ask, mint signed links (only with a secret).
  let approval = null;
  let approvalError = null;
  if (ev === 'approval-requested') {
    const store = await A.openStore(A.APPROVALS_STORE);
    if (!store) {
      approvalError = 'approval-store-unavailable';
    } else {
      const rec = A.createApprovalRecord({ tenant: auth.tenant, device, recipe: recipeId, title, severity, platform, clientApprovalId: body.approvalId, expiresAt: body.expiresAt, now: Date.now() });
      try {
        await store.setJSON(rec.id, rec);
        const links = A.approvalLinks(rec.id, Date.parse(rec.expiresAt), A.approvalSecret());
        approval = { id: rec.id, expiresAt: rec.expiresAt, approveUrl: links ? links.approveUrl : null, denyUrl: links ? links.denyUrl : null, linksSigned: Boolean(links) };
        if (!links) approvalError = 'approval-secret-not-configured';
      } catch (e) {
        approvalError = 'approval-store-write-failed';
      }
    }
  }

  // Send — only the channels the device asked for, only to the recipients it named.
  const recipients = rcp.recipients.map((r) => ({ role: r.role, name: r.name, email: channels.email ? r.email : null, phone: channels.sms ? r.phone : null })).filter((r) => r.email || r.phone);
  const emailOut = { attempted: 0, sent: 0, dormant: false, error: null };
  const smsOut = { attempted: 0, sent: 0, dormant: false, error: null };
  let logKey = null;
  if (recipients.length && (channels.email || (channels.sms && sms))) {
    const { notify } = await import('./lib/notify.mjs');
    const links = approval && approval.linksSigned ? { approveUrl: approval.approveUrl, denyUrl: approval.denyUrl } : null;
    const html = renderEmailHtml({ event: ev, title, severity, platform, text, links, expiresAt: approval && approval.expiresAt });
    const plain = `${text}${links ? `\n\nApprove: ${links.approveUrl}\nDeny: ${links.denyUrl}\n(The links expire at ${approval.expiresAt}.)` : ''}\n\n— ${BRAND}`;
    const smsBody = sms ? (links && sms.length + links.approveUrl.length < 300 ? `${sms} Approve: ${links.approveUrl}` : sms) : '';
    const r = await notify({ recipients, subject, text: plain, html, sms: channels.sms ? smsBody : '', tag: `sentinel-${ev}`, tenant: auth.tenant });
    logKey = r.log && r.log.key ? r.log.key : null;
    let emailDormant = 0, smsDormant = 0;
    for (const x of r.results || []) {
      if (x.email) { emailOut.attempted++; if (x.email.ok) emailOut.sent++; else if (x.email.dormant) emailDormant++; else emailOut.error = emailOut.error || x.email.error || 'failed'; }
      if (x.sms) { smsOut.attempted++; if (x.sms.ok) smsOut.sent++; else if (x.sms.dormant) smsDormant++; else smsOut.error = smsOut.error || x.sms.error || 'failed'; }
    }
    emailOut.dormant = emailOut.attempted > 0 && emailDormant === emailOut.attempted;
    smsOut.dormant = smsOut.attempted > 0 && smsDormant === smsOut.attempted;
    if (emailOut.dormant) emailOut.error = 'no-email-provider-configured';
    if (smsOut.dormant) smsOut.error = 'twilio-not-configured';
  }

  return A.json(200, {
    ok: true,
    event: ev,
    auth: auth.kind,
    email: emailOut,
    sms: smsOut,
    approval,
    approvalError,
    log: { key: logKey }
  });
};
