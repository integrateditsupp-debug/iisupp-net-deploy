// axis-snapshot-push — machine-to-machine WRITE path for the AXIS snapshot read-model.
//
// WHY THIS EXISTS (B3, 2026-07-28): Netlify Blobs has no TTL. A snapshot pushed once serves forever
// until something overwrites it — which is how the live dashboard kept rendering $93,250 of pipeline
// months after the DB said $0. Overwriting it from a laptop required a Netlify personal access token,
// which did not exist anywhere and had to be minted by hand every time. Inside a Netlify Function the
// Blobs credentials are ambient, so this endpoint closes that gap permanently: the worker computes
// locally against SQLite and POSTs the finished blobs here.
//
// This function is deliberately DUMB. It computes nothing, reads no database, and trusts no field it
// was not explicitly given. All snapshot logic stays in scripts/lib/axis-snapshots.mjs where it is
// tested. This is a key/value writer with an allow-list and a bearer gate — nothing more.
//
//   GET  /api/axis/snapshot-push   → { ok, version }   current version doc, so the caller can diff
//   POST /api/axis/snapshot-push   → { ok, wrote:[] }  body { version, envelopes:{ module: envelope } }
//
// Auth: Authorization: Bearer $AXIS_SNAPSHOT_PUSH_TOKEN. Unset token ⇒ endpoint is hard-disabled (503),
// never open. This is NOT the Aperture session gate — it is a separate machine credential.
import { getStore } from '@netlify/blobs';

const STORE = 'axis-snapshots';
const VERSION_KEY = 'version';
const MAX_BODY = 4 * 1024 * 1024; // 4 MB — a full 14-module snapshot is orders of magnitude smaller

const MODULES = new Set([
  'overview', 'inbox', 'approvals', 'pipeline', 'prospects', 'outreach',
  'followups', 'documents', 'analytics', 'products', 'fleet', 'reports', 'crm', 'settings',
]);

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers });

// Length-independent compare so a wrong token cannot be recovered by timing the response.
function tokenOk(req) {
  const expected = process.env.AXIS_SNAPSHOT_PUSH_TOKEN;
  if (!expected) return null; // signals "disabled", distinct from "wrong token"
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const auth = tokenOk(req);
  if (auth === null) return jr(503, { ok: false, reason: 'push endpoint disabled — AXIS_SNAPSHOT_PUSH_TOKEN not set' });
  if (auth === false) return jr(401, { ok: false, reason: 'unauthorized' });

  let store;
  try { store = getStore(STORE); } catch (e) { return jr(503, { ok: false, reason: 'snapshot store unavailable' }); }

  if (req.method === 'GET') {
    const version = await store.get(VERSION_KEY, { type: 'json' }).catch(() => null);
    return jr(200, { ok: true, version: version || null });
  }
  if (req.method !== 'POST') return jr(405, { ok: false, reason: 'GET or POST only' });

  let body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return jr(413, { ok: false, reason: 'payload too large' });
    body = JSON.parse(raw);
  } catch { return jr(400, { ok: false, reason: 'body must be JSON' }); }

  const { version, envelopes } = body || {};
  if (!version || typeof version !== 'object') return jr(400, { ok: false, reason: 'missing version doc' });
  if (!envelopes || typeof envelopes !== 'object') return jr(400, { ok: false, reason: 'missing envelopes' });

  // Allow-list every key before writing. A typo'd or hostile module name must not be able to create
  // arbitrary blobs in a store the authed read path serves to the console.
  const unknown = Object.keys(envelopes).filter((m) => !MODULES.has(m));
  if (unknown.length) return jr(400, { ok: false, reason: 'unknown module(s): ' + unknown.join(',') });

  const wrote = [];
  try {
    for (const [m, env] of Object.entries(envelopes)) { await store.setJSON(m, env); wrote.push(m); }
    await store.setJSON(VERSION_KEY, version);           // version doc LAST — readers never see a
    wrote.push(VERSION_KEY);                             // bumped version pointing at unwritten modules
  } catch (e) {
    return jr(502, { ok: false, reason: 'write failed', wrote, detail: String((e && e.message) || e).slice(0, 160) });
  }
  return jr(200, { ok: true, wrote, v: version.v, tick: version.tick });
};

export const config = { path: '/api/axis/snapshot-push' };
