// aria-self-audit v1 — the nightly "is ARIA actually getting smarter?" auditor.
// (Ahmad 2026-06-01)
//
// The learning loop produces thousands of agent⇄ARIA exchanges, but until now nothing
// graded them. This reads the recent learning logs + the retrieval index, finds the
// DEAD-END topics (agents asked, ARIA could not answer), re-queues them as PRIORITY
// seeds so the loop re-investigates them next, and records a smarter-signal delta
// (success-rate trend + retrievable-bit growth) the monitor can show.
//
// Closes the improvement loop: write (loop) -> serve (read-back) -> GRADE + retry (this).
//
// Deterministic. No LLM. $0 — only reads/writes the existing blob stores.
//
// GET /.netlify/functions/aria-self-audit?days=3
//   -> { ok, attempts, answered, successRate, deadEnds:[topic], requeued, indexed, delta }
//
// Fired nightly by aria-self-audit-cron (30 3 * * *, just after promote rebuilds the index).

import { getStore } from '@netlify/blobs';

const SESSIONS = 'aria-learning-sessions';
const KB_LIVE = 'aria-kb-live';
const MAX_REQUEUE = 12;

// Same gate aria-learning-loop uses to decide a bit is a real answer.
function isRealAnswer(r) {
  const s = String(r || '').trim();
  if (s.length < 25) return false;
  if (/^(no curated answer|no-response|fetch-error|no response)/i.test(s)) return false;
  return true;
}

export default async (request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '3', 10) || 3, 1), 14);

  const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
  const kbLive = getStore({ name: KB_LIVE, consistency: 'strong' });

  // 1. Gather recent log bits (today + previous days)
  const bits = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    try {
      const raw = await sessions.get(`log/${day}.jsonl`);
      if (!raw) continue;
      for (const line of raw.split('\n')) {
        if (!line) continue;
        try { const b = JSON.parse(line); if (b && b.q && !b.event) bits.push(b); } catch (_) {}
      }
    } catch (_) {}
  }

  // 2. Classify success per topic. A turn "succeeded" if ARIA gave a real, recognised,
  //    non-trivial-confidence answer.
  const byTopic = {};
  let attempts = 0, answered = 0;
  for (const b of bits) {
    const tp = String(b.tp || '').toLowerCase().trim();
    if (!tp) continue; // older bits without a topic tag — skip
    attempts++;
    const ok = isRealAnswer(b.r) && b.s !== 'UNKNOWN' && (b.c || 0) >= 0.4;
    if (ok) answered++;
    if (!byTopic[tp]) byTopic[tp] = { att: 0, ok: 0 };
    byTopic[tp].att++;
    if (ok) byTopic[tp].ok++;
  }
  const successRate = attempts ? +(answered / attempts).toFixed(3) : 0;

  // 3. Dead-end topics: asked >=2 times across the window, NEVER answered.
  const deadEnds = Object.entries(byTopic)
    .filter(([, v]) => v.att >= 2 && v.ok === 0)
    .sort((a, b) => b[1].att - a[1].att)
    .map(([t]) => t)
    .slice(0, MAX_REQUEUE);

  // 4. Re-queue the dead-ends as PRIORITY seeds so the loop re-investigates them next.
  //    Bounded (MAX_REQUEUE) and deduped against the existing queue.
  let requeued = 0;
  try {
    const state = await sessions.get('active.json', { type: 'json' });
    if (state && Array.isArray(state.queue)) {
      const have = new Set(state.queue);
      const add = deadEnds.filter(t => !have.has(t));
      if (add.length) {
        state.queue = add.concat(state.queue); // front-load = next to be asked
        requeued = add.length;
      }
      state.lastSelfAudit = new Date().toISOString();
      await sessions.set('active.json', JSON.stringify(state), { contentType: 'application/json' });
    }
  } catch (_) {}

  // 5. How many bits are actually RETRIEVABLE (the read-back index).
  let indexed = 0;
  try {
    const idx = await kbLive.get('kb-index.json', { type: 'json' });
    indexed = (idx && Array.isArray(idx.entries) && idx.entries.length) || 0;
  } catch (_) {}

  // 6. Delta vs the last audit — the actual "getting smarter" signal.
  let prev = null;
  try { prev = await sessions.get('self-audit-last.json', { type: 'json' }); } catch (_) {}
  const delta = prev ? {
    successRate: +(successRate - (prev.successRate || 0)).toFixed(3),
    indexed: indexed - (prev.indexed || 0)
  } : null;

  const summary = { ok: true, ranAt: new Date().toISOString(), days, attempts, answered, successRate, deadEnds, requeued, indexed, delta };
  try { await sessions.set('self-audit-last.json', JSON.stringify(summary), { contentType: 'application/json' }); } catch (_) {}

  // 7. Announce on the mesh event bus so the command center surfaces it (best effort).
  try {
    const host = request.headers.get('host') || url.host;
    await fetch(`https://${host}/api/mesh-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'self-audit', agentId: 'aria-self-audit', successRate, deadEnds: deadEnds.length, requeued, indexed, ts: Date.now() })
    });
  } catch (_) {}

  console.log('[aria-self-audit]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: cors });
};
