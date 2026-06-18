/**
 * aria-breaker-status - expose process-local circuit breaker health.
 *
 * POST { event:'status' } returns current breaker states.
 * POST { event:'reset', key?, admin_token } resets breaker state after approval.
 */
'use strict';

const { getStatus, reset } = require('./_circuit-breaker');

function isAdmin(token) {
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return !!expected && token === expected;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  if ((body.event || 'status') === 'reset') {
    if (!isAdmin(body.admin_token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    reset(body.key || null);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reset: body.key || 'all', status: getStatus() }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, status: getStatus(), process_local: true }) };
};
