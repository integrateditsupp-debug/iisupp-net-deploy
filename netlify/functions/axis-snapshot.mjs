// axis-snapshot — AUTHENTICATED read model for AXIS Command Center v2.
// GET /api/axis/snapshot            → the version doc { v, modules:{m:v}, tick } (UI polls this)
// GET /api/axis/snapshot?module=X   → that module's snapshot envelope { module, version, generatedAt, data }
// GET /api/axis/snapshot?module=all → { version, snapshots:{m:envelope} } (first paint convenience)
//
// The worker (scripts/lib/axis-snapshots.mjs) writes these to Blobs store 'axis-snapshots'. This function
// NEVER touches SQLite and NEVER computes — it only serves worker-produced, already-sanitized JSON, and
// ONLY to a valid Aperture session (same login the console uses). Prospect PII is behind this gate.
import { verifyAperture } from './aperture-auth.mjs';
import { getStore } from '@netlify/blobs';

const STORE = 'axis-snapshots';
const VERSION_KEY = 'version';
const MODULES = new Set([
  'overview', 'inbox', 'approvals', 'pipeline', 'prospects', 'outreach',
  'followups', 'documents', 'analytics', 'products', 'fleet', 'reports', 'crm', 'settings',
]);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return jr(405, { ok: false, reason: 'GET only' });
  if (!verifyAperture(req)) return jr(401, { ok: false, reason: 'unauthorized — Aperture login required' });

  let store;
  try { store = getStore(STORE); } catch { return jr(503, { ok: false, reason: 'snapshot store unavailable' }); }

  const module = new URL(req.url).searchParams.get('module');

  try {
    if (!module) {
      const version = await store.get(VERSION_KEY, { type: 'json' });
      return jr(200, { ok: true, authed: true, version: version || { v: 0, modules: {}, tick: null } });
    }
    if (module === 'all') {
      const version = (await store.get(VERSION_KEY, { type: 'json' })) || { v: 0, modules: {} };
      const snapshots = {};
      for (const m of MODULES) snapshots[m] = await store.get(m, { type: 'json' });
      return jr(200, { ok: true, authed: true, version, snapshots });
    }
    if (!MODULES.has(module)) return jr(400, { ok: false, reason: 'unknown module' });
    const env = await store.get(module, { type: 'json' });
    if (!env) return jr(200, { ok: true, authed: true, module, version: 0, data: {}, empty: true });
    return jr(200, Object.assign({ ok: true, authed: true }, env));
  } catch (e) {
    return jr(503, { ok: false, reason: 'snapshot read failed', detail: String(e && e.message || e).slice(0, 120) });
  }
};

export const config = { path: '/api/axis/snapshot' };
