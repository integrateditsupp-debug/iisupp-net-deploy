/**
 * aria-magic-link — Passwordless sign-in via email link (Cat 5 Account mgmt).
 *  POST { event: 'request', email } -> sends magic link
 *  POST { event: 'verify', token } -> returns { ok, email, expires_at }
 *
 *  HMAC-signed token (HS256-like) using APERTURE_JWT_SECRET. TTL 15 min.
 *  No DB — token self-contains email + expiry + signature.
 */
const crypto = require('node:crypto');

const TTL_MS = 15 * 60 * 1000;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) return { statusCode: 503, headers, body: JSON.stringify({ error: 'APERTURE_JWT_SECRET not configured' }) };

  const ev = String(body.event || '').trim();

  if (ev === 'request') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid email required' }) };
    }
    const exp = Date.now() + TTL_MS;
    const token = signToken({ email, exp }, secret);
    const baseUrl = (event.headers.origin || event.headers.referer || 'https://iisupp.net').replace(/\/$/, '');
    const link = baseUrl + '/aria?magic=' + encodeURIComponent(token);

    const firstName = email.split('@')[0].split('.')[0];
    const html = `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><h2 style="margin:0 0 14px;color:#0b1f3a;font-family:Cinzel,serif">Sign in to ARIA</h2><p>Hi ${esc(firstName)},</p><p>Click the secure link below to sign in. The link is valid for 15 minutes and can only be used once.</p><p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:linear-gradient(135deg,#c5a059,#f1dca7);color:#1a1410;text-decoration:none;padding:12px 22px;border-radius:10px;font-family:Cinzel,serif;font-weight:700;letter-spacing:.14em;font-size:13px">Sign me in &rarr;</a></p><p style="font-size:12px;color:#888">If you didn't request this, ignore the email — your account isn't affected.</p><p style="font-size:11px;color:#aaa;margin-top:18px;border-top:1px solid #eee;padding-top:12px">Integrated IT Support &middot; <a href="tel:+16475813182" style="color:#c5a059">(647) 581-3182</a></p></div></div>`;

    await sendResend(email, 'Your ARIA sign-in link (valid 15 min)', html).catch(e => console.warn('[magic-link] mail err:', e.message));

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Magic link sent. Check your inbox.', expires_at: new Date(exp).toISOString() }) };
  }

  if (ev === 'verify') {
    const token = String(body.token || '').trim();
    const verified = verifyToken(token, secret);
    if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'invalid or expired token' }) };
    if (verified.exp < Date.now()) return { statusCode: 401, headers, body: JSON.stringify({ error: 'token expired' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, email: verified.email, expires_at: new Date(verified.exp).toISOString() }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'event must be "request" or "verify"' }) };
};

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function b64urlDecode(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4), 'base64'); }
function signToken(payload, secret) {
  const data = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}
function verifyToken(tok, secret) {
  try {
    const [data, sig] = tok.split('.');
    if (!data || !sig) return null;
    const expectedSig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    return JSON.parse(b64urlDecode(data).toString('utf-8'));
  } catch { return null; }
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function sendResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Integrated IT Support <noreply@iisupp.net>';
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html }) });
    if (r.ok) return true;
    if (r.status === 403) { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Integrated IT Support <onboarding@resend.dev>', to: [to], subject, html }) }); return true; }
    return false;
  } catch { return false; }
}
