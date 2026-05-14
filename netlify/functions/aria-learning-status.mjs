// aria-learning-status — JWT-gated status endpoint for Aperture dashboard
//
// GET /.netlify/functions/aria-learning-status
//   → { ok, totalBits, agents, recentBits, recentlyBornAgents, lastCycle, kbLiveCount }
//
// Same JWT pattern as aperture-tickets / aperture-audit. Reuses the existing
// admin login.

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const SESSIONS = 'aria-learning-sessions';
const KB_LIVE = 'aria-kb-live';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // JWT gate via project auth helper
  const claims = verifyAperture(request);
  if (!claims) return jsonResp(401, cors, { error: 'auth required' });

  try {
    const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
    const kbLive = getStore({ name: KB_LIVE, consistency: 'strong' });

    const state = (await sessions.get('active.json', { type: 'json' })) || null;

    // List recent bit log entries (today + yesterday)
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let logToday = '', logYesterday = '';
    try { logToday = (await sessions.get(`log/${today}.jsonl`)) || ''; } catch (_) {}
    try { logYesterday = (await sessions.get(`log/${yesterday}.jsonl`)) || ''; } catch (_) {}

    const recent = (logToday + '\n' + logYesterday)
      .split('\n')
      .filter(Boolean)
      .slice(-50)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);

    // Count learn-* bits in KB cache
    let kbLiveCount = 0;
    try {
      const list = await kbLive.list({ prefix: 'learn-' });
      kbLiveCount = (list && list.blobs && list.blobs.length) || 0;
    } catch (_) {}

    return jsonResp(200, cors, {
      ok: true,
      totalBits: state ? state.bitsLearned : 0,
      agents: state ? state.roster.map(a => ({ name: a.name, role: a.role, born: !!a.born_at })) : [],
      newAgentsBorn: state ? state.newAgentsBorn || 0 : 0,
      recentBits: recent.slice(-20),
      recentlyBornAgents: state ? state.roster.filter(a => a.born_at).slice(-5) : [],
      queueDepth: state ? state.queue.length : 0,
      lastTopic: state ? state.lastTopic : null,
      lastAgent: state ? state.lastAgent : null,
      kbLiveCount,
      sessionStarted: state ? state.born : null
    });
  } catch (e) {
    return jsonResp(500, cors, { error: String(e && e.message || e) });
  }
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}
