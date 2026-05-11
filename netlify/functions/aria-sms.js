// netlify/functions/aria-sms.js
// Outbound SMS for ARIA voice agent. Dormant if Twilio envs missing.
// Auth: shared X-ARIA-Tool-Secret header matching ARIA_TOOL_SECRET env.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return j(405, { error: 'POST required' });
  }

  const required = process.env.ARIA_TOOL_SECRET;
  if (required) {
    const provided = event.headers['x-aria-tool-secret'] || event.headers['X-ARIA-Tool-Secret'];
    if (provided !== required) return j(401, { error: 'Unauthorized' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const to = String(body.to || '').trim();
  const text = String(body.body || '').trim();
  if (!to || !text) return j(400, { error: 'to + body required' });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !tok || !from) {
    console.log('[aria-sms] DORMANT (no Twilio envs):', { to: to, preview: text.slice(0, 80) });
    return j(200, { ok: true, dormant: true, note: 'Twilio not configured; message logged only' });
  }

  try {
    const params = new URLSearchParams();
    params.set('To', to);
    params.set('From', from);
    params.set('Body', text.slice(0, 1600));
    const auth = Buffer.from(sid + ':' + tok).toString('base64');
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await r.json().catch(function(){ return {}; });
    if (!r.ok) {
      console.error('[aria-sms] Twilio error', r.status, data);
      return j(502, { error: 'SMS send failed', detail: data.message || ('HTTP ' + r.status) });
    }
    return j(200, { ok: true, sid: data.sid });
  } catch (e) {
    console.error('[aria-sms] error:', e && e.message);
    return j(500, { error: 'SMS service error' });
  }
};

function j(status, body) {
  return { statusCode: status, headers: Object.assign(cors(), { 'content-type': 'application/json' }), body: JSON.stringify(body) };
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type,x-aria-tool-secret',
  };
}
