// netlify/functions/aria-kb-export.mjs
// ARIA KB Export — the bridge that lets Ahmad's machine OWN a local copy of the live
// bit-KB (rule 7, 2026-05-25: "KB database must live on Ahmad's machine").
//
// Netlify functions are serverless and CANNOT write to Ahmad's PC, so instead this
// read-only endpoint dumps the learned bits from the aria-kb-live blob store as JSON,
// and the local puller (scripts/kb-pull.mjs) writes them into aria_brain_pack/bits/ on
// his machine on a schedule. The curated base (assets/aria-kb-local-bundle-v2.json) is
// already a git-tracked static file, so it's already local — this covers the bits the
// continuous loop has LEARNED since.
//
// Auth: Aperture JWT, OR x-aria-export-secret = ARIA_AUDIT_SECRET (so the local script
// can authenticate headlessly). Read-only, no LLM, $0.
//
// GET /.netlify/functions/aria-kb-export?limit=2000
//   -> { ok, count, exportedAt, bits:[ {key, ...blob} ] }

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const KB_LIVE = 'aria-kb-live';

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-aria-export-secret', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
}
function jr(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: cors() }); }

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'GET') return jr({ error: 'GET only' }, 405);

  const secret = request.headers.get('x-aria-export-secret');
  const secretAuthed = secret && process.env.ARIA_AUDIT_SECRET && secret === process.env.ARIA_AUDIT_SECRET;
  const jwtAuthed = !!verifyAperture(request);
  if (!secretAuthed && !jwtAuthed) return jr({ error: 'unauthorized — Aperture JWT or x-aria-export-secret required' }, 401);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10) || 2000, 5000);

  const kb = getStore({ name: KB_LIVE, consistency: 'strong' });
  const bits = [];
  try {
    const list = await kb.list({ prefix: 'learn-' });
    const blobs = (list && list.blobs) || [];
    for (const meta of blobs.slice(0, limit)) {
      try { const v = await kb.get(meta.key, { type: 'json' }); if (v) bits.push({ key: meta.key, ...v }); } catch (_) {}
    }
  } catch (e) {
    return jr({ error: 'kb list failed: ' + (e?.message || String(e)) }, 500);
  }

  return jr({ ok: true, count: bits.length, exportedAt: new Date().toISOString(), store: KB_LIVE, bits });
};
