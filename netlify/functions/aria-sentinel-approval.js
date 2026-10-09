/**
 * aria-sentinel-approval — RUN-CU / CU4 (2026-10-08). Where an emailed Approve / Deny link lands, and where
 * the desktop polls for the decision.
 *
 *   GET  ?t=<signed token>&a=approve|deny   → a small branded decision page (one confirm button + the other
 *                                              choice as a link). GET NEVER changes state — mail scanners
 *                                              prefetch links, and a prefetch must not approve a fix.
 *   POST t=<token>&action=approve|deny&by=<name>  (form or JSON) → records the decision ONCE
 *                                              {status, decidedBy, decidedAt, decidedVia:'link'} and shows a
 *                                              confirmation page (JSON when Accept: application/json).
 *   GET  ?poll=1&id=<id>  + x-sentinel-key (device auth) [+ x-sentinel-device]
 *                                            → { id, status, decidedBy, decidedAt, expiresAt } — only for the
 *                                              tenant (and device) that raised it; 404 otherwise.
 *
 * Tokens are HMAC-signed (lib/sentinel-approvals.cjs) and expire with the record; every compare is
 * constant-time; an expired or already-decided ask says so and changes nothing. The page shows only what the
 * record holds: the fix's catalog title, severity, platform and expiry — never device content.
 */
'use strict';

const { checkRateLimit, rateLimitResponse, hashKey } = require('./_rate-limit.js');
const A = require('./lib/sentinel-approvals.cjs');

const BRAND = 'ARIA Sentinel · Integrated IT Support';
const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
};

function page(statusCode, { heading, body, form }) {
  const e = A.esc;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(heading)} — ARIA Sentinel</title></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
  <main style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px;border:1px solid #e3e5e8">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${e(BRAND)}</div>
    <h1 style="font-size:20px;margin:10px 0 14px">${e(heading)}</h1>
    ${body}
    ${form || ''}
    <hr style="border:0;border-top:1px solid #e3e5e8;margin:22px 0">
    <p style="font-size:12px;color:#6b7280;line-height:1.5">This page shows the fix's name, severity and platform only — never device content. Nothing runs until it is approved, and an approved fix still passes every safety gate on the device.</p>
  </main></body></html>`;
  return { statusCode, headers: PAGE_HEADERS, body: html };
}

function describe(rec) {
  const e = A.esc;
  return `<p style="font-size:15px;line-height:1.5"><strong>${e(rec.title)}</strong><br>
    <span style="color:#6b7280;font-size:13px">${e(rec.severity)} severity${rec.platform ? ' · ' + e(rec.platform) : ''}${rec.recipe ? ' · ' + e(rec.recipe) : ''}</span></p>
    <p style="font-size:13px;color:#6b7280">Asked ${e(String(rec.createdAt || '').replace('T', ' ').slice(0, 16))} UTC · waits until ${e(String(rec.expiresAt || '').replace('T', ' ').slice(0, 16))} UTC.</p>`;
}

function decisionForm(token, action, rec) {
  const e = A.esc;
  const other = action === 'approve' ? 'deny' : 'approve';
  const label = action === 'approve' ? 'Approve this fix' : 'Deny this fix';
  const color = action === 'approve' ? '#1b5e20' : '#616161';
  return `${describe(rec)}
    <form method="post" action="${e(A.APPROVAL_URL)}" style="margin-top:18px">
      <input type="hidden" name="t" value="${e(token)}">
      <input type="hidden" name="action" value="${e(action)}">
      <label style="display:block;font-size:13px;color:#374151;margin-bottom:6px">Your name (optional, shown in the device's audit log)
        <input type="text" name="by" maxlength="40" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"></label>
      <button type="submit" style="margin-top:12px;padding:10px 18px;background:${color};color:#fff;border:0;border-radius:6px;font-weight:600;font-size:15px;cursor:pointer">${e(label)}</button>
    </form>
    <p style="font-size:13px;margin-top:14px"><a href="${e(A.APPROVAL_URL)}?t=${encodeURIComponent(token)}&amp;a=${other}" style="color:#374151">${other === 'approve' ? 'Approve instead' : 'Deny instead'}</a></p>`;
}

function parseBody(event) {
  const raw = String(event.body || '');
  const ct = A.headerOf(event, 'content-type').toLowerCase();
  if (ct.includes('application/json')) { try { const j = JSON.parse(raw || '{}'); return j && typeof j === 'object' ? j : {}; } catch { return {}; } }
  const out = {};
  try { for (const [k, v] of new URLSearchParams(raw)) out[k] = v; } catch { /* empty */ }
  return out;
}

function wantsJson(event) { return /application\/json/i.test(A.headerOf(event, 'accept')) || /application\/json/i.test(A.headerOf(event, 'content-type')); }

const STATUS_COPY = {
  approved: 'Already approved',
  denied: 'Already denied',
  expired: 'This request expired',
  missing: 'This request was not found'
};

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  const q = event.queryStringParameters || {};
  const now = Date.now();
  if (method === 'OPTIONS') return { statusCode: 204, headers: { 'cache-control': 'no-store' }, body: '' };

  // ---------------------------------------------------------------- device poll
  if (method === 'GET' && String(q.poll || '') === '1') {
    const auth = await A.authenticate(event);
    if (!auth.ok) return A.json(auth.status || 401, { ok: false, error: auth.error });
    const rl = checkRateLimit(event, { scope: 'sentinel-approval-poll', key: hashKey(`poll:${auth.tenant}:${A.clientIp(event)}`), limit: 120, windowMs: 60 * 1000 });
    if (!rl.ok) return rateLimitResponse(rl, { 'cache-control': 'no-store' });
    const id = String(q.id || '');
    if (!A.TOKEN_RE.test(id)) return A.json(400, { ok: false, error: 'bad-id' });
    const store = await A.openStore(A.APPROVALS_STORE);
    if (!store) return A.json(503, { ok: false, error: 'approval-store-unavailable' });
    const rec = await store.get(id, { type: 'json' }).catch(() => null);
    if (!rec || rec.v !== 'sentinel-approval-v1') return A.json(404, { ok: false, error: 'not-found' });
    // The ask belongs to the tenant that raised it; when it was bound to a device, the same device must ask.
    if (auth.kind === 'device') {
      if (rec.tenant !== auth.tenant) return A.json(404, { ok: false, error: 'not-found' });
      const dev = A.headerOf(event, 'x-sentinel-device');
      if (rec.device && dev && rec.device !== dev) return A.json(404, { ok: false, error: 'not-found' });
    }
    return A.json(200, { ok: true, ...A.pollView(rec, now) });
  }

  // ---------------------------------------------------------------- the decision page / decision
  const secret = A.approvalSecret();
  if (!secret) return page(503, { heading: 'Approval links are not set up yet', body: '<p>This link cannot be checked because the signing secret is not configured on the server. Approve or deny the fix in ARIA Sentinel → Control Center → Approvals instead.</p>' });

  const rlPage = checkRateLimit(event, { scope: 'sentinel-approval-page', key: hashKey(`page:${A.clientIp(event)}`), limit: 60, windowMs: 10 * 60 * 1000 });
  if (!rlPage.ok) return page(429, { heading: 'Too many requests', body: '<p>Please wait a minute and open the link again.</p>' });

  const isPost = method === 'POST';
  if (!isPost && method !== 'GET') return A.json(405, { ok: false, error: 'method-not-allowed' });
  const body = isPost ? parseBody(event) : {};
  const token = String((isPost ? body.t : q.t) || '').trim();
  const action = String((isPost ? body.action : q.a) || 'approve').trim().toLowerCase();
  const v = A.verifyApprovalToken(token, secret, now);
  if (!v.ok) {
    const heading = v.reason === 'expired' ? 'This link has expired' : 'This link is not valid';
    const text = v.reason === 'expired' ? 'The approval window closed and nothing was changed. If the issue is still open, the device will ask again.' : 'The link is incomplete or was altered. Open the one from your email again, or decide in ARIA Sentinel → Control Center → Approvals.';
    return isPost && wantsJson(event) ? A.json(400, { ok: false, error: `token-${v.reason}` }) : page(400, { heading, body: `<p>${text}</p>` });
  }
  if (action !== 'approve' && action !== 'deny') return page(400, { heading: 'This link is not valid', body: '<p>The requested action is not recognised. Nothing was changed.</p>' });

  const store = await A.openStore(A.APPROVALS_STORE);
  if (!store) return isPost && wantsJson(event) ? A.json(503, { ok: false, error: 'approval-store-unavailable' }) : page(503, { heading: 'Temporarily unavailable', body: '<p>The approval record could not be read right now. Nothing was changed — please try again in a minute.</p>' });
  const rec = await store.get(v.id, { type: 'json' }).catch(() => null);
  const status = A.effectiveStatus(rec && rec.v === 'sentinel-approval-v1' ? rec : null, now);
  if (status !== 'pending') {
    const heading = STATUS_COPY[status] || 'This request is closed';
    const detail = status === 'approved' || status === 'denied'
      ? `<p>${A.esc(rec.decidedBy || 'Someone')} ${status} it at ${A.esc(String(rec.decidedAt || '').replace('T', ' ').slice(0, 16))} UTC. Nothing more to do.</p>`
      : status === 'expired' ? '<p>The approval window closed and nothing was changed. If the issue is still open, the device will ask again.</p>' : '<p>Nothing was changed.</p>';
    // A GET on a closed ask is an informational page (200/404); a POST that tried to decide it is a 409.
    const code = status === 'missing' ? 404 : (isPost ? 409 : 200);
    return isPost && wantsJson(event) ? A.json(code, { ok: false, error: `already-${status}`, status }) : page(code, { heading, body: (rec ? describe(rec) : '') + detail });
  }

  if (!isPost) return page(200, { heading: action === 'approve' ? 'Approve this fix?' : 'Deny this fix?', body: '', form: decisionForm(token, action, rec) });

  // POST — record the decision once.
  const d = A.decideRecord(rec, action, { decidedBy: body.by, via: 'link', now });
  if (!d.ok) return wantsJson(event) ? A.json(409, { ok: false, error: d.reason }) : page(409, { heading: 'This request is closed', body: '<p>Nothing was changed.</p>' });
  try { await store.setJSON(rec.id, d.record); } catch {
    return wantsJson(event) ? A.json(503, { ok: false, error: 'approval-store-write-failed' }) : page(503, { heading: 'Could not save the decision', body: '<p>The decision was not recorded — nothing was changed. Please try the link again, or decide in ARIA Sentinel → Control Center → Approvals.</p>' });
  }
  if (wantsJson(event)) return A.json(200, { ok: true, ...A.pollView(d.record, now) });
  const approved = d.record.status === 'approved';
  return page(200, {
    heading: approved ? 'Approved' : 'Denied',
    body: describe(d.record) + (approved
      ? '<p>The device will pick this up within a minute and run the fix through its normal safety gates (restore point where available, audit log entry, undo). You can close this page.</p>'
      : '<p>Nothing will run. The device will record the denial in its audit log. You can close this page.</p>')
  });
};
