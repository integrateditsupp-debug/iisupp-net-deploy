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
 * SENTINEL-BACKEND 2026-10-14 (audit B5 — SUPERSEDED by the review fixes below): when the device credential maps to a per-customer license record
 * (lib/sentinel-license-records.cjs key index), every email recipient must be one the RECORD vouches for —
 * the Stripe customer email, an admin-set contact, the email the device registered at check-in, or a
 * colleague on the same private company domain. Anything else → 403 recipients-not-registered and nothing
 * is sent. A v1 shared plan key with no customer record keeps the previous caller-named behaviour (Rule 15),
 * still behind the content guard. The rate bucket is per tenant AND per device (`device` field), so one
 * device cannot exhaust a whole plan's quota.
 *
 * SENTINEL REVIEW FIXES 2026-10-14 (P1-2) — the binding above was bypassable (register any email at check-in,
 * then mail it; a same-domain address also passed) and the limiter was per warm instance AND keyed by the body's
 * caller-chosen `device`, so rotating it gave a fresh bucket every post. Now:
 *   - recipients (email AND phone) must be on the license: the Stripe buyer email on the record, an
 *     admin-APPROVED contact, or the IIS admin inbox (lib/sentinel-license-records.cjs isAllowedRecipient /
 *     isAllowedPhone). A self-registered check-in email is pending until approved. A v1 SHARED plan key or a
 *     credential with no record may name the admin inbox only. Anything else → 403 recipients-not-registered,
 *     nothing sent, and the rejected address is never echoed.
 *   - rate limit per CREDENTIAL (never per device): the in-memory 30 / 10 min burst guard, then a DURABLE Blobs
 *     limiter (lib/sentinel-store.cjs durableLimit) — SENTINEL_NOTIFY_PER_HOUR (default 20) per credential and
 *     SENTINEL_NOTIFY_GLOBAL_PER_HOUR (default 200) across every device — counted for posts that would send or store
 *     something. The limiter store unreachable → 503 rate-limiter-unavailable (fail closed), nothing sent.
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
const R = require('./lib/sentinel-license-records.cjs');
const S = require('./lib/sentinel-store.cjs');

/** Durable hourly ceilings (REVIEW FIX P1-2). Env-tunable; a non-positive / junk value falls back to the default. */
function notifyLimits(env) {
  const e = env || process.env;
  const n = (v, d) => { const x = Math.floor(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  return { perCredential: n(e.SENTINEL_NOTIFY_PER_HOUR, 20), global: n(e.SENTINEL_NOTIFY_GLOBAL_PER_HOUR, 200) };
}

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

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return A.json(400, { ok: false, error: 'bad-json' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return A.json(400, { ok: false, error: 'bad-json' });

  // In-memory burst guard per CREDENTIAL (REVIEW FIX P1-2: never per the caller-chosen `device`) — per IP for
  // internal callers. The durable hourly ceiling is applied below, once the post is known to send something.
  const rlKey = hashKey(`sentinel-notify:${auth.kind === 'device' ? auth.tenant : A.clientIp(event)}`);
  const rl = checkRateLimit(event, { scope: 'sentinel-notify', key: rlKey, limit: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl, { 'cache-control': 'no-store' });

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

  // Recipient binding (REVIEW FIX P1-2): for EVERY device credential, each address that would be used must be on
  // the license — the record's Stripe buyer email, an admin-approved contact/phone, or the admin inbox. A shared
  // v1 plan key / a credential with no record: admin inbox only. Internal (admin-token) callers are trusted.
  let recipientBinding = 'internal';
  if (auth.kind === 'device') {
    const ctxR = { keyRecord: auth.record, sharedKey: auth.sharedKey === true };
    recipientBinding = auth.record && !ctxR.sharedKey ? 'license-record' : 'admin-inbox-only';
    const rejected = [];
    rcp.recipients.forEach((r, i) => {
      const emailBad = channels.email && r.email && !R.isAllowedRecipient(r.email, ctxR).ok;
      const phoneBad = channels.sms && sms && r.phone && !R.isAllowedPhone(r.phone, ctxR).ok;
      if (emailBad || phoneBad) rejected.push(i);
    });
    if (rejected.length) {
      return A.json(403, { ok: false, error: 'recipients-not-registered', rejected, recipientBinding, hint: recipientBinding === 'license-record'
        ? 'Recipients must be the licensed customer email or a contact Integrated IT Support has approved for this license (an address given at device check-in stays pending until approved).'
        : 'This license key is not tied to one customer record, so it may notify the Integrated IT Support admin inbox only.' });
    }
  }

  // Content-blind guard — the Sentinel's own definition, fail-closed.
  const guard = await A.contentGuard();
  if (!guard || typeof guard.mustBeTelemetrySafe !== 'function') return A.json(503, { ok: false, error: 'content-guard-unavailable' });
  const safe = guard.mustBeTelemetrySafe({ payload: { title, recipeId, severity, platform, outcome: str(body.outcome, 40) || null, summary: body.summary && typeof body.summary === 'object' ? { period: str(body.summary.period, 40) } : null }, subject, text, sms });
  if (!safe.ok) return A.json(422, { ok: false, error: 'content-not-allowed', reason: safe.reason });

  // Durable hourly ceiling (REVIEW FIX P1-2) — per credential, then global; fail CLOSED when the store is down.
  // Counted only for a post that will send or store something (a refused / empty post costs nothing).
  const willAct = ev === 'approval-requested' || (rcp.recipients.some((r) => (channels.email && r.email) || (channels.sms && sms && r.phone)));
  if (auth.kind === 'device' && willAct) {
    const lim = notifyLimits();
    const rlStore = await A.openStore(R.STORES.RATE_LIMITS, event);
    const dl = await S.durableLimits(rlStore, [
      { scope: 'notify', id: auth.tenant, limit: lim.perCredential },
      { scope: 'notify-global', id: 'all', limit: lim.global }
    ]);
    if (!dl.ok) {
      if (dl.unavailable) console.error('[sentinel-notify] durable limiter unavailable — refusing (fail closed)');
      return S.limitResponse(dl);
    }
  }

  // Approval-requested: store the ask, mint signed links (only with a secret).
  let approval = null;
  let approvalError = null;
  if (ev === 'approval-requested') {
    const store = await A.openStore(A.APPROVALS_STORE, event);
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
    recipientBinding,
    email: emailOut,
    sms: smsOut,
    approval,
    approvalError,
    log: { key: logKey }
  });
};
