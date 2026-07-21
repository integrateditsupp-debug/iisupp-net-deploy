// axis-status — AUTHENTICATED full AXIS program status. The public .well-known/axis/status.json mirrors
// are HEADLINE-ONLY (scripts/lib/axis-status-emit.mjs is the only sanctioned writer); the detailed
// flywheel state (branch/merge state, operator actions, lanes) lives in the non-public
// _axis-status-full.json and is served ONLY here, behind the same Aperture login the console uses.
// Same gate pattern as axis-state.mjs (2026-06-26 leak fix): page-login ≠ asset-protection.
import { verifyAperture } from './aperture-auth.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FN_DIR = path.dirname(fileURLToPath(import.meta.url)); // NOT "__dirname" — esbuild injects its own shim
const FULL_FILE = path.join(FN_DIR, '_axis-status-full.json');

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

  // GATE: no/invalid Aperture session → 401. Full program detail never reaches an unauthenticated caller.
  if (!verifyAperture(req)) return jr(401, { ok: false, reason: 'unauthorized — Aperture login required' });

  let status = null;
  try { status = JSON.parse(fs.readFileSync(FULL_FILE, 'utf8')); } catch { /* not yet emitted */ }
  if (!status) return jr(503, { ok: false, reason: 'full AXIS status not yet emitted' });

  return jr(200, Object.assign({ ok: true, authed: true }, status));
};

export const config = { path: '/api/axis-status' };
