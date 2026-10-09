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
//
// RUN-CV / CV5 (2026-10-09, missed request A6f) — PAGING. The puller had been failing for 58 days:
// this function does one Blobs read PER BIT, so a page of 800 takes ~26 s and anything larger hits
// Netlify's synchronous ceiling as a 502/504. Without a cursor the puller could only shrink the page
// and accept a PARTIAL mirror. Additive `offset` (default 0 — a request without it is byte-for-byte
// the old response plus three new keys):
//
// GET /.netlify/functions/aria-kb-export?limit=300&offset=600
//   -> { ok, count, exportedAt, store, bits, offset, total, nextOffset }
//      total      — how many learned bits the store lists right now
//      nextOffset — where the next page starts, or null when this page reached the end
// The order is the store's listing order (keys ascending), which is stable between pages of one pull.

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const KB_LIVE = 'aria-kb-live';
export const DEFAULT_LIMIT = 2000;
export const MAX_LIMIT = 5000;

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-aria-export-secret', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
}
function jr(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: cors() }); }

/**
 * Pure: the page window for a request. `limit` keeps its old parsing exactly (default 2000, cap 5000);
 * `offset` is additive, default 0, never negative, never NaN. Given `total`, also says where the next
 * page starts (or null at the end).
 */
export function pageWindow(searchParams, total = null) {
  const get = (k) => (searchParams && typeof searchParams.get === 'function' ? searchParams.get(k) : null);
  const limit = Math.min(parseInt(get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(get('offset') || '0', 10) || 0, 0);
  const out = { limit, offset };
  if (typeof total === 'number' && Number.isFinite(total)) {
    const end = Math.min(offset + limit, Math.max(total, 0));
    out.total = total;
    out.nextOffset = end < total ? end : null;
  }
  return out;
}

// Tests swap the store for an in-memory one; production never calls this.
let storeFactory = (opts) => getStore(opts);
export function _setStoreFactory(fn) { storeFactory = typeof fn === 'function' ? fn : ((opts) => getStore(opts)); }

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'GET') return jr({ error: 'GET only' }, 405);

  const secret = request.headers.get('x-aria-export-secret');
  const secretAuthed = secret && process.env.ARIA_AUDIT_SECRET && secret === process.env.ARIA_AUDIT_SECRET;
  const jwtAuthed = !!verifyAperture(request);
  if (!secretAuthed && !jwtAuthed) return jr({ error: 'unauthorized — Aperture JWT or x-aria-export-secret required' }, 401);

  const url = new URL(request.url);
  const { limit, offset } = pageWindow(url.searchParams);

  const kb = storeFactory({ name: KB_LIVE, consistency: 'strong' });
  const bits = [];
  let total = 0;
  let nextOffset = null;
  try {
    const list = await kb.list({ prefix: 'learn-' });
    const blobs = (list && list.blobs) || [];
    const window = pageWindow(url.searchParams, blobs.length);
    total = window.total;
    nextOffset = window.nextOffset;
    for (const meta of blobs.slice(offset, offset + limit)) {
      try { const v = await kb.get(meta.key, { type: 'json' }); if (v) bits.push({ key: meta.key, ...v }); } catch (_) {}
    }
  } catch (e) {
    return jr({ error: 'kb list failed: ' + (e?.message || String(e)) }, 500);
  }

  return jr({ ok: true, count: bits.length, exportedAt: new Date().toISOString(), store: KB_LIVE, bits, offset, total, nextOffset });
};
