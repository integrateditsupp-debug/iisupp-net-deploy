// axis-state — AUTHENTICATED AXIS Command Center state. Validates the same Aperture login the page uses
// (verifyAperture) and ONLY then returns the FULL, named detail (approval titles, named activity, per-agent
// runs) from the non-public _axis-state-full.json the worker emits. The PUBLIC /assets/axis-state.json stays
// counts-only. 2026-06-26 leak fix: page-login ≠ asset-protection, so the named data is gated server-side.
import { verifyAperture } from './aperture-auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULL_FILE = path.join(__dirname, '_axis-state-full.json');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json'
};
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return jr(405, { ok: false, reason: 'GET only' });

  // GATE: no/invalid Aperture session → 401. Never returns named detail to an unauthenticated caller.
  if (!verifyAperture(req)) return jr(401, { ok: false, reason: 'unauthorized — Aperture login required' });

  let state = null;
  try { state = JSON.parse(fs.readFileSync(FULL_FILE, 'utf8')); } catch { /* not yet emitted */ }
  if (!state) return jr(503, { ok: false, reason: 'AXIS state not yet synced' });

  return jr(200, Object.assign({ ok: true, authed: true }, state));
};

export const config = { path: '/api/axis-state' };
