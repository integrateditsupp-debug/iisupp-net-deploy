/**
 * ARIA Trace Bridge — Aperture live-monitoring relay
 *
 * POST /.netlify/functions/aria-trace   { ...traceObject }
 *   → stores trace in Netlify Blobs (aria-traces store, key: "log")
 *   → returns { ok: true }
 *
 * GET  /.netlify/functions/aria-trace?n=20
 *   → returns { traces: [...last n] }
 *
 * DELETE /.netlify/functions/aria-trace
 *   → clears all stored traces
 *
 * CORS: open to all origins (including file://) so the local Aperture
 * dashboard can poll from the developer's machine.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME  = 'aria-traces';
const STORE_KEY   = 'log';
const MAX_TRACES  = 200;

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'no-store',
  };
}
function json(status, body) {
  return {
    statusCode: status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event, context) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }

  let store;
  try {
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (e) {
    // Blobs may not be available on first deploy — degrade gracefully
    console.error('[aria-trace] Blobs unavailable:', e.message);
    return json(503, { error: 'trace store not available', detail: e.message });
  }

  // ── DELETE — clear log ──────────────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    await store.set(STORE_KEY, JSON.stringify([]));
    return json(200, { ok: true, cleared: true });
  }

  // ── GET — return recent traces ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const n     = Math.min(parseInt(event.queryStringParameters?.n || '50', 10), MAX_TRACES);
    const since = parseInt(event.queryStringParameters?.since || '0', 10); // unix ms
    let traces  = [];
    try {
      const raw = await store.get(STORE_KEY);
      if (raw) traces = JSON.parse(raw);
    } catch (e) { /* cold start — no data yet */ }

    const filtered = since > 0 ? traces.filter(t => t.ts > since) : traces;
    return json(200, { traces: filtered.slice(0, n), total: traces.length });
  }

  // ── POST — append trace ─────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let incoming;
    try { incoming = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'invalid JSON' }); }

    // Validate minimum shape
    if (!incoming.ts || !incoming.userMsg) {
      return json(400, { error: 'trace must include ts and userMsg' });
    }

    let traces = [];
    try {
      const raw = await store.get(STORE_KEY);
      if (raw) traces = JSON.parse(raw);
    } catch (e) { /* no prior data */ }

    traces.unshift(incoming);              // newest first
    if (traces.length > MAX_TRACES) traces.length = MAX_TRACES;

    await store.set(STORE_KEY, JSON.stringify(traces));
    return json(200, { ok: true, stored: traces.length });
  }

  return json(405, { error: 'method not allowed' });
};
