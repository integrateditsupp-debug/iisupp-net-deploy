/**
 * aria-slack-events - Slack Events API receiver for ARIA.
 *
 * Handles URL verification, app_mention, and message.im. Verifies Slack
 * signatures when SLACK_SIGNING_SECRET is configured and ACKs fast.
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

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  if (body.type === 'url_verification') {
    return { statusCode: 200, headers, body: JSON.stringify({ challenge: body.challenge || '' }) };
  }

  if (body.type !== 'event_callback' || !body.event) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: true }) };
  }

  const slackEvent = body.event;
  if (slackEvent.bot_id || slackEvent.subtype) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: 'bot_or_subtype' }) };
  }

  if (slackEvent.type === 'app_mention' || slackEvent.type === 'message') {
    const isDirectMessage = slackEvent.channel_type === 'im';
    if (slackEvent.type === 'message' && !isDirectMessage) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: 'non_dm_message' }) };
    }
    deliverSlackEventReply({ slackEvent, baseUrl: inferBaseUrl(event) }).catch((error) => {
      console.warn('[aria-slack-events] reply failed:', error.message);
    });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ack: true }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: slackEvent.type }) };
};

async function deliverSlackEventReply({ slackEvent, baseUrl }) {
  const text = stripSlackMention(slackEvent.text || '');
  const channel = slackEvent.channel;
  const threadTs = slackEvent.thread_ts || slackEvent.ts;
  if (!channel) return false;
  const reply = buildReply(text, baseUrl);
  return postSlackMessage({ channel, text: reply, threadTs });
}

function buildReply(text, baseUrl) {
  const q = String(text || '').trim();
  if (!q || /^help$/i.test(q)) {
    return [
      '*ARIA in Slack*',
      'Ask me a short IT support question in a DM or mention.',
      'Examples: `Outlook will not open`, `VPN connects but apps fail`, `Teams mic not working`.',
      '<' + baseUrl + '/aria|Open full ARIA chat>'
    ].join('\n');
  }

  const hints = {
    password: '*Password / sign-in:* try self-service reset first; escalate if MFA or account lock blocks recovery.',
    mfa: '*MFA:* re-register methods only after approved identity verification.',
    mail: '*Outlook / mail:* try webmail and Outlook safe mode to isolate mailbox vs desktop profile.',
    vpn: '*VPN:* reconnect, restart the client, and compare DNS/internal-app access before escalating gateway health.',
    wifi: '*Wi-Fi:* compare one device vs all devices, then power-cycle network gear if the whole site is affected.',
    teams: '*Teams:* check selected devices, browser version, and cache if web works but desktop fails.',
    onedrive: '*OneDrive / SharePoint:* pause/resume sync, then reset OneDrive if it remains stuck.',
    printer: '*Printer:* clear queue, restart spooler, then confirm mapped printer and driver.',
    general: 'Send the app, device, exact error, and what changed. I can give a tighter first fix.'
  };
  const intent = classifyIntent(q.toLowerCase());
  return [
    hints[intent] || hints.general,
    '',
    '<' + baseUrl + '/aria|Open ARIA for a guided diagnostic>'
  ].join('\n');
}

async function postSlackMessage({ channel, text, threadTs }) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log('[aria-slack-events] SLACK_BOT_TOKEN not configured; reply preview:', text);
    return false;
  }
  const payload = { channel, text, unfurl_links: false, unfurl_media: false };
  if (threadTs) payload.thread_ts = threadTs;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'chat.postMessage failed');
  }
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

function stripSlackMention(text) {
  return String(text || '').replace(/<@[A-Z0-9]+>/gi, '').replace(/\s+/g, ' ').trim();
}

function classifyIntent(q) {
  if (/password|locked|sign[- ]in|log[- ]in/.test(q)) return 'password';
  if (/mfa|2fa|authenticator/.test(q)) return 'mfa';
  if (/outlook|email|mail|inbox/.test(q)) return 'mail';
  if (/vpn|tunnel|globalprotect|anyconnect/.test(q)) return 'vpn';
  if (/wifi|wi-fi|wireless|network|internet/.test(q)) return 'wifi';
  if (/teams|microsoft teams|microphone|camera/.test(q)) return 'teams';
  if (/onedrive|sharepoint|sync/.test(q)) return 'onedrive';
  if (/print|printer/.test(q)) return 'printer';
  return 'general';
}

function inferBaseUrl(event) {
  const headers = lowerCaseHeaders(event.headers || {});
  const origin = headers.origin || headers.referer;
  if (origin) {
    try { return new URL(origin).origin.replace(/\/$/, ''); } catch (_error) {}
  }
  return 'https://iisupp.net';
}

function lowerCaseHeaders(headers) {
  const out = {};
  Object.keys(headers || {}).forEach((key) => { out[String(key).toLowerCase()] = headers[key]; });
  return out;
}
