// netlify/functions/aria-mesh-router.mjs
// ARIA Mesh Router â Ruflo-inspired SwarmCoordinator port to Netlify Functions.
// $0 cost. No new infra. Mirrors v3/src/coordination/application/SwarmCoordinator.ts patterns.
//
// Responsibilities:
//   1. Load mesh-registry.json (the agent universe)
//   2. Score & select best agent for incoming query (Thompson-sampled bandit + load balance + capability match)
//   3. Dispatch to selected agent's endpoint
//   4. On low confidence â cascade to next-best up to max_hops
//   5. Log every hop to mesh-events (the bus)
//   6. Return standardized BIT envelope
//
// Wire from aria-core.js by calling /.netlify/functions/aria-mesh-router instead of direct agent endpoints.
// Backwards compatible: feature flag window.ARIA_MESH=true gates the routing.

import registryRaw from '../../mesh-registry.json' with { type: 'json' };

const MESH_EVENTS_URL = '/.netlify/functions/aria-mesh-events';
const FETCH_TIMEOUT_DEFAULT = 25000;

// ===== Bandit state (in-memory per-cold-start; persisted via mesh-events) =====
// Beta(alpha, beta) per agent. Wins â alpha++. Losses â beta++.
// Thompson sample = Beta.sample() per agent then argmax.
const bandit = new Map(); // agentId â { alpha, beta }

function getBandit(agentId) {
  if (!bandit.has(agentId)) bandit.set(agentId, { alpha: 1, beta: 1 });
  return bandit.get(agentId);
}

function betaSample({ alpha, beta }) {
  // Cheap Beta sample via two Gamma samples (Marsaglia & Tsang for kâ¥1 falls to exp for k=1)
  const gammaSample = (k) => {
    if (k < 1) {
      const u = Math.random();
      return gammaSample(k + 1) * Math.pow(u, 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x, v;
      do {
        x = gaussian();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const gaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

// ===== Capability matching =====
function capabilityMatch(agent, requestedCapability, query) {
  if (!agent || agent.status !== 'active') return 0;
  if (requestedCapability && agent.capabilities.includes(requestedCapability)) return 1.0;
  // Soft match: keyword overlap between query and capabilities/tags
  if (!query) return 0.3;
  const qWords = String(query).toLowerCase().split(/\W+/).filter(Boolean);
  const tags = [...(agent.capabilities || []), ...(agent.tags || []), agent.type || ''].join(' ').toLowerCase();
  let hits = 0;
  for (const w of qWords) if (w.length > 2 && tags.includes(w)) hits++;
  return Math.min(0.9, 0.2 + hits * 0.15);
}

// ===== Agent selection =====
function selectAgent(registry, { query, requestedCapability, phase, excludeIds = [] }) {
  let pool = registry.agents.filter(a =>
    a.status === 'active' &&
    !excludeIds.includes(a.id)
  );

  // Phase filter (optional)
  if (phase && registry.phases?.[phase]) {
    const allowed = new Set(registry.phases[phase]);
    pool = pool.filter(a => allowed.has(a.id));
  }

  // Score each candidate
  const scored = pool.map(a => {
    const cap = capabilityMatch(a, requestedCapability, query);
    if (cap === 0) return null;
    const b = getBandit(a.id);
    const sample = betaSample(b);
    const score = (cap * 0.5) + (sample * 0.3) + ((a.weight || 0.5) * 0.2);
    return { agent: a, score, cap, sample };
  }).filter(Boolean);

  if (scored.length === 0) return null;
  scored.sort((x, y) => y.score - x.score);
  return scored[0];
}

// ===== Dispatch =====
async function dispatch(agent, payload, host, timeoutMs = FETCH_TIMEOUT_DEFAULT) {
  if (agent.endpoint.startsWith('local://')) {
    // External executor (OpenCode, Claude SDK) â return planning envelope for client-side dispatch
    return {
      __external: true,
      agentId: agent.id,
      target: agent.endpoint,
      payload,
      message: `External executor required: ${agent.endpoint}. Client must dispatch.`
    };
  }
  const url = agent.endpoint.startsWith('http') ? agent.endpoint : `https://${host}${agent.endpoint}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: agent.method || 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) {
      return { __error: true, status: res.status, statusText: res.statusText };
    }
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    clearTimeout(t);
    return { __error: true, message: err?.message || String(err) };
  }
}

// ===== Event logging (fire-and-forget) =====
async function logEvent(host, event) {
  const url = `https://${host}${MESH_EVENTS_URL}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (_) { /* swallow */ }
}

// ===== Bandit update =====
function updateBandit(agentId, success) {
  const b = getBandit(agentId);
  if (success) b.alpha += 1; else b.beta += 1;
}

function pickConfidence(result) {
  if (result == null) return 0;
  if (typeof result.confidence === 'number') return result.confidence;
  if (result.__error) return 0;
  if (result.__external) return 0.8; // planning envelope counts as routed
  if (typeof result.answer === 'string' && result.answer.length > 0) return 0.7;
  return 0.5;
}

// ===== Main handler =====
export default async (req, _context) => {
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'aria-mesh-router',
      version: registryRaw.version,
      agents: registryRaw.agents.length,
      active: registryRaw.agents.filter(a => a.status === 'active').length
    }), { headers: { 'content-type': 'application/json' } });
  }

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const {
    query = '',
    requestedCapability = null,
    phase = null,
    context = {},
    payloadOverride = null
  } = body || {};

  const maxHops = registryRaw.router_policy?.max_hops || 4;
  const lowConf = registryRaw.router_policy?.low_confidence_threshold || 0.55;
  const timeoutMs = registryRaw.router_policy?.timeout_ms || FETCH_TIMEOUT_DEFAULT;

  const tried = [];
  const trail = [];
  let finalResult = null;
  let finalAgent = null;

  const traceId = `mesh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (let hop = 0; hop < maxHops; hop++) {
    const pick = selectAgent(registryRaw, { query, requestedCapability, phase, excludeIds: tried });
    if (!pick) break;

    const agent = pick.agent;
    tried.push(agent.id);

    const payload = payloadOverride ?? { query, context, _trace: { traceId, hop } };
    const startedAt = Date.now();
    const result = await dispatch(agent, payload, host, timeoutMs);
    const durationMs = Date.now() - startedAt;
    const conf = pickConfidence(result);
    const success = conf >= (agent.confidence_threshold || lowConf) && !result.__error;

    updateBandit(agent.id, success);

    const hopEvent = {
      traceId,
      hop,
      agentId: agent.id,
      type: agent.type,
      score: pick.score,
      confidence: conf,
      durationMs,
      success,
      error: result.__error ? (result.message || result.statusText) : undefined,
      ts: Date.now()
    };
    trail.push(hopEvent);
    logEvent(host, { kind: 'mesh-hop', ...hopEvent });

    if (success) {
      finalResult = result;
      finalAgent = agent;
      break;
    }
  }

  const envelope = {
    ok: !!finalResult,
    traceId,
    answeredBy: finalAgent?.id || null,
    answeredByType: finalAgent?.type || null,
    hops: trail.length,
    trail,
    result: finalResult,
    fallbackUsed: trail.length > 1,
    timestamp: Date.now()
  };

  logEvent(host, { kind: 'mesh-trace', traceId, hops: trail.length, success: !!finalResult, ts: Date.now() });

  return new Response(JSON.stringify(envelope), {
    status: finalResult ? 200 : 503,
    headers: { 'content-type': 'application/json' }
  });
};

export const config = { path: '/api/mesh-router' };
