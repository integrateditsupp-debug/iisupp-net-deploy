// axis-situation.mjs — GET /api/axis/situation (Aperture login required).
//
// The one picture AXIS looks at before it answers, served to the console so the Overview shows the
// same ranked "needs you" list the brains reason from (lib/axis-situation.cjs builds it). Read-only:
// nothing here writes, sends, spends or decides. The response names what IS and IS NOT connected
// (Rule 14) — the calendar and the three mailboxes stay "not connected" until Ahmad's Google sign-in.
//
//   GET /api/axis/situation            → { ok, generatedAt, local, sources, revenue, needsAhmad[], axisCanDo[], deadlines[], counts, text }
//   GET /api/axis/situation?format=text → the text block the brains read (text/plain), for a quick eyeball
import { verifyAperture } from './aperture-auth.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSituationSafe } from './lib/axis-situation.cjs';

const FN_DIR = path.dirname(fileURLToPath(import.meta.url)); // NOT "__dirname" — esbuild injects its own shim

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return jr(405, { ok: false, reason: 'GET only' });
  if (!verifyAperture(req)) return jr(401, { ok: false, reason: 'unauthorized — Aperture login required' });

  // The console can wait a little longer than a brain call can.
  const sit = await loadSituationSafe({ fnDir: FN_DIR, timeoutMs: 6000 });
  if (!sit) return jr(503, { ok: false, reason: 'situation unavailable — a store did not answer in time; the board still works' });

  const format = new URL(req.url).searchParams.get('format');
  if (format === 'text') return new Response(sit.text, { status: 200, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
  return jr(200, sit);
};

export const config = { path: '/api/axis/situation' };
