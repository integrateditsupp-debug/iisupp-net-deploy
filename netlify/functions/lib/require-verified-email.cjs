// lib/require-verified-email.cjs — proof of mailbox ownership for the Stripe/account endpoints.
//
// Before 2026-10-08 these endpoints treated "knows the email address" as authentication (audit top-10 #1):
// anyone could open a customer's billing portal, list invoices, change their plan, cancel their
// subscriptions or pull their PII. This helper is the single gate they all call first.
//
// Accepted proofs (first that verifies wins):
//   (a) a magic-link token — body.token | body.sessionToken | body.session_token | header x-aria-session-token —
//       signed with APERTURE_JWT_SECRET exactly as aria-magic-link.js issues it (payload {email, exp[, kind]});
//       the token's email must equal the email the request acts on.
//   (b) an Aperture admin JWT (Authorization: Bearer …) verified by ./_verify-bearer.cjs. role:'admin' may act
//       on any email (console / tenant onboarding); any other JWT must match its `sub`.
//   (c) ESCAPE HATCH — env ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1 restores the old email-only behaviour so Ahmad
//       can un-break a live customer flow in one Netlify toggle. Default OFF. Logs a loud warning on every use.
//
// Returns { ok:true, email, via } or { ok:false, status, error, hint }.
'use strict';

const crypto = require('node:crypto');
const { bearerFromEvent } = require('../_verify-bearer.cjs');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ONLY_ENV = 'ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS';

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function b64urlDecode(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4), 'base64'); }

/** Same scheme as aria-magic-link.js: base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payload)). */
function signToken(payload, secret) {
  const data = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}

/** Returns the payload when the signature is valid and (if present) `exp` is in the future; else null. */
function verifyToken(tok, secret) {
  try {
    if (!tok || !secret || typeof tok !== 'string') return null;
    const parts = tok.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    if (!data || !sig) return null;
    const expectedSig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
    const a = Buffer.from(sig), b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(data).toString('utf-8'));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function headerOf(event, name) {
  const h = event && event.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(name) || '';
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) if (k.toLowerCase() === lower) return h[k] || '';
  return '';
}

function emailOnlyModeOn() {
  const v = String(process.env[EMAIL_ONLY_ENV] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * requireVerifiedEmail(event, body, opts?)
 *   opts.email      — the email the request acts on (defaults to body.email | body.customer_email)
 *   opts.scope      — label for logs (e.g. 'aria-billing-portal')
 */
function requireVerifiedEmail(event, body, opts) {
  const o = opts || {};
  const b = body && typeof body === 'object' ? body : {};
  const email = String(o.email || b.email || b.customer_email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false, status: 400, error: 'valid email required' };
  const scope = o.scope || 'account-action';

  // (a) magic-link / session token
  const token = String(b.token || b.sessionToken || b.session_token || headerOf(event, 'x-aria-session-token') || '').trim();
  if (token) {
    const secret = process.env.APERTURE_JWT_SECRET;
    if (!secret) return { ok: false, status: 503, error: 'not-configured', hint: 'APERTURE_JWT_SECRET is not set' };
    const payload = verifyToken(token, secret);
    if (payload && typeof payload.email === 'string' && payload.email.trim().toLowerCase() === email) {
      return { ok: true, email, via: payload.kind === 'session' ? 'session-token' : 'magic-link-token' };
    }
  }

  // (b) Aperture JWT
  try {
    const claims = bearerFromEvent(event);
    if (claims) {
      if (claims.role === 'admin') return { ok: true, email, via: 'aperture-jwt', admin: true, actor: claims.sub || null };
      if (typeof claims.sub === 'string' && claims.sub.trim().toLowerCase() === email) return { ok: true, email, via: 'aperture-jwt' };
    }
  } catch { /* fall through */ }

  // (c) escape hatch — default OFF
  if (emailOnlyModeOn()) {
    console.warn(`[require-verified-email] WARNING: ${EMAIL_ONLY_ENV}=1 — ${scope} accepted an UNVERIFIED email-only request. ` +
      'This re-opens audit finding #1 (email = auth). Turn it off as soon as the client sends a magic-link token.');
    return { ok: true, email, via: 'email-only-unverified', warning: EMAIL_ONLY_ENV + ' is on' };
  }

  return {
    ok: false,
    status: 401,
    error: 'verification_required',
    hint: 'Prove mailbox ownership: POST /.netlify/functions/aria-magic-link {event:"request", email} then resend this request with the emailed `token` (or sign in to Aperture and send Authorization: Bearer <jwt>).',
  };
}

/** Legacy-handler 401/400/503 response. Keeps the caller's headers. */
function verifiedEmailResponse(result, headers) {
  return {
    statusCode: result.status || 401,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify({ ok: false, error: result.error || 'verification_required', hint: result.hint }),
  };
}

module.exports = { requireVerifiedEmail, verifiedEmailResponse, signToken, verifyToken, EMAIL_ONLY_ENV, EMAIL_RE };
