// aperture-auth v0.5 — login + JWT issuance for Aperture portal
// POST /.netlify/functions/aperture-auth { email, password } → { ok, token, expiresAt }
// Other functions import verifyAperture() to gate protected endpoints.

import crypto from 'node:crypto';

const TOKEN_TTL_SEC = 60 * 60 * 12; // 12 hours

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const { email, password } = body;
  if (!email || !password) return jsonResp(400, cors, { error: 'email + password required' });

  const adminEmail = (process.env.APERTURE_ADMIN_EMAIL || 'integrateditsupp@iisupp.net').toLowerCase().trim();
  const adminPass = process.env.APERTURE_ADMIN_PASSWORD;
  const jwtSecret = process.env.APERTURE_JWT_SECRET;

  if (!adminPass || !jwtSecret) {
    console.error('[aperture-auth] APERTURE_ADMIN_PASSWORD or APERTURE_JWT_SECRET not set');
    return jsonResp(503, cors, { error: 'auth not configured — admin must set env vars' });
  }

  // Constant-time-ish comparison
  const okEmail = timingSafeStringEq(email.toLowerCase().trim(), adminEmail);
  const okPass = timingSafeStringEq(password, adminPass);

  if (!okEmail || !okPass) {
    // Sleep a tiny bit to defeat fast-fire brute-force attempts.
    await new Promise(r => setTimeout(r, 400));
    return jsonResp(401, cors, { error: 'invalid credentials' });
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SEC;
  const payload = { sub: adminEmail, iat, exp, role: 'admin' };
  const token = signJWT(payload, jwtSecret);

  return jsonResp(200, cors, {
    ok: true,
    token,
    expiresAt: exp * 1000,
    user: { email: adminEmail, role: 'admin' }
  });
};

// ============= JWT (HS256, self-contained, no deps) =============
function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64urlDecode(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}
function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

export function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (!timingSafeStringEq(s, expected)) return null;
  let payload;
  try { payload = JSON.parse(base64urlDecode(p).toString('utf8')); }
  catch { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Public helper for other Netlify functions to gate themselves:
// import { verifyAperture } from './aperture-auth.mjs';
// const claims = verifyAperture(request); if (!claims) return new Response(...401);
export function verifyAperture(request) {
  const h = request.headers.get && request.headers.get('authorization');
  if (!h || !/^Bearer\s+/i.test(h)) return null;
  const token = h.replace(/^Bearer\s+/i, '').trim();
  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) return null;
  return verifyJWT(token, secret);
}

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

function timingSafeStringEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    // Still consume time roughly proportional, but not equal
    try { crypto.timingSafeEqual(Buffer.from('x'.repeat(Math.max(a.length, b.length))), Buffer.from('x'.repeat(Math.max(a.length, b.length)))); }
    catch {}
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
