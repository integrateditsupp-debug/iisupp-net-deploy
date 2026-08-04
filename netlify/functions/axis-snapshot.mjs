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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = 'axis-snapshots';
const VERSION_KEY = 'version';

// Bundled fallback (fictional demo snapshots) so the console renders BEFORE the local worker has pushed
// real snapshots to Blobs — same pattern as axis-state.mjs's _axis-state-full.json. Behind the JWT gate.
// Once the worker writes real Blobs snapshots, those take precedence.
const FN_DIR = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(FN_DIR, '_axis-snapshots-seed.json');
// Local dev override: real worker snapshots the worker writes to gitignored data/ (NOT bundled, NOT
// deployed). In `netlify dev` the function can read the repo's data/ dir; in prod that path is absent so
// this is skipped and we fall back to Blobs / the fictional committed seed. Keeps REAL data out of git.
const LOCAL_FILE = path.join(FN_DIR, '..', '..', 'data', 'axis-snapshots.local.json');
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function seed() {
  // priority: gitignored local real snapshot (dev only) → committed fictional seed
  return readJson(LOCAL_FILE) || readJson(SEED_FILE);
}
// MUST stay identical to SNAPSHOT_MODULES in assets/axis-constants.js — a module the worker computes
// but this allowlist omits is silently dropped, and the tab renders empty forever. Gated by
// tests/snapshot-module-parity.test.mjs so the two lists can never drift again.
const MODULES = new Set([
  'overview', 'inbox', 'approvals', 'pipeline', 'prospects', 'outreach',
  'waiting_reply', 'followups', 'documents', 'analytics', 'products', 'fleet', 'reports', 'crm', 'settings',
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
    const s = seed();
    if (!module) {
      const version = await store.get(VERSION_KEY, { type: 'json' });
      const v = version || (s && s.version) || { v: 0, modules: {}, tick: null };
      return jr(200, { ok: true, authed: true, version: v, source: version ? 'worker' : (s ? 'seed' : 'empty') });
    }
    if (module === 'all') {
      const version = (await store.get(VERSION_KEY, { type: 'json' })) || (s && s.version) || { v: 0, modules: {} };
      const snapshots = {};
      for (const m of MODULES) snapshots[m] = (await store.get(m, { type: 'json' })) || (s && s.snapshots && s.snapshots[m]) || null;
      return jr(200, { ok: true, authed: true, version, snapshots, source: version.tick ? 'worker' : (s ? 'seed' : 'empty') });
    }
    if (!MODULES.has(module)) return jr(400, { ok: false, reason: 'unknown module' });
    const env = (await store.get(module, { type: 'json' })) || (s && s.snapshots && s.snapshots[module]) || null;
    if (!env) return jr(200, { ok: true, authed: true, module, version: 0, data: {}, empty: true });
    return jr(200, Object.assign({ ok: true, authed: true }, env));
  } catch (e) {
    return jr(503, { ok: false, reason: 'snapshot read failed', detail: String(e && e.message || e).slice(0, 120) });
  }
};

export const config = { path: '/api/axis/snapshot' };
