/**
 * aria-teams-bot - Microsoft Teams Bot Framework message receiver.
 *
 * ACKs Teams activity posts immediately and sends a short support reply through
 * the Bot Framework conversation API when bot credentials are configured.
 */
'use strict';

const HELP_TEXT = [
  'ARIA Teams bot',
  'Ask a short IT support question, for example:',
  '- Outlook will not open',
  '- Teams microphone not working',
  '- VPN connects but apps cannot load'
].join('\n');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let activity;
  try {
    activity = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  if (!activity.type) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: 'empty_activity' }) };
  }

  if (activity.type !== 'message') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ignored: activity.type }) };
  }

  const text = cleanTeamsText(activity.text || '');
  const serviceUrl = String(activity.serviceUrl || '');
  const conversationId = activity.conversation && activity.conversation.id;
  const reply = buildReply(text, inferBaseUrl(event));

  postTeamsReply({ serviceUrl, conversationId, reply }).catch((error) => {
    console.warn('[aria-teams-bot] reply failed:', error.message);
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, ack: true, intent: classifyIntent(text.toLowerCase()) })
  };
};

function buildReply(text, baseUrl) {
  const q = String(text || '').trim();
  if (!q || /^help$/i.test(q)) return HELP_TEXT + '\n\nOpen ARIA: ' + baseUrl + '/aria';

  const intent = classifyIntent(q.toLowerCase());
  const hints = {
    password: 'Password or sign-in: try self-service reset first, then escalate if MFA or account lock blocks access.',
    mfa: 'MFA: re-register the authenticator only after approved identity verification.',
    mail: 'Outlook or mail: try Outlook safe mode, then check webmail to separate desktop profile from mailbox health.',
    vpn: 'VPN: disconnect, restart the VPN client, and test DNS or split-tunnel symptoms before escalating gateway health.',
    wifi: 'Wi-Fi or internet: compare one device vs all devices, then power-cycle network gear if the whole site is affected.',
    teams: 'Teams: check selected microphone/speaker/camera, then clear Teams cache if web works but desktop fails.',
    onedrive: 'OneDrive or SharePoint: pause and resume sync, then reset OneDrive if it stays stuck.',
    printer: 'Printer: clear stuck jobs, restart the spooler, and confirm the user is mapped to the right queue.',
    general: 'I need one tighter symptom to give a precise first fix. Include app, device, error text, and what changed.'
  };

  return [
    hints[intent] || hints.general,
    '',
    'For a longer diagnostic path, open ARIA: ' + baseUrl + '/aria'
  ].join('\n');
}

async function postTeamsReply({ serviceUrl, conversationId, reply }) {
  if (!serviceUrl || !conversationId) return false;
  const token = await getBotFrameworkToken();
  if (!token) return false;

  const url = serviceUrl.replace(/\/$/, '') + '/v3/conversations/' + encodeURIComponent(conversationId) + '/activities';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'message', text: reply })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error('Bot Framework reply failed ' + response.status + ' ' + text.slice(0, 160));
  }
  return true;
}

async function getBotFrameworkToken() {
  const appId = process.env.TEAMS_BOT_APP_ID || process.env.MICROSOFT_APP_ID;
  const appPassword = process.env.TEAMS_BOT_APP_PASSWORD || process.env.MICROSOFT_APP_PASSWORD;
  if (!appId || !appPassword) return '';

  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');
  params.set('client_id', appId);
  params.set('client_secret', appPassword);
  params.set('scope', 'https://api.botframework.com/.default');

  const response = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('token request failed ' + response.status + ': ' + (data.error_description || data.error || 'unknown'));
  }
  return data.access_token || '';
}

function cleanTeamsText(text) {
  return String(text || '')
    .replace(/<at>.*?<\/at>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
