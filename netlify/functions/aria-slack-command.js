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
    password: '*Password / sign-in:* Try aka.ms/sspr for self-serve reset if your org enabled it. Admin path: Entra ID -> Users -> Password reset.',
    mfa: '*MFA:* If you lost your device, admin must re-register MFA from Entra ID -> Users -> Authentication methods, then re-add via aka.ms/mfasetup.',
    mail: '*Outlook / mail:* Try safe mode first. Ctrl+click Outlook -> Yes to safe mode. If it opens, disable COM add-ins one by one.',
    vpn: '*VPN:* Disconnect -> reconnect. If it still hangs, restart the VPN client process. If connected-but-no-internet, test a different DNS resolver.',
    wifi: '*Wi-Fi:* Forget the network -> reconnect. Restart the wireless adapter. If possible, switch between 2.4GHz and 5GHz to isolate band issues.',
    teams: '*Teams:* Close Teams -> clear `%appdata%\\\\Microsoft\\\\Teams` contents -> relaunch. If web works but desktop fails, it is usually cache or profile state.',
    onedrive: '*OneDrive / SharePoint:* Run `%localappdata%\\\\Microsoft\\\\OneDrive\\\\onedrive.exe /reset`, wait 2 minutes, then launch OneDrive again.',
    printer: '*Printer:* Restart the print spooler, clear `C:\\\\Windows\\\\System32\\\\spool\\\\PRINTERS`, then remove/re-add the printer if jobs still stick.',
    general: 'Your question spans multiple areas. Ask with a tighter symptom, or open the full ARIA chat for a longer diagnostic walk-through.'
  };

  const reply = [
    'Hey ' + userName + ', here is the first move I would try:',
    '',
    hints[intent] || hints.general,
    '',
    'Want the longer path? <' + baseUrl + '/aria|Open ARIA chat>.'
  ].join('\n');

  return sendSlackResponse(responseUrl, reply);
}

function verifySlackRequest(event) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return { ok: true };
  }

  const headers = lowerCaseHeaders(event.headers || {});
  const timestamp = headers['x-slack-request-timestamp'];
  const signature = headers['x-slack-signature'];
  if (!timestamp || !signature) {
    return { ok: false, statusCode: 401, message: 'Slack signature missing.' };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) {
    return { ok: false, statusCode: 401, message: 'Slack request timestamp expired.' };
  }

  const base = 'v0:' + timestamp + ':' + (event.body || '');
  const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  try {
    const left = Buffer.from(signature, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      return { ok: false, statusCode: 401, message: 'Slack signature mismatch.' };
    }
  } catch (_error) {
    return { ok: false, statusCode: 401, message: 'Slack signature invalid.' };
  }

  return { ok: true };
}

function inferBaseUrl(event) {
  const headers = lowerCaseHeaders(event.headers || {});
  const origin = headers.origin || headers.referer;
  if (origin) {
    try {
      const url = new URL(origin);
      return url.origin.replace(/\/$/, '');
    } catch (_error) {
      // fall through
    }
  }
  return 'https://iisupp.net';
}

function lowerCaseHeaders(headers) {
  const out = {};
  Object.keys(headers || {}).forEach((key) => {
    out[String(key).toLowerCase()] = headers[key];
  });
  return out;
}

function classifyIntent(q) {
  if (/password|locked|sign[- ]in|log[- ]in/.test(q)) return 'password';
  if (/mfa|2fa|authenticator/.test(q)) return 'mfa';
  if (/outlook|email|mail|inbox/.test(q)) return 'mail';
  if (/vpn|tunnel|globalprotect|anyconnect/.test(q)) return 'vpn';
  if (/wifi|wi-fi|wireless|network|internet/.test(q)) return 'wifi';
  if (/teams|microsoft teams/.test(q)) return 'teams';
  if (/onedrive|sharepoint|sync/.test(q)) return 'onedrive';
  if (/print|printer/.test(q)) return 'printer';
  return 'general';
}

function safeNumber(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || response.statusText || 'request failed');
  }
  return data;
}

async function sendSlackResponse(responseUrl, text) {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'ephemeral',
      replace_original: false,
      text
    })
  });
}
