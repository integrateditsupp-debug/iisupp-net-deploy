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
 */
const crypto = require('crypto');
const { redact } = require('./_pii-redact');
const { withBreaker } = require('./_circuit-breaker');

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

  // === Phase 2: EXECUTE — verify approval, then call Graph ===
  if (ev === 'execute') {
    const requestId = String(body.request_id || '');
    if (!requestId) return ok({ ok: false, error: 'request_id required' });

    const base = process.env.SITE_BASE_URL || 'https://iisupp.net';
    const r = await fetch(base + '/.netlify/functions/aria-write-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'status', request_id: requestId })
    });
    const status = await r.json();
    if (!status.ok) return ok({ ok: false, error: 'status_check_failed' });
    if (status.status !== 'approved') {
      return ok({ ok: false, error: 'not_approved', current_status: status.status });
    }

    // Re-fetch the original request to get action + params (would store in audit log)
    // For v0.1, require caller to re-send action + params
    const action = String(body.action || '');
    const params = body.params || {};
    if (!SAFE_ACTIONS.has(action)) return ok({ ok: false, error: 'action_not_allowed' });

    try {
      let result;
      switch (action) {
        case 'm365.password.reset':
          result = await callGraph('POST', '/users/' + encodeURIComponent(params.user_principal_name) + '/authentication/methods/' + (params.method_id || 'passwordAuthenticationMethod/28c10230-6103-485e-b985-444c60001490') + '/resetPassword', {});
          break;
        case 'm365.license.assign':
          result = await callGraph('POST', '/users/' + encodeURIComponent(params.user_principal_name) + '/assignLicense', {
            addLicenses: [{ skuId: params.sku_id, disabledPlans: [] }],
            removeLicenses: []
          });
          break;
        case 'm365.license.remove':
          result = await callGraph('POST', '/users/' + encodeURIComponent(params.user_principal_name) + '/assignLicense', {
            addLicenses: [],
            removeLicenses: [params.sku_id]
          });
          break;
        case 'm365.group.add_member':
          result = await callGraph('POST', '/groups/' + params.group_id + '/members/$ref', {
            '@odata.id': 'https://graph.microsoft.com/v1.0/users/' + params.user_id
          });
          break;
        case 'm365.group.remove_member':
          result = await callGraph('DELETE', '/groups/' + params.group_id + '/members/' + params.user_id + '/$ref');
          break;
        case 'm365.user.disable':
          result = await callGraph('PATCH', '/users/' + encodeURIComponent(params.user_principal_name), { accountEnabled: false });
          break;
        case 'm365.user.enable':
          result = await callGraph('PATCH', '/users/' + encodeURIComponent(params.user_principal_name), { accountEnabled: true });
          break;
      }
      return ok({ ok: true, action, result, executed_at: Date.now() });
    } catch (e) {
      console.error('[m365-graph-write] execute err:', e.message);
      return ok({ ok: false, error: 'graph_call_failed', detail: e.message });
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
