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

// Recent conversation turns riding with a question or task. Kept small and typed: the worker feeds
// these to a model on Ahmad's machine, so nothing but plain role/content pairs may pass.
function sanitizeTurns(turns) {
  if (!Array.isArray(turns)) return [];
  return turns
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
}

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
      await store.setJSON(`pending/${id}`, {
        id, query, t: Date.now(),
        // The conversation and the on-screen board, so the worker's model call is not an orphan.
        // Sanitized here because this mailbox is the trust boundary between cloud and machine.
        turns: sanitizeTurns(body.turns),
        board: String(body.board || '').slice(0, 1500),
      });
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
    // The gate at the CHOKE POINT, because both bankers (the cloud cascade's learnBack and the
    // local worker's bank()) flow through here and each had its own partial gate. Measured
    // 2026-08-12, the store held — promoted:true, recall-eligible — "tell me the most prioritized
    // item", "give me status update", "tell me what do we have in the queue", "you already said
    // that what are the", "listen look at". Each is a future wrong answer: a question about LIVE
    // STATE banks an answer that is stale in minutes and recalls at 55%+ forever; a continuation
    // or a correction banks a sentence about the conversation, not the world. "status" is in the
    // list and "update" is not, deliberately — "give me status update" is state, "how do I fix a
    // stuck windows update" is knowledge.
    const qq = String(question || topic || '').trim();
    const STATE_QUERY = /\b(?:priorit\w*|queued?|board|overdue|status|working on|to.?dos?|follow.?ups?|due today|most (?:urgent|overdue|important)|in (?:the )?queue)\b/i;
    const DEIXIS = /^\s*(?:tell me more|more about|go on|continue|what about (?:it|that|them)|about (?:it|that))\b|\b(?:you (?:already|just) said|said that|talking about|not what i)\b/i;
    if (STATE_QUERY.test(qq) || DEIXIS.test(qq) || qq.split(/\s+/).filter(Boolean).length < 3) {
      return json(200, { ok: false, reason: 'not-knowledge', detail: 'state, deixis, or garble — never banked' });
    }
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

  // Recall a previously-banked answer. THIS IS WHY IT EXISTS (measured 2026-08-11):
  // aria-kb-query.mjs is a v1-style function (`export async function handler(event)`), and Netlify
  // does not give those the Blobs context — so its loadLiveChunks() silently catches, caches an
  // empty list for 10 minutes, and reports live_chunks: 0 forever. Every learned bit the promote
  // cron has ever written is invisible to it. Rather than convert that production function (it
  // serves ARIA and Sentinel), the cascade reads the learned store here, in v2, where Blobs works.
  // aria-kb-query still serves the 281 static chunks exactly as before — this only adds recall.
  if (action === 'recall') {
    const query = String(body.query || '').trim();
    if (!query) return json(400, { error: 'query required' });
    try {
      const kb = getStore({ name: 'aria-kb-live', consistency: 'eventual' });
      const idx = await kb.get('kb-index.json', { type: 'json' });
      if (!idx || !Array.isArray(idx.entries)) return json(200, { ok: true, match: false, live: 0 });

      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      const qWords = new Set(norm(query));
      if (!qWords.size) return json(200, { ok: true, match: false, live: idx.entries.length });

      // Score on topic overlap first — cheap, and the topic IS the original question.
      const ranked = idx.entries
        .filter((e) => e && e.promoted && e.key)
        .map((e) => {
          const tWords = norm(e.topic);
          const hits = tWords.filter((w) => qWords.has(w)).length;
          return { e, score: tWords.length ? (hits / Math.max(qWords.size, tWords.length)) * 100 : 0 };
        })
        .sort((a, b) => b.score - a.score);

      const top = ranked[0];
      // 55% token overlap: high enough that a different question never matches, low enough that a
      // re-phrasing of the same question still does.
      if (!top || top.score < 55) return json(200, { ok: true, match: false, best: top ? Math.round(top.score) : 0, live: ranked.length });

      const rec = await kb.get(top.e.key, { type: 'json' });
      if (!rec || !rec.body) return json(200, { ok: true, match: false, live: ranked.length });
      return json(200, { ok: true, match: true, confidence: Math.round(top.score),
        answer: rec.body, topic: rec.topic, source: rec.source || 'aria-brain-learned' });
    } catch (e) { return json(200, { ok: false, reason: 'recall-failed', detail: e.message }); }
  }


  // A TASK, not a question. AXIS queues real work here — build videos, upload an approved batch,
  // or fix itself with Claude Code — and the worker on Ahmad's machine runs it. Deliberately a
  // narrow, named set: the worker maps each `kind` to a specific command, so a compromised or
  // confused caller cannot ask it to run arbitrary shell.
  if (action === 'task') {
    const kind = String(body.kind || '');
    // A NAMED allow-list is the whole safety model: the cloud side can ask for "code.build", it can
    // never ask for "rm -rf". Every kind here maps to a fixed handler in axis-brain-worker.mjs.
    // cowork.plan is read-only (no edit permission); code.build edits the repo and is confirm-gated
    // on the console side, exactly like self.fix.
    // fleet.* is the management rail Ahmad asked for (2026-08-12, "give axis full access to manage
    // them"): the worker maps each verb to a fixed PowerShell scheduled-task cmdlet against its own
    // named roster — the queue can name an agent, it can never name a command.
    const ALLOWED = ['video.make', 'video.short', 'video.upload', 'video.status', 'self.fix',
      'cowork.ask', 'cowork.plan', 'code.build', 'machine.run',
      'fleet.status', 'fleet.run', 'fleet.pause', 'fleet.resume'];
    if (!ALLOWED.includes(kind)) return json(400, { error: 'unknown task kind' });
    const id = 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    try {
      await store.setJSON(`task/${id}`, {
        id, kind, arg: String(body.arg || '').slice(0, 2000),
        confirmed: body.confirmed === true, t: Date.now(),
        // Cowork and Claude Code need the conversation too: "remove the items you just mentioned"
        // is meaningless as a lone sentence — the antecedent lives in the prior turns.
        turns: sanitizeTurns(body.turns),
        board: String(body.board || '').slice(0, 1500),
      });
      return json(200, { ok: true, id, kind });
    } catch (e) { return json(200, { ok: false, reason: 'task-failed', detail: e.message }); }
  }

  // Progress feed — what the worker and agents are doing right now, so AXIS can volunteer it
  // instead of Ahmad having to ask.
  if (action === 'progress') {
    try {
      const list = await store.list({ prefix: 'progress/' });
      const out = [];
      for (const b of (list.blobs || []).slice(-25)) {
        const p = await store.get(b.key, { type: 'json' }).catch(() => null);
        if (p) out.push(p);
      }
      out.sort((a, b) => (b.t || 0) - (a.t || 0));
      return json(200, { ok: true, events: out.slice(0, 12) });
    } catch { return json(200, { ok: true, events: [] }); }
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
