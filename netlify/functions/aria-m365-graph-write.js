/**
 * aria-m365-graph-write — Privileged M365 Graph actions, ALL gated through aria-write-gate.
 *  POST { action, params, tenant_email, requested_by }
 *  Flow:
 *    1. Validate action is in allow-list
 *    2. Create write-gate request (Ahmad gets approve/deny email)
 *    3. Return request_id; client polls /aria-write-gate status until approved
 *    4. Separate POST { event:'execute', request_id } actually fires the Graph call
 *
 *  Supported write actions:
 *    - m365.password.reset
 *    - m365.license.assign / .remove
 *    - m365.group.add_member / .remove_member
 *    - m365.user.disable / .enable
 *
 *  Cat 23 — Autonomous + agentic (with mandatory human approval).
 *
 *  2026-10-08 (audit top-10 #3):
 *   - `request` and `execute` require an Aperture admin JWT or an admin token (X-Admin-Token /
 *     body.admin_token vs ARIA_ADMIN_TOKEN | SENTINEL_ADMIN_TOKEN | INTERNAL_WEBHOOK_SECRET; lib/admin-gate.cjs).
 *   - `execute` runs the action + params STORED on the approved write-gate record (read straight from the
 *     `aria-write-gate` Blobs store) — the caller can no longer substitute a different action or UPN — and
 *     the record is marked `executed` so one approval fires exactly once (no replay).
 *   - every Graph path segment is URL-encoded and charset-checked.
 */
const crypto = require('crypto');
const { redact } = require('./_pii-redact');
const { withBreaker } = require('./_circuit-breaker');
const { bearerFromEvent } = require('./_verify-bearer.cjs');
const { requireAdminToken, adminGateResponse } = require('./lib/admin-gate.cjs');

const SEG_RE = /^[A-Za-z0-9._@+\-]{1,256}$/;
function seg(v, label) {
  const s = String(v == null ? '' : v).trim();
  if (!s || !SEG_RE.test(s)) throw new Error((label || 'parameter') + ' invalid');
  return encodeURIComponent(s);
}
function guid(v, label) {
  const s = String(v == null ? '' : v).trim();
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) throw new Error((label || 'id') + ' must be a GUID');
  return s;
}

async function gateStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name: 'aria-write-gate', consistency: 'strong' });
  } catch (e) { return null; }
}

const TENANT = process.env.M365_TENANT_ID;
const CLIENT_ID = process.env.M365_CLIENT_ID;
const CLIENT_SECRET = process.env.M365_CLIENT_SECRET;

const SAFE_ACTIONS = new Set([
  'm365.password.reset',
  'm365.license.assign',
  'm365.license.remove',
  'm365.group.add_member',
  'm365.group.remove_member',
  'm365.user.disable',
  'm365.user.enable'
]);

let _tokenCache = { token: null, expires: 0 };

async function getGraphToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expires) return _tokenCache.token;
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) throw new Error('M365 env vars missing');

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const r = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const j = await r.json();
  if (!r.ok) throw new Error('token: ' + (j.error_description || j.error || 'unknown'));
  _tokenCache = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

async function callGraph(method, path, body) {
  return withBreaker('m365-graph', async () => {
    const token = await getGraphToken();
    const r = await fetch('https://graph.microsoft.com/v1.0' + path, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 204) return { ok: true };
    const j = await r.json();
    if (!r.ok) throw new Error('graph ' + r.status + ': ' + (j.error?.message || JSON.stringify(j)));
    return j;
  });
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'request').trim();

  if (!bearerFromEvent(event)) {
    const gate = requireAdminToken(event, { envNames: ['ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET'], body });
    if (!gate.ok) return adminGateResponse(gate, headers);
  }

  // === Phase 1: REQUEST — create write-gate ticket ===
  if (ev === 'request') {
    const action = String(body.action || '');
    if (!SAFE_ACTIONS.has(action)) {
      return ok({ ok: false, error: 'action_not_allowed', allowed: Array.from(SAFE_ACTIONS) });
    }
    // Forward to write-gate
    const base = process.env.SITE_BASE_URL || 'https://iisupp.net';
    const r = await fetch(base + '/.netlify/functions/aria-write-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'request',
        action,
        params: body.params || {},
        tenant_email: body.tenant_email,
        requested_by: body.requested_by || 'aria-m365-graph-write'
      })
    });
    const j = await r.json();
    return ok({ ok: j.ok !== false, request_id: j.request_id, status: 'pending', message: 'Approval requested. Ahmad must approve in email before execution.' });
  }

  // === Phase 2: EXECUTE — verify approval ON THE STORED RECORD, run its action once, mark executed ===
  if (ev === 'execute') {
    const requestId = String(body.request_id || '');
    if (!/^[a-f0-9]{24}$/.test(requestId)) return ok({ ok: false, error: 'request_id required' });

    const store = await gateStore();
    if (!store) return ok({ ok: false, error: 'gate_store_unavailable' });
    let rec = null;
    try { rec = await store.get('req-' + requestId, { type: 'json' }); } catch (e) { rec = null; }
    if (!rec) return ok({ ok: false, error: 'status_check_failed' });
    if (rec.status === 'executed') return ok({ ok: false, error: 'already_executed', executed_at: rec.executed_at || null });
    if (rec.status !== 'approved') return ok({ ok: false, error: 'not_approved', current_status: rec.status });
    if (rec.ttl_at && Date.now() > rec.ttl_at) return ok({ ok: false, error: 'approval_expired' });

    // The action + params come from the approved record — never from this request body.
    const action = String(rec.action || '');
    const params = rec.params && typeof rec.params === 'object' ? rec.params : {};
    if (!SAFE_ACTIONS.has(action)) return ok({ ok: false, error: 'action_not_allowed' });
    if (body.action && String(body.action) !== action) {
      console.warn('[m365-graph-write] execute ignored caller-supplied action', { request_id: requestId });
    }

    // Claim the record first so a concurrent replay cannot fire the same approval twice.
    rec.status = 'executing';
    rec.execute_started_at = Date.now();
    rec.execute_attempts = Number(rec.execute_attempts || 0) + 1;
    try { await store.setJSON('req-' + requestId, rec); } catch (e) { return ok({ ok: false, error: 'gate_store_unavailable' }); }

    try {
      let result;
      switch (action) {
        case 'm365.password.reset':
          result = await callGraph('POST', '/users/' + seg(params.user_principal_name, 'user_principal_name') + '/authentication/methods/' + (params.method_id ? seg(params.method_id, 'method_id') : 'passwordAuthenticationMethod/28c10230-6103-485e-b985-444c60001490') + '/resetPassword', {});
          break;
        case 'm365.license.assign':
          result = await callGraph('POST', '/users/' + seg(params.user_principal_name, 'user_principal_name') + '/assignLicense', {
            addLicenses: [{ skuId: guid(params.sku_id, 'sku_id'), disabledPlans: [] }],
            removeLicenses: []
          });
          break;
        case 'm365.license.remove':
          result = await callGraph('POST', '/users/' + seg(params.user_principal_name, 'user_principal_name') + '/assignLicense', {
            addLicenses: [],
            removeLicenses: [guid(params.sku_id, 'sku_id')]
          });
          break;
        case 'm365.group.add_member':
          result = await callGraph('POST', '/groups/' + seg(params.group_id, 'group_id') + '/members/$ref', {
            '@odata.id': 'https://graph.microsoft.com/v1.0/users/' + seg(params.user_id, 'user_id')
          });
          break;
        case 'm365.group.remove_member':
          result = await callGraph('DELETE', '/groups/' + seg(params.group_id, 'group_id') + '/members/' + seg(params.user_id, 'user_id') + '/$ref');
          break;
        case 'm365.user.disable':
          result = await callGraph('PATCH', '/users/' + seg(params.user_principal_name, 'user_principal_name'), { accountEnabled: false });
          break;
        case 'm365.user.enable':
          result = await callGraph('PATCH', '/users/' + seg(params.user_principal_name, 'user_principal_name'), { accountEnabled: true });
          break;
      }
      rec.status = 'executed';
      rec.executed_at = Date.now();
      rec.result_summary = result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : String(result).slice(0, 80);
      try { await store.setJSON('req-' + requestId, rec); } catch (e) { console.error('[m365-graph-write] could not persist executed state:', e.message); }
      return ok({ ok: true, action, result, executed_at: rec.executed_at, request_id: requestId });
    } catch (e) {
      console.error('[m365-graph-write] execute err:', e.message);
      // Release the claim so the operator can retry (bounded), but never expose upstream bodies.
      rec.status = rec.execute_attempts >= 3 ? 'execute_failed' : 'approved';
      rec.last_execute_error = String(e.message || 'error').slice(0, 200);
      try { await store.setJSON('req-' + requestId, rec); } catch {}
      const isInput = /invalid$|GUID$/.test(String(e.message || ''));
      return ok({ ok: false, error: isInput ? 'bad_params' : 'graph_call_failed', error_code: isInput ? 'bad_params' : 'graph_call_failed', retry_allowed: rec.status === 'approved' });
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
