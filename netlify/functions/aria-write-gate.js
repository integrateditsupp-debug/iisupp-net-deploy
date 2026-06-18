/**
 * aria-write-gate — Approval gate for ARIA write/agentic actions
 *  POST { event: 'request', action, params, tenant_email, requested_by }
 *    -> creates pending request, emails Ahmad an approve/deny link, returns request_id
 *  POST { event: 'approve', request_id, token }
 *    -> marks approved (Ahmad clicks this from his email)
 *  POST { event: 'deny', request_id, token }
 *  POST { event: 'status', request_id }
 *
 *  Persists to Netlify Blobs; falls back to in-memory.
 *  Designed for: password reset, license assign/remove, group add, device wipe, etc.
 *  HARD RULE: nothing fires automatically — Ahmad approves every privileged action until tenant trust > 90 days.
 *
 *  Cat 23 — Autonomous / agentic with safety rails.
 */
const crypto = require('crypto');
const { redact } = require('./_pii-redact');

const SECRET = process.env.APERTURE_JWT_SECRET || process.env.ARIA_GATE_SECRET || 'changeme-dev-only';
const SAFE_ACTIONS = [
  'm365.password.reset',
  'm365.license.assign',
  'm365.license.remove',
  'm365.group.add_member',
  'm365.group.remove_member',
  'm365.user.disable',
  'm365.user.enable',
  'kb.add_entry',
  'kb.remove_entry',
  'notify.tenant_users'
];

let _blobs = null;
let _memFallback = {};

async function getStore() {
  if (_blobs !== null) return _blobs;
  try {
    const { getStore } = require('@netlify/blobs');
    _blobs = getStore({ name: 'aria-write-gate', consistency: 'strong' });
  } catch (e) { _blobs = false; }
  return _blobs;
}

function sign(requestId, action) {
  return crypto.createHmac('sha256', SECRET).update(requestId + ':' + action).digest('hex').slice(0, 24);
}

function verify(requestId, action, token) {
  const expect = sign(requestId, action);
  if (expect.length !== (token || '').length) return false;
  return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(token));
}

async function persist(id, record) {
  const store = await getStore();
  if (store) { try { await store.setJSON('req-' + id, record); return; } catch (e) {} }
  _memFallback[id] = record;
}
async function fetchRec(id) {
  const store = await getStore();
  if (store) { try { return await store.get('req-' + id, { type: 'json' }); } catch (e) {} }
  return _memFallback[id] || null;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // GET for approval clickthrough from email
  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};
    const action = qs.action;
    const id = qs.id;
    const token = qs.token;
    const decision = (qs.decision || '').toLowerCase();
    if (!id || !token || !verify(id, action || '', token)) {
      return { statusCode: 403, headers: { 'Content-Type': 'text/html' }, body: '<h1>Invalid or expired approval link</h1>' };
    }
    const rec = await fetchRec(id);
    if (!rec) return { statusCode: 404, headers: { 'Content-Type': 'text/html' }, body: '<h1>Request not found</h1>' };
    if (rec.status !== 'pending') return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: '<h1>Already ' + rec.status + '</h1>' };
    rec.status = decision === 'approve' ? 'approved' : 'denied';
    rec.decided_at = Date.now();
    await persist(id, rec);
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body:
      '<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">' +
      '<h1 style="color:' + (rec.status === 'approved' ? '#d4af37' : '#ff6b6b') + '">Request ' + rec.status.toUpperCase() + '</h1>' +
      '<p>Action: <code>' + rec.action + '</code></p>' +
      '<p>Tenant: ' + (rec.tenant_email || 'n/a') + '</p>' +
      '<p>This decision was recorded at ' + new Date(rec.decided_at).toISOString() + '</p></body></html>'
    };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || '').trim();

  if (ev === 'request') {
    const action = String(body.action || '').trim();
    if (!SAFE_ACTIONS.includes(action)) {
      return ok({ ok: false, error: 'action not in allow-list', allowed: SAFE_ACTIONS });
    }
    const id = crypto.randomBytes(12).toString('hex');
    const token = sign(id, action);
    const rec = {
      id,
      action,
      params: body.params || {},
      tenant_email: String(body.tenant_email || '').toLowerCase(),
      requested_by: String(body.requested_by || 'ARIA'),
      status: 'pending',
      created_at: Date.now(),
      ttl_at: Date.now() + 24 * 3600 * 1000
    };
    await persist(id, rec);
    await emailAhmad(rec, token);
    return ok({ ok: true, request_id: id, status: 'pending', expires_at: rec.ttl_at });
  }

  if (ev === 'status') {
    const id = String(body.request_id || '');
    const rec = await fetchRec(id);
    if (!rec) return ok({ ok: false, error: 'not found' });
    return ok({ ok: true, status: rec.status, action: rec.action, created_at: rec.created_at, decided_at: rec.decided_at });
  }

  if (ev === 'approve' || ev === 'deny') {
    const id = String(body.request_id || '');
    const token = String(body.token || '');
    const rec = await fetchRec(id);
    if (!rec) return ok({ ok: false, error: 'not found' });
    if (!verify(id, rec.action, token)) return ok({ ok: false, error: 'bad token' });
    if (rec.status !== 'pending') return ok({ ok: false, error: 'already ' + rec.status });
    rec.status = ev === 'approve' ? 'approved' : 'denied';
    rec.decided_at = Date.now();
    await persist(id, rec);
    return ok({ ok: true, status: rec.status });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(body) { return { statusCode: 200, headers, body: JSON.stringify(body) }; }
};

async function emailAhmad(rec, token) {
  const to = process.env.ARIA_GATE_ALERT_TO || 'ahmad.wasee@iisupp.net';
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('[write-gate] RESEND_API_KEY missing — no email sent'); return; }
  const base = process.env.SITE_BASE_URL || 'https://iisupp.net';
  const approveUrl = base + '/.netlify/functions/aria-write-gate?id=' + rec.id + '&action=' + encodeURIComponent(rec.action) + '&token=' + token + '&decision=approve';
  const denyUrl    = base + '/.netlify/functions/aria-write-gate?id=' + rec.id + '&action=' + encodeURIComponent(rec.action) + '&token=' + token + '&decision=deny';
  const subject = '[ARIA write-gate] APPROVE: ' + rec.action + ' for ' + (rec.tenant_email || '?');
  const html =
    '<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px">' +
    '<h2 style="color:#d4af37">ARIA requested approval to act</h2>' +
    '<p><strong>Action:</strong> <code>' + rec.action + '</code></p>' +
    '<p><strong>Tenant:</strong> ' + redact(rec.tenant_email || '?') + '</p>' +
    '<p><strong>Requested by:</strong> ' + redact(rec.requested_by) + '</p>' +
    '<p><strong>Params:</strong> <pre>' + redact(JSON.stringify(rec.params, null, 2)) + '</pre></p>' +
    '<p><strong>Expires:</strong> in 24h</p>' +
    '<div style="margin:30px 0">' +
    '<a href="' + approveUrl + '" style="background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px">APPROVE</a>' +
    '<a href="' + denyUrl + '" style="background:#dc2626;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">DENY</a>' +
    '</div></div>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>', to: [to], subject, html })
    });
  } catch (e) { console.warn('[write-gate] mail failed:', e.message); }
}
