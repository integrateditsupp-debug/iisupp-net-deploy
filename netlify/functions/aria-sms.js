// netlify/functions/aria-sms.js
// Outbound SMS for ARIA voice agent. Dormant if Twilio envs missing.
// Auth: shared X-ARIA-Tool-Secret header matching ARIA_TOOL_SECRET env (or X-Internal-Token =
// INTERNAL_WEBHOOK_SECRET). 2026-10-08: FAIL-CLOSED (503 when neither is configured — it used to pass
// every caller when ARIA_TOOL_SECRET was unset), constant-time compare, and the Twilio call now goes
// through lib/notify.mjs sendSms() so the dormant path is honest: {ok:false, dormant:true}.
const { requireAdminToken, adminGateResponse } = require('./lib/admin-gate.cjs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return j(405, { error: 'POST required' });
  }

  const gate = requireAdminToken(event, { envNames: ['ARIA_TOOL_SECRET', 'INTERNAL_WEBHOOK_SECRET'], allowBodyToken: false });
  if (!gate.ok) return adminGateResponse(gate, cors());

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return j(400, { error: 'Invalid JSON' }); }

  const to = String(body.to || '').trim();
  const text = String(body.body || '').trim();
  if (!to || !text) return j(400, { error: 'to + body required' });

  try {
    const { sendSms, hashIdentity } = await import('./lib/notify.mjs');
    const r = await sendSms({ to, body: text, tag: 'aria-sms' });
    if (r.dormant) {
      console.log('[aria-sms] DORMANT (no Twilio envs):', { to_hash: hashIdentity(to), chars: text.length });
      // Honest: nothing was sent. 200 so tool callers do not retry forever; ok:false + sent:false say what happened.
      return j(200, { ok: false, sent: false, dormant: true, note: 'Twilio not configured; message NOT sent (logged only)' });
    }
    if (!r.ok) {
      return j(502, { ok: false, sent: false, error: 'SMS send failed', error_code: 'twilio_failed' });
    }
    return j(200, { ok: true, sent: true, sid: r.sid });
  } catch (e) {
    console.error('[aria-sms] error:', e && e.message);
    return j(500, { ok: false, sent: false, error: 'SMS service error' });
  }
};

function j(status, body) {
  return { statusCode: status, headers: Object.assign(cors(), { 'content-type': 'application/json' }), body: JSON.stringify(body) };
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type,x-aria-tool-secret,x-internal-token',
  };
}
