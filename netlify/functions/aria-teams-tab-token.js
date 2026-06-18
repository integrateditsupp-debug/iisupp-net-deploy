/**
 * aria-teams-tab-token - short-lived token for ARIA inside Teams static tab.
 *
 * Validates the Teams SSO bearer token through Microsoft Graph when available,
 * then returns a local HMAC-signed JWT scoped to the embedded tab session.
 */
'use strict';

const crypto = require('node:crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) {
    return { statusCode: 501, headers, body: JSON.stringify({ error: 'APERTURE_JWT_SECRET required' }) };
  }

  const bearer = getBearer(event, body);
  if (!bearer) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Teams SSO bearer token required' }) };
  }

  const identity = await getEntraIdToken(bearer);
  if (!identity.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: identity.error || 'Teams SSO validation failed' }) };
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({
    iss: 'iisupp.net',
    aud: 'aria-teams-tab',
    sub: identity.sub,
    name: identity.name,
    email: identity.email,
    tid: identity.tenant_id,
    iat: now,
    exp: now + 5 * 60,
    scope: ['aria:tab', 'aria:chat']
  }, secret);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, token, expires_in: 300, identity: { email: identity.email, tenant_id: identity.tenant_id } })
  };
};

async function getEntraIdToken(accessToken) {
  if (process.env.TEAMS_SSO_VALIDATION_DISABLED === 'true') {
    return { ok: true, sub: 'local-dev', email: 'local@example.com', name: 'Local Teams User', tenant_id: 'local' };
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    return { ok: false, error: 'invalid Teams SSO token' };
  }
  return {
    ok: true,
    sub: String(data.id),
    name: String(data.displayName || ''),
    email: String(data.mail || data.userPrincipalName || ''),
    tenant_id: parseJwtTenant(accessToken)
  };
}

function getBearer(event, body) {
  const headers = lowerCaseHeaders(event.headers || {});
  const auth = String(headers.authorization || '');
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return String(body.sso_token || body.access_token || '').trim();
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(encodedHeader + '.' + encodedPayload).digest();
  return encodedHeader + '.' + encodedPayload + '.' + base64url(sig);
}

function parseJwtTenant(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return '';
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return String(payload.tid || payload.tenantId || '');
  } catch (_error) {
    return '';
  }
}

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function lowerCaseHeaders(headers) {
  const out = {};
  Object.keys(headers || {}).forEach((key) => { out[String(key).toLowerCase()] = headers[key]; });
  return out;
}
