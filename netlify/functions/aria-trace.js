/**
 * ARIA Trace Bridge — Aperture live-monitoring relay
 *
 * POST /.netlify/functions/aria-trace   { ...traceObject }
 *   → stores trace in Netlify Blobs (aria-traces store, key: "log")
 *   → returns { ok: true }
 *   AUTH: X-Internal-Token = INTERNAL_WEBHOOK_SECRET (what aria-chat.js sends) or an admin token.
 *
 * GET  /.netlify/functions/aria-trace?n=20
 *   → returns { traces: [...last n] }
 *   AUTH: Aperture admin JWT (Authorization: Bearer …) or admin token (X-Admin-Token).
 *
 * DELETE /.netlify/functions/aria-trace
 *   → clears all stored traces
 *   AUTH: same as GET.
 *
 * CORS: open to all origins (including file://) so the local Aperture dashboard can poll from the
 * developer's machine — it must send its Aperture token; without one the response is 401 (audit 2026-10-08
 * top-10 #5: the last 200 user messages + replies were readable, and deletable, by anyone).
 *
 * Stored trace shape is whitelisted + capped (audit §4 size limits); GET/DELETE responses are unchanged.
 */

const { getStore } = require('@netlify/blobs');
const { bearerFromEvent } = require('./_verify-bearer.cjs');
const { requireAdminToken, adminGateResponse } = require('./lib/admin-gate.cjs');

const STORE_NAME  = 'aria-traces';
const STORE_KEY   = 'log';
const MAX_TRACES  = 200;
const ADMIN_ENVS  = ['ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN', 'APERTURE_ADMIN_PASSWORD'];
const WRITE_ENVS  = ['INTERNAL_WEBHOOK_SECRET', 'ARIA_ADMIN_TOKEN', 'SENTINEL_ADMIN_TOKEN'];

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Internal-Token',
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

// Keep only the fields the dashboard renders, each capped — never persist an arbitrary object.
function sanitizeTrace(t) {
  const str = (v, n) => (v == null ? '' : String(v)).slice(0, n);
  return {
    ts:          Number(t.ts) || Date.now(),
    sessionId:   str(t.sessionId, 80),
    turnIndex:   Number.isFinite(Number(t.turnIndex)) ? Number(t.turnIndex) : 0,
    userMsg:     str(t.userMsg, 2000),
    ariaResp:    str(t.ariaResp, 3000),
    emotion:     str(t.emotion, 32),
    tone:        str(t.tone, 32),
    resolved:    Boolean(t.resolved),
    escalate:    Boolean(t.escalate),
    category:    str(t.category, 32),
    suggestions: Array.isArray(t.suggestions) ? t.suggestions.slice(0, 5).map((s) => str(s, 200)) : [],
    latencyMs:   Number(t.latencyMs) || 0,
    source:      str(t.source || 'aria-chat', 40),
  };
}

exports.handler = async (event, context) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET' || event.httpMethod === 'DELETE') {
    if (!bearerFromEvent(event)) {
      const gate = requireAdminToken(event, { envNames: ADMIN_ENVS, allowBodyToken: false });
      if (!gate.ok) return adminGateResponse(gate, cors());
    }
  } else if (event.httpMethod === 'POST') {
    if (!bearerFromEvent(event)) {
      const gate = requireAdminToken(event, { envNames: WRITE_ENVS, allowBodyToken: false });
      if (!gate.ok) return adminGateResponse(gate, cors());
    }
  }

  let store;
  try {
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (e) {
    // Blobs may not be available on first deploy — degrade gracefully
    console.error('[aria-trace] Blobs unavailable:', e.message);
    return json(503, { error: 'trace store not available', error_code: 'trace_store_unavailable' });
  }

  // ── DELETE — clear log ──────────────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    await store.set(STORE_KEY, JSON.stringify([]));
    return json(200, { ok: true, cleared: true });
  }

  // ── GET — return recent traces ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const n     = Math.min(parseInt(event.queryStringParameters?.n || '50', 10) || 50, MAX_TRACES);
    const since = parseInt(event.queryStringParameters?.since || '0', 10) || 0; // unix ms
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
    if (!incoming || !incoming.ts || !incoming.userMsg) {
      return json(400, { error: 'trace must include ts and userMsg' });
    }

    let traces = [];
    try {
      const raw = await store.get(STORE_KEY);
      if (raw) traces = JSON.parse(raw);
    } catch (e) { /* no prior data */ }

    traces.unshift(sanitizeTrace(incoming));   // newest first
    if (traces.length > MAX_TRACES) traces.length = MAX_TRACES;

    await store.set(STORE_KEY, JSON.stringify(traces));
    return json(200, { ok: true, stored: traces.length });
  }

  return json(405, { error: 'method not allowed' });
};
