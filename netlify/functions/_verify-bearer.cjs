// _verify-bearer.cjs — CJS-callable Aperture JWT verification for legacy (event/handler) functions.
// The canonical verifier is verifyAperture() in aperture-auth.mjs (ESM). CJS functions cannot import
// that ESM module, so this mirrors the same HS256 check for `exports.handler`-style functions.
// Same secret (APERTURE_JWT_SECRET), same token format, same 12h-exp semantics. No new trust root.

const crypto = require('node:crypto');

function b64urlDecode(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (!timingSafeEq(s, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(p).toString('utf8')); } catch { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Accepts the raw `Authorization` header value (event.headers.authorization). Returns claims or null.
function verifyBearer(authHeader) {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) return null;
  return verifyJWT(token, secret);
}

// Netlify lowercases header keys in event.headers, but be defensive about casing.
function bearerFromEvent(event) {
  const h = event && event.headers ? (event.headers.authorization || event.headers.Authorization) : null;
  return verifyBearer(h);
}

module.exports = { verifyBearer, bearerFromEvent, verifyJWT };
