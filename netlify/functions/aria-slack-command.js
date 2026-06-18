/**
 * aria-slack-command - Slack /aria slash command receiver
 *
 * Slack POSTs a form-encoded payload: { text, user_name, response_url, ... }.
 * We acknowledge immediately, then send the richer reply through response_url.
 *
 * Round 6 hardening:
 * - verifies Slack signatures when SLACK_SIGNING_SECRET is configured
 * - keeps replies ephemeral by default to avoid channel-side PII leakage
 * - adds lightweight status/cost helper commands for operator use
 */
'use strict';

const crypto = require('node:crypto');
const { redact } = require('./_pii-redact');

const HELP_TEXT = [
  '*ARIA slash command*',
  '`/aria help` - show examples',
  '`/aria status` - open ARIA + status surfaces',
  '`/aria cost` - quick LLM budget snapshot',
  '`/aria <question>` - ask an IT/support question',
  '',
  'Examples:',
  '- `/aria outlook crashes on launch`',
  '- `/aria wifi connected but no internet`',
  '- `/aria teams camera not working`'
].join('\n');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const verified = verifySlackRequest(event);
  if (!verified.ok) {
    return {
      statusCode: verified.statusCode,
      headers,
      body: JSON.stringify({ response_type: 'ephemeral', text: verified.message })
    };
  }

  const params = new URLSearchParams(event.body || '');
  const text = (params.get('text') || '').trim();
  const userName = (params.get('user_name') || 'someone').trim();
  const channelId = params.get('channel_id') || '';
  const responseUrl = params.get('response_url') || '';
  const teamId = params.get('team_id') || '';
  const baseUrl = inferBaseUrl(event);

  console.log(
    '[aria-slack]',
    JSON.stringify({
      team: teamId,
      user: userName,
      channel: channelId,
      text: redact(text).slice(0, 200)
    })
  );

  if (!text) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response_type: 'ephemeral', text: HELP_TEXT })
    };
  }

  const command = text.toLowerCase();
  if (command === 'help' || command === '--help') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response_type: 'ephemeral', text: HELP_TEXT })
    };
  }

  if (responseUrl) {
    deliverDeepReply({ responseUrl, text, userName, baseUrl }).catch((error) => {
      console.warn('[aria-slack] deep reply err:', error.message);
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      response_type: 'ephemeral',
      text: 'ARIA is looking at "' + text.slice(0, 120) + '". Reply incoming in a moment...'
    })
  };
};

async function deliverDeepReply({ responseUrl, text, userName, baseUrl }) {
  const q = text.toLowerCase();

  if (q === 'status') {
    return sendSlackResponse(responseUrl, [
      '*ARIA operator surfaces*',
      '<' + baseUrl + '/aria|Open ARIA>',
      '<' + baseUrl + '/status|Open status page>',
      '<' + baseUrl + '/aperture-learning.html|Open Aperture learning>'
    ].join('\n'));
  }

  if (q === 'cost') {
    try {
      const status = await postJson(baseUrl + '/.netlify/functions/aria-cost-tracker', { event: 'status' });
      const byModel = Object.keys(status.by_model || {});
      const summary = [
        '*ARIA cost status*',
        'Month: `' + (status.month || 'unknown') + '`',
        'Spend: `$' + safeNumber(status.total_usd) + '` of `$' + safeNumber(status.cap_usd) + '`',
        'Cap used: `' + safeNumber(status.pct_of_cap) + '%`',
        'Models tracked: ' + (byModel.length ? byModel.join(', ') : 'none yet')
      ].join('\n');
      return sendSlackResponse(responseUrl, summary);
    } catch (error) {
      return sendSlackResponse(
        responseUrl,
        'I could not read the cost tracker right now. Check `' + baseUrl + '/.netlify/functions/aria-cost-tracker` manually.'
      );
    }
  }

  const intent = classifyIntent(q);
  const hints = {
    password: '*Password / sign-in:* Try aka.ms/sspr for self-serve reset if your org enabled it. Admin path: Entra 