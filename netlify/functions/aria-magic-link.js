/**
 * aria-magic-link — Passwordless sign-in via email link (Cat 5 Account mgmt).
 *  POST { event: 'request', email } -> sends magic link
 *  POST { event: 'verify', token } -> returns { ok, email, expires_at, session_token, session_expires_at }
 *
 *  HMAC-signed token (HS256-like) using APERTURE_JWT_SECRET. TTL 15 min.
 *
 *  2026-10-08 (audit top-10 #4):
 *   - the link host comes from process.env.URL / DEPLOY_PRIME_URL only (was the attacker-controlled
 *     Origin/Referer header → sign-in link pointing at a phishing host).
 *   - every token carries a one-time nonce (`jti`) stored in Blobs (`aria-magic-link` store) and consumed
 *     on `verify`, so "can only be used once" is now true. (If Blobs is unavailable the HMAC check still
 *     applies and the response says `single_use_enforced:false`.)
 *   - rate limited: 5 requests / 15 min per IP and 3 / 15 min per email (mail-bombing).
 *   - a successful `verify` ALSO returns a 12-hour `session_token` (same HMAC scheme, kind:'session') that
 *     the account endpoints accept as proof of mailbox ownership (lib/require-verified-email.cjs).
 *   - mail goes through lib/notify.mjs; if no provider confirmed delivery the response is ok:false.
 */
const crypto = require('node:crypto');
const { checkRateLimit, rateLimitResponse, hashKey } = require('./_rate-limit');
const { signToken, verifyToken } = require('./lib/require-verified-email.cjs');
const { SUPPORT_PHONE, SUPPORT_TEL } = require('./lib/contacts.cjs');

const TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const STORE_NAME = 'aria-magic-link';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
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
    const ipLimit = checkRateLimit(event, { scope: 'magic-link', limit: 5, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.ok) return rateLimitResponse(ipLimit, headers);
    const emailLimit = checkRateLimit(event, { key: 'magic-link-email:' + hashKey(email), limit: 3, windowMs: 15 * 60 * 1000 });
    if (!emailLimit.ok) return rateLimitResponse(emailLimit, headers);

    const exp = Date.now() + TTL_MS;
    const jti = crypto.randomBytes(12).toString('hex');
    const token = signToken({ email, exp, jti }, secret);
    const baseUrl = siteBaseUrl();
    const link = baseUrl + '/aria?magic=' + encodeURIComponent(token);

    // One-time nonce (consumed on verify). Best-effort: Blobs unavailable → HMAC+exp still protect the token.
    const store = openStore();
    let singleUse = false;
    if (store) {
      try { await store.setJSON('nonce-' + jti, { email_hash: hashKey(email), exp, created_at: Date.now() }); singleUse = true; }
      catch (e) { console.warn('[magic-link] nonce write failed:', e.message); }
    }

    const firstName = email.split('@')[0].split('.')[0];
    const html = `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,sans-serif;color:#222;line-height:1.6;padding:24px;background:#fff"><div style="border-top:3px solid #c5a059;padding-top:18px"><h2 style="margin:0 0 14px;color:#0b1f3a;font-family:Cinzel,serif">Sign in to ARIA</h2><p>Hi ${esc(firstName)},</p><p>Click the secure link below to sign in. The link is valid for 15 minutes${singleUse ? ' and can only be used once' : ''}.</p><p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:linear-gradient(135deg,#c5a059,#f1dca7);color:#1a1410;text-decoration:none;padding:12px 22px;border-radius:10px;font-family:Cinzel,serif;font-weight:700;letter-spacing:.14em;font-size:13px">Sign me in &rarr;</a></p><p style="font-size:12px;color:#888">If you didn't request this, ignore the email — your account isn't affected.</p><p style="font-size:11px;color:#aaa;margin-top:18px;border-top:1px solid #eee;padding-top:12px">Integrated IT Support &middot; <a href="tel:${esc(SUPPORT_TEL)}" style="color:#c5a059">${esc(SUPPORT_PHONE)}</a></p></div></div>`;

    let sent = { ok: false, error: 'not-attempted' };
    try {
      const { sendEmail } = await import('./lib/notify.mjs');
      sent = await sendEmail({ to: email, subject: 'Your ARIA sign-in link (valid 15 min)', html, tag: 'magic-link' });
    } catch (e) { sent = { ok: false, error: e.message }; }

    if (!sent.ok) {
      console.error('[magic-link] link NOT delivered', JSON.stringify({ email_hash: hashKey(email), error: sent.error, attempts: sent.attempts }));
      return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: 'email_delivery_failed', message: `We could not send the sign-in email right now. Try again in a minute or call ${SUPPORT_PHONE}.` }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Magic link sent. Check your inbox.', expires_at: new Date(exp).toISOString(), single_use_enforced: singleUse }) };
  }

  if (ev === 'verify') {
    const token = String(body.token || '').trim();
    const verified = verifyToken(token, secret);
    if (!verified || typeof verified.email !== 'string') return { statusCode: 401, headers, body: JSON.stringify({ error: 'invalid or expired token' }) };
    if (typeof verified.exp !== 'number' || verified.exp < Date.now()) return { statusCode: 401, headers, body: JSON.stringify({ error: 'token expired' }) };
    if (verified.kind === 'session') return { statusCode: 400, headers, body: JSON.stringify({ error: 'that is a session token, not a sign-in link' }) };

    // Consume the one-time nonce.
    let singleUse = false;
    const store = openStore();
    if (store && verified.jti) {
      try {
        const nonce = await store.get('nonce-' + String(verified.jti).replace(/[^a-f0-9]/g, ''), { type: 'json' });
        if (!nonce) return { statusCode: 401, headers, body: JSON.stringify({ error: 'token already used or unknown' }) };
        await store.delete('nonce-' + verified.jti);
        singleUse = true;
      } catch (e) { console.warn('[magic-link] nonce consume failed:', e.message); }
    } else if (store && !verified.jti) {
      // Pre-nonce tokens (issued before this deploy) stay valid until their own 15-min expiry only.
      singleUse = false;
    }

    const email = verified.email.trim().toLowerCase();
    const sessionExp = Date.now() + SESSION_TTL_MS;
    const sessionToken = signToken({ email, exp: sessionExp, kind: 'session', sid: crypto.randomBytes(8).toString('hex') }, secret);
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      email,
      expires_at: new Date(verified.exp).toISOString(),
      single_use_enforced: singleUse,
      session_token: sessionToken,
      session_expires_at: new Date(sessionExp).toISOString()
    }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'event must be "request" or "verify"' }) };
};

function siteBaseUrl() {
  const raw = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://iisupp.net';
  return String(raw).replace(/\/$/, '');
}

function openStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (e) {
    console.warn('[magic-link] Blobs unavailable — single-use nonce not enforced this invocation');
    return null;
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Exposed for tests / other functions that need the same token scheme.
exports._signToken = signToken;
exports._verifyToken = verifyToken;
