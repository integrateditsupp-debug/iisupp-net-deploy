// netlify/functions/aria-mesh-events.mjs
// ARIA Mesh Event Bus â append-only ring buffer in Netlify Blobs.
// Ruflo-inspired (v3/src/coordination eventBus). $0 cost.
//
// GET  /api/mesh-events            â recent events (last N, default 100, max 500)
// GET  /api/mesh-events?agent=X    â filter by agentId
// GET  /api/mesh-events?since=ts   â only events newer than timestamp
// POST /api/mesh-events            â append event {kind, agentId?, traceId?, ts?, ...}
//
// Auto-prunes events older than 24h on every write.

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'aria-mesh-events';
const KEY = 'events.json';
const MAX_RETAIN = 5000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function loadAll() {
  const store = getStore(STORE_NAME);
  const raw = await store.get(KEY, { type: 'json' });
  if (!raw || !Array.isArray(raw.events)) return { events: [] };
  return raw;
}

async function saveAll(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON(KEY, data);
}

function prune(events) {
  const cutoff = Date.now() - MAX_AGE_MS;
  const recent = events.filter(e => (e.ts || 0) >= cutoff);
  if (recent.length <= MAX_RETAIN) return recent;
  return recent.slice(-MAX_RETAIN);
}

export default async (req, _context) => {
  const url = new URL(req.url);

  if (req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const event = {
      kind: body.kind || 'unknown',
      agentId: body.agentId || null,
      traceId: body.traceId || null,
      ts: body.ts || Date.now(),
      ...body
    };
    const data = await loadAll();
    data.events.push(event);
    data.events = prune(data.events);
    await saveAll(data);
    return new Response(JSON.stringify({ ok: true, retained: data.events.length }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  // GET
  const data = await loadAll();
  let events = data.events || [];

  const agent = url.searchParams.get('agent');
  if (agent) events = events.filter(e => e.agentId === agent);

  const sinceRaw = url.searchParams.get('since');
  if (sinceRaw) {
    const since = parseInt(sinceRaw, 10);
    if (!Number.isNaN(since)) events = events.filter(e => (e.ts || 0) >= since);
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  events = events.slice(-limit);

  // Aggregate quick stats for the graph
  const agentCounts = {};
  const edges = {};
  for (const e of events) {
    if (e.agentId) agentCounts[e.agentId] = (agentCounts[e.agentId] || 0) + 1;
    if (e.kind === 'mesh-hop' && e.traceId) {
      // edges built from traceId hop sequence
      if (!edges[e.traceId]) edges[e.traceId] = [];
      edges[e.traceId].push({ id: e.agentId, hop: e.hop, ts: e.ts, success: e.success });
    }
  }
  // Flatten into edge list: from prev â to current
  const edgeList = [];
  for (const trace of Object.values(edges)) {
    trace.sort((a, b) => a.hop - b.hop);
    for (let i = 1; i < trace.length; i++) {
      edgeList.push({ from: trace[i - 1].id, to: trace[i].id, ts: trace[i].ts, success: trace[i].success });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    count: events.length,
    events,
    stats: {
      agentCounts,
      edges: edgeList.slice(-200) // cap visualization payload
    }
  }), { headers: { 'content-type': 'application/json' } });
};

export const config = { path: '/api/mesh-events' };
