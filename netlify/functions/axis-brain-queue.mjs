// axis-brain-queue.mjs — the Blobs side of AXIS brain tier 3 (the Claude Max plan).
//
// WHY THIS EXISTS (measured 2026-08-11): `axis-director.js` is a legacy CJS `exports.handler`
// function, and Netlify does NOT inject the Blobs context into v1 functions — a `getStore()` there
// fails with "The environment has not been configured to use Netlify Blobs". A v2 ESM function in
// the very same deploy (e.g. aria-learning-status.mjs) gets the context automatically. So the queue
// lives here, in v2, and the cascade reaches it over HTTP — exactly how tiers 1 and 2 already call
// aria-kb-query and aria-research.
//
// Three actions, all requiring the same Aperture bearer as axis-director:
//   online  → is the local worker's heartbeat fresh?
//   enqueue → put a question in the queue, return its id
//   poll    → has the worker answered that id yet?
//
// This NEVER answers anything itself and never calls a paid API. It is a mailbox.
import { getStore } from '@netlify/blobs';
import { bearerFromEvent } from './_verify-bearer.cjs';

const JOBS = 'axis-brain-jobs';
const HEARTBEAT_KEY = 'worker-heartbeat';
const HEARTBEAT_MAX_MS = 120000;   // worker beats every 30s; >2 min means offline

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'POST required' });

  // Same trust root as axis-director — this queue reaches a worker on Ahmad's machine.
  const auth = request.headers.get('authorization') || '';
  if (!bearerFromEvent({ headers: { authorization: auth } })) return json(401, { error: 'unauthorized' });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'invalid JSON' }); }
  const action = String(body.action || '');

  let store;
  try { store = getStore({ name: JOBS, consistency: 'strong' }); }
  catch (e) { return json(200, { ok: false, reason: 'blobs-unavailable', detail: e.message }); }

  if (action === 'online') {
    try {
      const hb = await store.get(HEARTBEAT_KEY, { type: 'json' });
      const age = hb && hb.t ? Date.now() - hb.t : null;
      return json(200, { ok: true, online: !!(age !== null && age < HEARTBEAT_MAX_MS), ageMs: age });
    } catch { return json(200, { ok: true, online: false }); }
  }

  if (action === 'enqueue') {
    const query = String(body.query || '').slice(0, 4000);
    if (!query) return json(400, { error: 'query required' });
    const id = 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    try {
      await store.setJSON(`pending/${id}`, { id, query, t: Date.now() });
      return json(200, { ok: true, id });
    } catch (e) { return json(200, { ok: false, reason: 'enqueue-failed', detail: e.message }); }
  }

  // Bank an answer into the ARIA brain. Two writes are required and BOTH matter:
  //   1. the learn-* blob (the body), and
  //   2. an entry in kb-index.json — because aria-kb-query discovers learned bits ONLY through that
  //      manifest (loadLiveChunks reads kb-index.json → entries[] → store.get(e.key)).
  // Writing just the blob banks an answer the brain can never find. Measured 2026-08-11: the first
  // Max-plan answer was stored correctly and still missed on the re-ask for exactly this reason.
  // (aria-learning-promote.mjs lists blobs directly, so it sees them either way — which is what
  // made the gap invisible.)
  if (action === 'learn') {
    const { key, topic, question, body: text, source } = body;
    if (!key || !text) return json(400, { error: 'key and body required' });
    try {
      const kb = getStore({ name: 'aria-kb-live', consistency: 'strong' });
      const now = new Date().toISOString();
      await kb.setJSON(key, {
        topic, question: String(question || '').slice(0, 500), body: String(text).slice(0, 3500),
        agent: 'axis-brain', source: source || 'axis-brain', verified_answer: true,
        promoted: true, promoted_at: now, created_at: now,
      });
      // Read-modify-write the manifest. Low volume, so a lost update is unlikely and non-fatal —
      // the promote cron rebuilds from the blobs regardless.
      let idx = null;
      try { idx = await kb.get('kb-index.json', { type: 'json' }); } catch { idx = null; }
      if (!idx || !Array.isArray(idx.entries)) idx = { entries: [] };
      idx.entries = idx.entries.filter((e) => e && e.key !== key);
      idx.entries.push({ key, topic, promoted: true, t: Date.now() });
      if (idx.entries.length > 5000) idx.entries = idx.entries.slice(-5000);
      await kb.setJSON('kb-index.json', idx);
      return json(200, { ok: true, key, indexed: idx.entries.length });
    } catch (e) { return json(200, { ok: false, reason: 'learn-failed', detail: e.message }); }
  }

  if (action === 'poll') {
    const id = String(body.id || '');
    if (!id) return json(400, { error: 'id required' });
    try {
      const done = await store.get(`done/${id}`, { type: 'json' });
      if (!done) return json(200, { ok: true, ready: false });
      return json(200, { ok: true, ready: true, answer: done.answer || null, error: done.error || null });
    } catch { return json(200, { ok: true, ready: false }); }
  }

  return json(400, { error: 'unknown action' });
};

export const config = { path: '/.netlify/functions/axis-brain-queue' };
