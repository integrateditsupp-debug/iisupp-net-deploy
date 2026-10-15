// sentinel-session-report — ARIA Sentinel desktop posts a compiled session at END only; we send TWO emails:
//   1. COMPANY (integrateditsupp@gmail.com) — issue + honest outcome + the real SLA metrics + ticket ref.
//   2. USER (the email REGISTERED on the license) — their issue, what was done / the honest outcome, the metrics.
// HARD RULE 14: outcome wording is honest — an escalation says "escalated", never "fixed". Metrics are passed
// through from the desktop's measured timestamps (we don't invent any). Defense-in-depth: re-scrub paths/secrets.
// Spec: ARIA Sentinel/dev-docs/sentinel-profile-and-session-email-spec.md (B/C).
//
// SENTINEL-BACKEND 2026-10-14 (audit B2 — P0). Before today this endpoint was an open relay from the company's
// verified sender: no auth, CORS *, any caller could name any `user.email` and ship any transcript/summary.
// Now:
//   - device auth: `x-sentinel-key` = sha256(licenseKey) (lib/sentinel-approvals.cjs — the same credential the
//     notify endpoint uses) or an internal/admin token. No credential → 401 and NOTHING is sent.
//   - the user copy goes ONLY to an address the license vouches for (narrowed by the review fixes below — see
//     lib/sentinel-license-records.cjs isAllowedRecipient). A body-supplied address that is not registered is
//     skipped and SAID so. An internal caller (admin token) may name any valid address.
//   - content-blind: transcript + backend actions are NOT mailed any more; issue / summary / names / ticket go
//     through the desktop's own mustBeTelemetrySafe guard (fail-closed) → 422 content-not-allowed, nothing sent.
//   - no CORS wildcard (the desktop is a Node client); 5 reports / 10 min per credential; 24 KB body cap.
// The desktop (main.mjs sendResolutionEmail) reads only `res.ok` — response fields are a superset of before.
//
// SENTINEL REVIEW FIXES 2026-10-14 (P1-2): the user copy goes only to the Stripe buyer email on the license record,
// an admin-APPROVED contact, or the IIS admin inbox. The email a device declared at check-in (self-registered) and
// same-domain colleagues no longer count; a v1 SHARED plan key or a credential with no record gets no user copy
// unless it names the admin inbox. Besides the in-memory 5 / 10 min guard, a DURABLE per-credential ceiling
// (SENTINEL_SESSION_REPORTS_PER_HOUR, default 10) and a global one (SENTINEL_SESSION_REPORTS_GLOBAL_PER_HOUR,
// default 100) hold across instances; the limiter store unreachable → 503, nothing sent (fail closed).
'use strict';

const { checkRateLimit, rateLimitResponse, hashKey } = require('./_rate-limit.js');
const A = require('./lib/sentinel-approvals.cjs');
const R = require('./lib/sentinel-license-records.cjs');
const S = require('./lib/sentinel-store.cjs');

function reportLimits(env) {
  const e = env || process.env;
  const n = (v, d) => { const x = Math.floor(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  return { perCredential: n(e.SENTINEL_SESSION_REPORTS_PER_HOUR, 10), global: n(e.SENTINEL_SESSION_REPORTS_GLOBAL_PER_HOUR, 100) };
}

const COMPANY_EMAIL = 'integrateditsupp@gmail.com';
const MAX_BODY = 24 * 1024;
const OUTCOMES = ['resolved', 'escalated', 'user_ended', 'timeout'];
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._#:-]{0,79}$/;

function str(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : ''; }

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'POST').toUpperCase();
  if (method === 'OPTIONS') return resp(204, '');
  if (method !== 'POST') return json(405, { error: 'POST only' });
  if (Buffer.byteLength(String(event.body || ''), 'utf8') > MAX_BODY) return json(413, { error: 'body too large' });

  // Auth first — an unauthenticated POST sends nothing and learns nothing.
  const auth = await A.authenticate(event);
  if (!auth.ok) return json(auth.status || 401, { ok: false, error: auth.error || 'unauthorized' });

  const rl = checkRateLimit(event, { scope: 'sentinel-session-report', key: hashKey(`session-report:${auth.kind === 'device' ? auth.tenant : A.clientIp(event)}`), limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl, { 'cache-control': 'no-store' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'invalid JSON' });

  // Only ever act on an ENDED session with a known outcome — never mid-session.
  const outcome = String(body.outcome || '');
  const sessionId = str(String(body.sessionId == null ? '' : body.sessionId), 80);
  if (!sessionId || !OUTCOMES.includes(outcome) || !body.endedAt) {
    return json(400, { error: 'sessionId + ended session (endedAt) + valid outcome required' });
  }
  const user = body.user && typeof body.user === 'object' ? body.user : {};
  const userEmail = str(user.email, 254).toLowerCase();

  // Content-blind facts only. Transcript + actions are dropped (never mailed); what remains is checked RAW by
  // the desktop's own guard first (raw paths, URLs, log lines, document text, addresses inside text → 422,
  // fail-closed like aria-sentinel-notify), then scrubbed once more for what the guard does not cover
  // (secret-shaped tokens, the R11 folder name) before it reaches a mail body.
  const raw = {
    outcome,
    issue: str(body.issue, 160),
    summary: str(body.summary, 600),
    ticketRef: str(body.ticketRef, 60).replace(/[^\w.#:-]/g, ''),
    firstName: str(user.firstName, 60),
    lastName: str(user.lastName, 60),
    company: str(user.company, 120),
    sla: slaFacts(body.sla)
  };
  const guard = await A.contentGuard();
  if (!guard || typeof guard.mustBeTelemetrySafe !== 'function') return json(503, { ok: false, error: 'content-guard-unavailable' });
  // sessionId is a token (TOKEN_RE above, e.g. "sentinel-1760450000000"): its epoch digits would trip the
  // guard's payment-card-length check, so the free-text fields are guarded and the token is not.
  const safe = guard.mustBeTelemetrySafe(raw);
  if (!safe.ok) return json(422, { ok: false, error: 'content-not-allowed', reason: safe.reason });
  const facts = {
    ...raw,
    sessionId: TOKEN_RE.test(sessionId) ? sessionId : scrub(sessionId).replace(/[^\w.#:-]/g, '').slice(0, 80) || 'session',
    issue: scrub(raw.issue),
    summary: scrub(raw.summary),
    firstName: scrub(raw.firstName),
    lastName: scrub(raw.lastName),
    company: scrub(raw.company)
  };

  // Who may receive the user copy: only an address the license vouches for (internal callers may name any).
  let userRecipient = null;
  let userSkip = null;
  if (!userEmail || !EMAIL_RE.test(userEmail)) {
    userSkip = 'no valid profile email';
  } else if (auth.kind === 'internal') {
    userRecipient = userEmail;
  } else {
    const allowed = R.isAllowedRecipient(userEmail, { keyRecord: auth.record, sharedKey: auth.sharedKey === true });
    if (allowed.ok) userRecipient = userEmail; else userSkip = 'recipient-not-registered';
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'ARIA — Integrated IT Support <noreply@iisupp.net>';
  if (!key) return json(503, { ok: false, error: 'email not configured (RESEND_API_KEY)', wouldSend: previewSubjects(facts, userRecipient) });

  // Durable hourly ceiling per credential, then global (REVIEW FIX P1-2) — fail closed when the store is down.
  if (auth.kind === 'device') {
    const lim = reportLimits();
    const rlStore = await A.openStore(R.STORES.RATE_LIMITS, event);
    const dl = await S.durableLimits(rlStore, [
      { scope: 'session-report', id: auth.tenant, limit: lim.perCredential },
      { scope: 'session-report-global', id: 'all', limit: lim.global }
    ]);
    if (!dl.ok) {
      if (dl.unavailable) console.error('[sentinel-session-report] durable limiter unavailable — refusing (fail closed)');
      return S.limitResponse(dl);
    }
  }

  const resolved = outcome === 'resolved';
  const escalated = outcome === 'escalated';
  const verb = resolved ? 'Resolved' : escalated ? 'Escalated' : 'Session ended';
  const companySubject = `ARIA Sentinel session — ${verb} · ${facts.issue || 'support'} (#${facts.sessionId})`;
  const userSubject = resolved
    ? `Your ARIA session — resolved (#${facts.sessionId})`
    : escalated
      ? `Your ARIA session — escalated to a technician (#${facts.sessionId})`
      : `Your ARIA session — ended (#${facts.sessionId})`;

  const sent = [];
  const errors = [];
  // 1) company — the registered customer email is named only when it is one the license vouches for.
  await send(key, from, COMPANY_EMAIL, companySubject, companyHtml(facts, userRecipient, auth)).then(
    (r) => sent.push({ to: 'company', id: r }), (e) => errors.push({ to: 'company', error: String(e && e.message || e) }));
  // 2) user — only to the registered address.
  if (userRecipient) {
    await send(key, from, userRecipient, userSubject, userHtml(facts)).then(
      (r) => sent.push({ to: 'user', id: r }), (e) => errors.push({ to: 'user', error: String(e && e.message || e) }));
  } else {
    errors.push({ to: 'user', skipped: userSkip });
  }

  return json(errors.filter((e) => e.error).length ? 207 : 200, { ok: sent.length > 0, outcome, sent, errors, auth: auth.kind });
};

async function send(key, from, to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: 'ahmad.wasee@iisupp.net' }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + JSON.stringify(data).slice(0, 200));
  return data && data.id;
}

function previewSubjects(facts, userRecipient) {
  const resolved = facts.outcome === 'resolved', escalated = facts.outcome === 'escalated';
  return { company: (resolved ? 'Resolved' : escalated ? 'Escalated' : 'Ended') + ' #' + facts.sessionId, user: userRecipient || '(no registered email)' };
}

// Only the measured metric fields, as short strings/booleans — nothing free-form.
function slaFacts(sla) {
  if (!sla || typeof sla !== 'object') return null;
  const out = {};
  if (sla.timeToResolveText) out.timeToResolveText = str(String(sla.timeToResolveText), 40);
  if (sla.respondText) out.respondText = str(String(sla.respondText), 40);
  if (sla.target) out.target = str(String(sla.target), 60);
  if (sla.resolveMet === true || sla.resolveMet === false) out.resolveMet = sla.resolveMet;
  return Object.keys(out).length ? out : null;
}

// ── honest email bodies ─────────────────────────────────────────────────────────────────────────────────
function slaLine(sla) {
  if (!sla) return '';
  var parts = [];
  if (sla.timeToResolveText) parts.push('Time in session: <b>' + esc(sla.timeToResolveText) + '</b>');
  if (sla.respondText) parts.push('First response: <b>' + esc(sla.respondText) + '</b>');
  parts.push('Target: ' + esc(sla.target || ''));
  if (sla.resolveMet === true) parts.push('SLA: <b>met</b>');
  else if (sla.resolveMet === false) parts.push('SLA: <b>over target</b>');
  return '<p style="font:13px/1.6 system-ui">' + parts.join(' &middot; ') + '</p>';
}
function companyHtml(f, userRecipient, auth) {
  return '<div style="max-width:640px;margin:0 auto;font-family:system-ui">'
    + '<h2 style="font:600 17px system-ui">ARIA Sentinel session — ' + esc(verbOf(f)) + '</h2>'
    + '<p style="font:13px system-ui"><b>Issue:</b> ' + esc(f.issue) + '<br><b>Outcome:</b> ' + esc(f.outcome) + (f.summary ? ' — ' + esc(f.summary) : '') + (f.ticketRef ? '<br><b>Ticket:</b> ' + esc(f.ticketRef) : '') + '</p>'
    + '<p style="font:13px system-ui"><b>User:</b> ' + esc(f.firstName) + ' ' + esc(f.lastName) + (f.company ? ' · ' + esc(f.company) : '') + (userRecipient ? ' · ' + esc(userRecipient) : ' · (no registered email)') + '</p>'
    + slaLine(f.sla)
    + '<p style="font:12px system-ui;color:#555">Reported by ' + esc(auth && auth.kind === 'device' ? 'a licensed device (' + (auth.plan || 'plan unknown') + ')' : 'an internal caller') + '. Transcripts never leave the device — this report carries the issue name, outcome and metrics only.</p>'
    + '</div>';
}
function userHtml(f) {
  var resolved = f.outcome === 'resolved', escalated = f.outcome === 'escalated';
  var headline = resolved ? 'We resolved it on your device.' : escalated ? 'We’ve escalated this to a technician.' : 'Your session has ended.';
  return '<div style="max-width:560px;margin:0 auto;font-family:system-ui">'
    + '<h2 style="font:600 18px system-ui">' + esc(headline) + '</h2>'
    + '<p style="font:14px/1.6 system-ui">Hi ' + esc(f.firstName || 'there') + ', here’s your ARIA session summary.</p>'
    + '<p style="font:14px/1.6 system-ui"><b>Issue:</b> ' + esc(f.issue) + '<br>'
    + '<b>What happened:</b> ' + esc(f.summary || (resolved ? 'The fix was applied and verified on your device.' : escalated ? 'A technician will follow up.' : 'The session ended without a change.')) + (f.ticketRef ? '<br><b>Ticket:</b> ' + esc(f.ticketRef) : '') + '</p>'
    + (escalated ? '<p style="font:13px/1.6 system-ui;color:#a40">This was <b>escalated, not fixed</b> — a human will follow up. Nothing was changed on your machine without your approval.</p>' : '')
    + slaLine(f.sla)
    + '<p style="font:12px system-ui;color:#888;margin-top:18px">Integrated IT Support Inc. · this report was sent because you ran an ARIA Sentinel session. Your details are kept private.</p>'
    + '</div>';
}
function verbOf(b) { return b.outcome === 'resolved' ? 'Resolved' : b.outcome === 'escalated' ? 'Escalated' : 'Ended'; }

// defense-in-depth scrub (the desktop already scrubs; re-strip paths/secrets/private folder server-side).
function scrub(t) {
  return String(t == null ? '' : t)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, '<private-folder>')
    .replace(/file:\/\/\/?[^\s"')]+/gi, '[path]')
    .replace(/[A-Za-z]:\\[^\s"'()<>]+/g, '[path]')
    .replace(/\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,})\b/g, '[redacted]');
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
function resp(code, b) { return { statusCode: code, headers: { 'cache-control': 'no-store' }, body: b }; }
function json(code, b) { return { statusCode: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(b) }; }
