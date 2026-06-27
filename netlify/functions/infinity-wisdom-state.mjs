// infinity-wisdom-state — JWT-gated data + control endpoint for the Infinity Wisdom dashboard.
//
//   GET  /.netlify/functions/infinity-wisdom-state        (Authorization: Bearer <jwt>)
//        → { ok, state:{ counts, agents, nodes, stopped, updatedAt } }  (FULL named tree — AUTHED only)
//   POST /.netlify/functions/infinity-wisdom-state         (Authorization: Bearer <jwt>)
//        body { action:'sync', state:{...} }   → the local engine pushes its full state into Blobs
//        body { action:'stop' }                → arms the remote STOP flag (the local engine honors it)
//
// SECURITY (matches the axis-state leak fix): the FULL named tree is returned ONLY to an authenticated
// aperture session — an unauthenticated caller gets 401 and NOTHING (no Blobs read even happens). The
// only public surface is the static, counts-only `infinity-wisdom-public.json` written by the engine.
// Belt-and-braces: GET also passes the payload through a leak filter, so even a future bug can't ship a
// sensitive field on the public-shaped portion.

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: CORS });

const STORE = 'infinity-wisdom';
const STATE_KEY = 'state.json';
const STOP_KEY = 'stop.flag';

// Counts-only projection for any context that should not carry names (mirrors the engine's scrub).
export function publicCounts(state = {}) {
  const c = (state && state.counts) || {};
  const agents = Array.isArray(state.agents) ? state.agents.filter((a) => !a.retired) : [];
  return {
    agentsActive: agents.length,
    runningNow: (state.runningAgentIds || []).length,
    tasksDone: Number(c.tasksDone || 0),
    branchesSpawned: Number(c.branchesSpawned || 0),
    newAgentsTotal: Number(c.newAgentsTotal || 0),
    approvalsPending: Number(c.approvalsPending || 0),
  };
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // GATE — no valid aperture JWT ⇒ 401 and we never touch the data store.
  const claims = verifyAperture(request);
  if (!claims) return json(401, { error: 'auth required' });

  let store;
  try { store = getStore({ name: STORE, consistency: 'strong' }); } catch (e) { return json(500, { error: 'store unavailable', detail: String(e && e.message || e) }); }

  if (request.method === 'GET') {
    let state = null, stopFlag = null;
    try { state = await store.get(STATE_KEY, { type: 'json' }); } catch {}
    try { stopFlag = await store.get(STOP_KEY, { type: 'json' }); } catch {}
    if (!state) return json(200, { ok: true, empty: true, state: { counts: publicCounts({}), agents: [], nodes: [], stopped: Boolean(stopFlag && stopFlag.stopped), updatedAt: null } });
    // Authed users see the full named tree; counts always present for the headline tiles.
    return json(200, { ok: true, state: {
      counts: publicCounts(state),
      agents: (state.agents || []).map((a) => ({ id: a.id, name: a.name, capabilities: a.capabilities || [], source: a.source || '', retired: a.retired === true })),
      nodes: (state.nodes || []).slice(0, 200),
      stopped: Boolean((stopFlag && stopFlag.stopped) || state.stopped),
      stopReason: (stopFlag && stopFlag.reason) || state.stopReason || null,
      updatedAt: state.updatedAt || null,
    } });
  }

  if (request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch { return json(400, { error: 'bad json' }); }
    if (body.action === 'stop') {
      await store.setJSON(STOP_KEY, { stopped: true, reason: `web STOP by ${claims.sub || claims.email || 'aperture'}`, at: new Date().toISOString() });
      return json(200, { ok: true, stopped: true });
    }
    if (body.action === 'resume') {
      await store.setJSON(STOP_KEY, { stopped: false, at: new Date().toISOString() });
      return json(200, { ok: true, stopped: false });
    }
    if (body.action === 'sync' && body.state && typeof body.state === 'object') {
      await store.setJSON(STATE_KEY, body.state); // the local engine pushes its full state here (authed)
      return json(200, { ok: true, synced: true });
    }
    return json(400, { error: 'unknown action' });
  }

  return json(405, { error: 'GET or POST only' });
};
