// sentinel-session-report — ARIA Sentinel desktop posts a compiled session at END only; we send TWO emails:
//   1. COMPANY (integrateditsupp@gmail.com) — the same data ARIA web shares: issue + transcript + actions + metrics.
//   2. USER (their profile email) — their issue, what was done / the honest outcome, and the REAL SLA metrics.
// HARD RULE 14: outcome wording is honest — an escalation says "escalated", never "fixed". Metrics are passed
// through from the desktop's measured timestamps (we don't invent any). Defense-in-depth: re-scrub paths/secrets.
// Spec: ARIA Sentinel/dev-docs/sentinel-profile-and-session-email-spec.md (B/C).

const COMPANY_EMAIL = 'integrateditsupp@gmail.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '');
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }

  // Only ever act on an ENDED session with a known outcome — never mid-session.
  const outcome = String(body.outcome || '');
  if (!body.sessionId || !['resolved', 'escalated', 'user_ended', 'timeout'].includes(outcome) || !body.endedAt) {
    return json(400, { error: 'sessionId + ended session (endedAt) + valid outcome required' });
  }
  const user = body.user || {};
  const userEmail = String(user.email || '').trim();
  const resolved = outcome === 'resolved';
  const escalated = outcome === 'escalated';

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'ARIA — Integrated IT Support <noreply@iisupp.net>';
  if (!key) return json(503, { error: 'email not configured (RESEND_API_KEY)', wouldSend: previewSubjects(body, user) });

  const verb = resolved ? 'Resolved' : escalated ? 'Escalated' : 'Session ended';
  const companySubject = `ARIA Sentinel session — ${verb} · ${scrub(body.issue) || 'support'} (#${body.sessionId})`;
  const userSubject = resolved
    ? `Your ARIA session — resolved (#${body.sessionId})`
    : escalated
      ? `Your ARIA session — escalated to a technician (#${body.sessionId})`
      : `Your ARIA session — ended (#${body.sessionId})`;

  const sent = [];
  const errors = [];
  // 1) company
  await send(key, from, COMPANY_EMAIL, companySubject, companyHtml(body, user)).then(
    (r) => sent.push({ to: 'company', id: r }), (e) => errors.push({ to: 'company', error: String(e && e.message || e) }));
  // 2) user (only if we have a valid-looking address)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(userEmail)) {
    await send(key, from, userEmail, userSubject, userHtml(body, user)).then(
      (r) => sent.push({ to: 'user', id: r }), (e) => errors.push({ to: 'user', error: String(e && e.message || e) }));
  } else {
    errors.push({ to: 'user', skipped: 'no valid profile email' });
  }

  return json(errors.filter((e) => e.error).length ? 207 : 200, { ok: sent.length > 0, outcome, sent, errors });
};

async function send(key, from, to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: 'ahmad.wasee@iisupp.net' })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + JSON.stringify(data).slice(0, 200));
  return data && data.id;
}

function previewSubjects(body, user) {
  const resolved = body.outcome === 'resolved', escalated = body.outcome === 'escalated';
  return { company: (resolved ? 'Resolved' : escalated ? 'Escalated' : 'Ended') + ' #' + body.sessionId, user: user.email || '(no email)' };
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
function transcriptHtml(t) {
  if (!Array.isArray(t) || !t.length) return '<p style="color:#777;font:13px system-ui">No transcript.</p>';
  return '<div style="font:13px/1.6 system-ui">' + t.map(function (x) {
    return '<p style="margin:4px 0"><b style="color:' + (x.role === 'user' ? '#1a6' : '#a76') + '">' + (x.role === 'user' ? 'User' : 'ARIA') + ':</b> ' + esc(scrub(x.text)) + '</p>';
  }).join('') + '</div>';
}
function actionsHtml(a) {
  if (!Array.isArray(a) || !a.length) return '';
  return '<p style="font:12px system-ui;color:#555"><b>Backend steps:</b> ' + a.map(function (x) {
    return esc(x.recipeId || '') + (x.step ? ' — ' + esc(scrub(x.step)) : '') + (x.outcome ? ' (' + esc(x.outcome) + ')' : '');
  }).join('; ') + '</p>';
}
function companyHtml(body, user) {
  return '<div style="max-width:640px;margin:0 auto;font-family:system-ui">'
    + '<h2 style="font:600 17px system-ui">ARIA Sentinel session — ' + esc(verbOf(body)) + '</h2>'
    + '<p style="font:13px system-ui"><b>Issue:</b> ' + esc(scrub(body.issue)) + '<br><b>Outcome:</b> ' + esc(body.outcome) + ' — ' + esc(body.summary) + '</p>'
    + '<p style="font:13px system-ui"><b>User:</b> ' + esc(user.firstName) + ' ' + esc(user.lastName) + ' · ' + esc(user.company) + ' · ' + esc(user.email) + ' · ' + esc(user.phone) + '</p>'
    + slaLine(body.sla)
    + '<h3 style="font:600 14px system-ui;margin-top:16px">Transcript</h3>' + transcriptHtml(body.transcript)
    + actionsHtml(body.actions)
    + '</div>';
}
function userHtml(body, user) {
  var resolved = body.outcome === 'resolved', escalated = body.outcome === 'escalated';
  var headline = resolved ? 'We resolved it on your device.' : escalated ? 'We’ve escalated this to a technician.' : 'Your session has ended.';
  return '<div style="max-width:560px;margin:0 auto;font-family:system-ui">'
    + '<h2 style="font:600 18px system-ui">' + esc(headline) + '</h2>'
    + '<p style="font:14px/1.6 system-ui">Hi ' + esc(user.firstName || 'there') + ', here’s your ARIA session summary.</p>'
    + '<p style="font:14px/1.6 system-ui"><b>Issue:</b> ' + esc(scrub(body.issue)) + '<br>'
    + '<b>What happened:</b> ' + esc(body.summary) + '</p>'
    + (escalated ? '<p style="font:13px/1.6 system-ui;color:#a40">This was <b>escalated, not fixed</b> — a human will follow up. Nothing was changed on your machine without your approval.</p>' : '')
    + slaLine(body.sla)
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
function resp(code, b) { return { statusCode: code, headers: cors(), body: b }; }
function json(code, b) { return { statusCode: code, headers: Object.assign({ 'content-type': 'application/json' }, cors()), body: JSON.stringify(b) }; }
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
