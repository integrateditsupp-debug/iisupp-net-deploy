/**
 * aria-m365-graph — Microsoft Graph read-only scaffold (v0.1, 2026-06-18)
 *
 *  Purpose: turn ARIA from advisor into operator. Read-only first — list
 *  users, get a user, check licenses, list groups, list devices. Write
 *  operations come in v0.2 with explicit approval gates per scenario.
 *
 *  Auth: client-credentials flow (app-only, no user delegation).
 *  Required Azure AD app registration with these Graph permissions:
 *    - User.Read.All
 *    - Group.Read.All
 *    - Directory.Read.All
 *    - DeviceManagementManagedDevices.Read.All (for Intune scenarios)
 *
 *  Required Netlify env vars (PER TENANT — each customer's tenant):
 *    M365_TENANT_ID         (the customer's Azure AD tenant id)
 *    M365_CLIENT_ID         (IIS's app registration client id)
 *    M365_CLIENT_SECRET     (IIS's app registration client secret)
 *
 *  Multi-tenant pattern: in production, store per-customer tenant_id
 *  separately (keyed by ARIA account_id) and have the customer admin
 *  do an admin-consent grant. For MVP scaffold, single-tenant only.
 *
 *  POST /.netlify/functions/aria-m365-graph
 *    Body: { action: 'list-users' | 'get-user' | 'check-license' |
 *                    'list-groups' | 'list-devices' | 'health-check',
 *            params: {...} }
 *    Returns: { ok, data, count } or { error }
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const action = String(body.action || '').trim();
  const params = body.params || {};

  // Health check — no auth required, doesn't hit Graph
  if (action === 'health-check') {
    const hasTenant = !!process.env.M365_TENANT_ID;
    const hasClient = !!process.env.M365_CLIENT_ID;
    const hasSecret = !!process.env.M365_CLIENT_SECRET;
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      version: '0.1',
      ready: hasTenant && hasClient && hasSecret,
      env: {
        M365_TENANT_ID: hasTenant ? 'set' : 'MISSING',
        M365_CLIENT_ID: hasClient ? 'set' : 'MISSING',
        M365_CLIENT_SECRET: hasSecret ? 'set' : 'MISSING'
      },
      available_actions: ['list-users', 'get-user', 'check-license', 'list-groups', 'list-devices', 'health-check'],
      notes: hasTenant && hasClient && hasSecret
        ? 'All env vars set. Run a real action to test Graph connectivity.'
        : 'Set the missing env vars in Netlify to enable Graph calls.'
    }) };
  }

  const tenantId = process.env.M365_TENANT_ID;
  const clientId = process.env.M365_CLIENT_ID;
  const clientSecret = process.env.M365_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    return { statusCode: 503, headers, body: JSON.stringify({
      error: 'Graph credentials not configured — run health-check to see which env vars are missing'
    }) };
  }

  // Get an access token via client credentials flow
  let token;
  try { token = await getGraphToken(tenantId, clientId, clientSecret); }
  catch (e) { return { statusCode: 502, headers, body: JSON.stringify({ error: 'token fetch failed: ' + e.message }) }; }

  try {
    let result;
    switch (action) {
      case 'list-users': {
        const top = Math.min(Number(params.top || 25), 100);
        const r = await graphGet(token, '/users?$top=' + top + '&$select=id,displayName,userPrincipalName,mail,accountEnabled');
        result = { count: (r.value || []).length, users: r.value || [] };
        break;
      }
      case 'get-user': {
        const upn = String(params.upn || params.email || '');
        if (!upn) throw new Error('upn or email required');
        const r = await graphGet(token, '/users/' + encodeURIComponent(upn) + '?$select=id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled,assignedLicenses,signInActivity');
        result = { user: r };
        break;
      }
      case 'check-license': {
        const upn = String(params.upn || params.email || '');
        if (!upn) throw new Error('upn or email required');
        const r = await graphGet(token, '/users/' + encodeURIComponent(upn) + '/licenseDetails');
        result = { count: (r.value || []).length, licenses: r.value || [] };
        break;
      }
      case 'list-groups': {
        const top = Math.min(Number(params.top || 25), 100);
        const r = await graphGet(token, '/groups?$top=' + top + '&$select=id,displayName,mail,description,groupTypes,securityEnabled');
        result = { count: (r.value || []).length, groups: r.value || [] };
        break;
      }
      case 'list-devices': {
        const top = Math.min(Number(params.top || 25), 100);
        const r = await graphGet(token, '/deviceManagement/managedDevices?$top=' + top + '&$select=id,deviceName,userPrincipalName,operatingSystem,osVersion,complianceState,lastSyncDateTime');
        result = { count: (r.value || []).length, devices: r.value || [] };
        break;
      }
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown action: ' + action }) };
    }
    console.log('[aria-m365-graph] action=' + action + ' ok');
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action, data: result }) };
  } catch (e) {
    console.error('[aria-m365-graph] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

async function getGraphToken(tenantId, clientId, clientSecret) {
  const url = 'https://login.microsoftonline.com/' + encodeURIComponent(tenantId) + '/oauth2/v2.0/token';
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error('token endpoint ' + r.status + ': ' + text.slice(0, 200));
  }
  const j = await r.json();
  if (!j.access_token) throw new Error('no access_token in response');
  return j.access_token;
}

async function graphGet(token, path) {
  const url = 'https://graph.microsoft.com/v1.0' + path;
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error('Graph GET ' + path + ' -> ' + r.status + ': ' + text.slice(0, 200));
  }
  return r.json();
}
