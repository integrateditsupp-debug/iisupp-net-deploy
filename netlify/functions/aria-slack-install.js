/**
 * aria-slack-install - safe Slack install staging endpoint.
 *
 * POST { event:'authorize_url', state } returns the Slack OAuth URL.
 * GET with ?code=... stages callback info. Token exchange is disabled unless
 * SLACK_INSTALL_EXCHANGE_ENABLED=true to avoid accidental workspace installs.
 */
'use strict';

const crypto = require('crypto');
const { fetchWithRetry } = require('./_retry');

function baseUrl(event) {
  const host = (event.headers && (event.headers.host || event.headers.Host)) || 'iisupp.net';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return proto + '://' + host + '/.netlify/functions/aria-slack-install';
}

function signState(state) {
  const secret = process.env.SLACK_STATE_SECRET || process.env.APERTURE_JWT_SECRET || 'dev-only';
  return crypto.createHmac('sha256', secret).update(String(state || '')).digest('hex').slice(0, 18);
}

function buildAuthorizeUrl(event, state) {
  const clientId = process.env.SLACK_CLIENT_ID || 'SLACK_CLIENT_ID_REQUIRED';
  const scopes = process.env.SLACK_SCOPES || 'commands,chat:write,app_mentions:read';
  const userScopes = process.env.SLACK_USER_SCOPES || '';
  const signedState = String(state || 'install') + '.' + signState(state || 'install');
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);
  if (userScopes) url.searchParams.set('user_scope', userScopes);
  url.searchParams.set('state', signedState);
  url.searchParams.set('redirect_uri', baseUrl(event));
  return url.toString();
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

    if ((body.event || 'authorize_url') !== 'authorize_url') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        authorize_url: buildAuthorizeUrl(event, body.state || 'install'),
        final_action_required: 'Ahmad or the workspace owner must click Allow in Slack.'
      })
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET or POST only' }) };
  }

  const qs = event.queryStringParameters || {};
  if (qs.error) {
    return html('Slack install not completed', 'Slack returned: ' + escapeHtml(qs.error));
  }
  if (!qs.code) {
    return html('Slack install staging', 'Use POST event authorize_url to create an install URL.');
  }

  if (process.env.SLACK_INSTALL_EXCHANGE_ENABLED !== 'true') {
    return html(
      'Slack callback staged',
      'A Slack authorization code was received. Token exchange is disabled until SLACK_INSTALL_EXCHANGE_ENABLED=true is set after CEO approval.'
    );
  }

  try {
    const params = new URLSearchParams();
    params.set('client_id', process.env.SLACK_CLIENT_ID || '');
    params.set('client_secret', process.env.SLACK_CLIENT_SECRET || '');
    params.set('code', qs.code);
    params.set('redirect_uri', baseUrl(event));
    const response = await fetchWithRetry('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    }, { attempts: 3 });
    const data = await response.json();
    return html(data.ok ? 'Slack install complete' : 'Slack install failed', escapeHtml(JSON.stringify(data, null, 2)));
  } catch (error) {
    return html('Slack install failed', escapeHtml(error.message || String(error)));
  }
};

function html(title, body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: '<!doctype html><html><body style="font-family:system-ui;background:#050505;color:#f8f1dd;padding:48px"><h1>' +
      escapeHtml(title) + '</h1><p>' + body + '</p><p><a style="color:#f1dca7" href="/">Return to IIS</a></p></body></html>'
  };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function (ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}
