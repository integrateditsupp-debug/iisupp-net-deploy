// axis-bridge.cjs — backup brain for AXIS when the Claude account or the local worker is unavailable.
// Calls the XO Agency bridge (Aria's voice + reasoning). Access is proven with an Aperture staff token:
// the caller's own token when there is one, otherwise a 5-minute service token signed with
// APERTURE_JWT_SECRET (scheduled jobs). No new secret is needed.
const crypto = require('node:crypto');

const BRIDGE_URL = () => process.env.AXIS_BRIDGE_URL || 'https://xoagency.lovable.app/api/public/axis-bridge';
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function serviceToken() {
  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) return '';
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: 'axis-service', role: 'service', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 }));
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${h}.${p}.${s}`;
}

/** Returns reply text, or null when the bridge is unavailable. Never throws. */
async function bridgeChat({ system, messages, maxTokens = 1200, auth = '' }) {
  try {
    const authorization = /^Bearer\s+\S+/i.test(auth || '') ? auth : (serviceToken() ? `Bearer ${serviceToken()}` : '');
    if (!authorization) return null;
    const r = await fetch(BRIDGE_URL(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization, origin: 'https://iisupp.net' },
      body: JSON.stringify({ action: 'chat', system, messages, max_tokens: maxTokens }),
    });
    if (!r.ok) { console.warn('[axis-bridge] chat', r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json();
    return j && j.text ? String(j.text) : null;
  } catch (e) { console.warn('[axis-bridge] unreachable', e.message); return null; }
}

module.exports = { bridgeChat, serviceToken, BRIDGE_URL };
