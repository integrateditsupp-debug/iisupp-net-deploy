/**
 * aria-slack-interactive - Slack interactive component receiver for ARIA.
 *
 * Handles buttons and modal submissions. Verifies Slack signatures when
 * SLACK_SIGNING_SECRET is configured and returns within Slack's 3s window.
 */
'use strict';

const crypto = require('node:crypto');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const verified = verifySlackRequest(event);
  if (!verified.ok) {
    return { statusCode: verified.statusCode, headers, body: JSON.stringify({ error: verified.message }) };
  }

  const payload = parsePayload(event.body || '');
  if (!payload.ok) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: payload.error }) };
  }

  const body = payload.value;
  if (body.type === 'url_verification') {
    return { statusCode: 200, headers, body: JSON.stringify({ challenge: body.challenge || '' }) };
  }

  if (body.type === 'block_actions') {
    const action = (body.actions && body.actions[0]) || {};
    const response = handleButton(action, body);
    if (body.response_url) {
      postResponseUrl(body.response_url, response).catch((error) => {
        console.warn('[aria-slack-interactive] response_url failed:', error.message);
      });
    }
    return { statusCode: 200, headers, body: JSON.stringify(response) };
  }

  if (body.type === 'view_submission') {
    return { statusCode: 200, headers, body: JSON.stringify({ response_action: 'clear' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: body.type || 'unknown' }) };
};

function handleButton(action, payload) {
  const id = String(action.action_id || action.value || '').toLowerCase();
  const baseUrl = 'https://iisupp.net';
  const userId = payload.user && payload.user.id ? '<@' + payload.user.id + '>' : 'User';

  if (id.includes('approve')) {
    return {
      response_type: 'ephemeral',
      replace_original: false,
      text: userId + ' approved the staged fix. ARIA will keep this as an audit-gated operator action, not an automatic production change.'
    };
  }

  if (id.includes('escalate') || id.includes('human')) {
    return {
      response_type: 'ephemeral',
      replace_original: false,
      text: 'Escalation noted. Open the human handoff path here: ' + baseUrl + '/aria'
    };
  }

  if (id.includes('open') || id.includes('aria')) {
    return {
      response_type: 'ephemeral',
      replace_original: false,
      text: 'Open ARIA chat: ' + baseUrl + '/aria'
    };
  }

  return {
    response_type: 'ephemeral',
    replace_original: false,
    text: 'ARIA received the action. If this should change tenant data, route it through the approval gate first.'
  };
}

function parsePayload(rawBody) {
  const raw = String(rawBody || '');
  if (!raw) return { ok: true, value: {} };
  if (raw.trim().startsWith('{')) {
    try { return { ok: true, value: JSON.parse(raw) }; } catch (_error) { return { ok: false, error: 'invalid JSON' }; }
  }
  const params = new URLSearchParams(raw);
  const payload = params.get('payload') || '';
  if (!payload) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(payload) };
  } catch (_error) {
    return { ok: false, error: 'invalid payload JSON' };
  }
}

async function postResponseUrl(responseUrl, payload) {
  const response = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Slack response_url failed ' + response.status);
  return true;
}

function verifySlackRequest(event) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return { ok: true, skipped: true };

  const headers = lowerCaseHeaders(event.headers || {});
  const timestamp = headers['x-slack-request-timestamp'];
  const signature = headers['x-slack-signature'];
  if (!timestamp || !signature) {
    return { ok: false, statusCode: 401, message: 'Slack signature missing' };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) {
    return { ok: false, statusCode: 401, message: 'Slack request timestamp expired' };
  }

  const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update('v0:' + timestamp + ':' + (event.body || '')).digest('hex');
  try {
    const left = Buffer.from(signature, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      return { ok: false, statusCode: 401, message: 'Slack signature mismatch' };
    }
  } catch (_error) {
    return { ok: false, statusCode: 401, message: 'Slack signature invalid' };
  }
  return { ok: true };
}

function lowerCaseHeaders(headers) {
  const out = {};
  Object.keys(headers || {}).forEach((key) => { out[String(key).toLowerCase()] = headers[key]; });
  return out;
}
