// tests/axis-auth.test.mjs — AXIS CC v2 P1 security gate.
// Proves the shared Bearer verifier (_verify-bearer.cjs) accepts a valid Aperture JWT and rejects
// missing / malformed / wrong-secret / expired tokens. This is the "unauthenticated requests rejected"
// guarantee behind axis-director + aperture-email-report.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.env.APERTURE_JWT_SECRET = process.env.APERTURE_JWT_SECRET || 'test-secret-123';
const SECRET = process.env.APERTURE_JWT_SECRET;

const require = createRequire(import.meta.url);
const fnDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'functions');
const { verifyBearer, bearerFromEvent } = require(path.join(fnDir, '_verify-bearer.cjs'));

const b64url = (x) => Buffer.from(x).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function sign(payload, secret) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const d = `${h}.${p}`;
  const s = crypto.createHmac('sha256', secret).update(d).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${d}.${s}`;
}

const now = Math.floor(Date.now() / 1000);
const good = sign({ sub: 'admin', iat: now, exp: now + 3600, role: 'admin' }, SECRET);
const wrongSecret = sign({ sub: 'admin', iat: now, exp: now + 3600 }, 'other-secret');
const expired = sign({ sub: 'admin', iat: now - 7200, exp: now - 3600 }, SECRET);

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL', name); } };

t('valid token accepted', !!verifyBearer('Bearer ' + good));
t('valid via event headers', !!bearerFromEvent({ headers: { authorization: 'Bearer ' + good } }));
t('valid via capitalized header key', !!bearerFromEvent({ headers: { Authorization: 'Bearer ' + good } }));
t('no header rejected', verifyBearer(null) === null);
t('empty rejected', verifyBearer('') === null);
t('non-bearer rejected', verifyBearer(good) === null);
t('wrong-secret sig rejected', verifyBearer('Bearer ' + wrongSecret) === null);
t('expired rejected', verifyBearer('Bearer ' + expired) === null);
t('garbage rejected', verifyBearer('Bearer not.a.jwt') === null);
t('missing event headers rejected', bearerFromEvent({}) === null);

console.log(`[axis-auth] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
