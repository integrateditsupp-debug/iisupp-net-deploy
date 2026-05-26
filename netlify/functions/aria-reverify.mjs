// netlify/functions/aria-reverify.mjs
// ARIA Re-Verifier — the every-2-weeks freshness/industry-standard cross-check agent
// (Ahmad 2026-05-25: "another agent to run and cross check verify every two weeks to
//  ensure data is up to date by industry standards. Otherwise Agents will be told to
//  work again to find new solutions and repeat").
//
// Walks the live bit-KB (aria-kb-live), scores each bit's freshness against a review
// horizon (ARIA_KB_FRESH_DAYS, default 90), and for anything stale it RE-QUEUES the
// topic into the learning loop's curiosity queue (aria-learning-sessions/active.json)
// so the agents research it again from current free sources. Writes a report so the
// evolution digest / Aperture can show what was re-checked.
//
// Pure + deterministic, NO LLM, $0. Read-only on GET (JWT dry-run for the dashboard),
// mutating on POST (x-aria-reverify-secret = ARIA_AUDIT_SECRET, used by the cron).
//
// Registered in mesh-registry.json (observe/verify) as status: active.

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const KB_LIVE = 'aria-kb-live';
const SESSIONS = 'aria-learning-sessions';
const STORE = 'aria-reverify';
const REPORT_KEY = 'last.json';

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-aria-reverify-secret', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
}
function jr(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: cors() }); }

function freshDays() { const v = parseInt(process.env.ARIA_KB_FRESH_DAYS || '90', 10); return Number.isFinite(v) && v > 0 ? v : 90; }

// Pure scoring (exported for testing). Returns which bits are stale and which topics to re-queue.
export function scoreFreshness(bits, horizonDays, now) {
  const horizonMs = horizonDays * 86400000;
  const stale = [];
  const topics = new Set();
  for (const b of bits) {
    const created = Date.parse(b.created_at || b.createdAt || '') || 0;
    const ageMs = created ? (now - created) : Infinity; // no date = treat as stale
    if (ageMs > horizonMs) {
      stale.push({ key: b.key, topic: b.topic || null, ageDays: created ? Math.round(ageMs / 86400000) : null });
      if (b.topic) topics.add(b.topic);
    }
  }
  return { staleCount: stale.length, total: bits.length, requeueTopics: Array.from(topics).slice(0, 200), stale: stale.slice(0, 100) };
}

async function loadBits(kb) {
  const out = [];
  try {
    const list = await kb.list({ prefix: 'learn-' });
    const blobs = (list && list.blobs) || [];
    // cap the scan to protect runtime; oldest-first isn't guaranteed so sample a bounded set
    for (const meta of blobs.slice(0, 800)) {
      try {
        const v = await kb.get(meta.key, { type: 'json' });
        if (v) out.push({ key: meta.key, created_at: v.created_at, topic: v.topic });
      } catch (_) {}
    }
  } catch (_) {}
  return out;
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  const isPost = request.method === 'POST';
  const secret = request.headers.get('x-aria-reverify-secret');
  const secretAuthed = secret && process.env.ARIA_AUDIT_SECRET && secret === process.env.ARIA_AUDIT_SECRET;
  const jwtAuthed = !!verifyAperture(request);
  if (!secretAuthed && !jwtAuthed) return jr({ error: 'unauthorized — Aperture JWT or x-aria-reverify-secret required' }, 401);

  const kb = getStore({ name: KB_LIVE, consistency: 'strong' });
  const bits = await loadBits(kb);
  const result = scoreFreshness(bits, freshDays(), Date.now());

  const report = { ts: Date.now(), horizonDays: freshDays(), scanned: result.total, stale: result.staleCount, requeued: 0, requeueTopics: result.requeueTopics };

  // GET = dry run (no mutation).
  if (!isPost) return jr({ ok: true, dryRun: true, ...report, staleSample: result.stale });

  // POST = re-queue stale topics back into the learning loop so agents work them again.
  if (result.requeueTopics.length) {
    try {
      const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
      const state = (await sessions.get('active.json', { type: 'json' })) || null;
      if (state && Array.isArray(state.queue)) {
        let added = 0;
        for (const t of result.requeueTopics) {
          if (!state.queue.includes(t)) { state.queue.push(t); added++; }
        }
        await sessions.set('active.json', JSON.stringify(state), { contentType: 'application/json' });
        report.requeued = added;
      }
    } catch (_) {}
  }
  try { await getStore(STORE).set(REPORT_KEY, JSON.stringify(report), { contentType: 'application/json' }); } catch (_) {}
  return jr({ ok: true, ...report });
};
