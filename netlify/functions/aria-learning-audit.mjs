// aria-learning-audit — JWT-gated audit endpoint for learning monitor
//
// GET /.netlify/functions/aria-learning-audit?format=json|csv&days=2
//
// Returns: complete bit log + concerning events with full context
//   - timestamp (ISO)
//   - box (agent name)
//   - question
//   - response
//   - state (canonical state code)
//   - confidence
//   - objective (agent role)
//   - concerning (bool) — true if confidence < 0.3 OR state=UNKNOWN OR fetch-error OR agent-born event
//   - reason (why concerning, if so)
//
// Format=csv returns spreadsheet-ready CSV (Excel opens this).
// Used by /aperture-learning.html dashboard.

import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';

const SESSIONS = 'aria-learning-sessions';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // JWT gate
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const secret = process.env.APERTURE_JWT_SECRET;
  if (!secret) return jsonResp(500, cors, { error: 'jwt secret not configured' });
  try { jwt.verify(token, secret); }
  catch { return jsonResp(401, cors, { error: 'unauthorized' }); }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const days = Math.min(parseInt(url.searchParams.get('days') || '2', 10), 14);

  const sessions = getStore({ name: SESSIONS, consistency: 'strong' });

  // Pull state for agent roles
  let state = null;
  try { state = (await sessions.get('active.json', { type: 'json' })) || null; } catch (_) {}
  const roleByAgent = {};
  if (state && state.roster) {
    for (const a of state.roster) roleByAgent[a.name] = a.role || '';
  }

  // Pull last N days of bit logs
  const allBits = [];
  for (let d = 0; d < days; d++) {
    const dateStr = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    let log = '';
    try { log = (await sessions.get(`log/${dateStr}.jsonl`)) || ''; } catch (_) {}
    if (!log) continue;
    for (const line of log.split('\n')) {
      if (!line.trim()) continue;
      try { allBits.push(JSON.parse(line)); } catch (_) {}
    }
  }

  // Enrich every bit with concerning detection
  const rows = allBits.map(b => {
    if (b.event === 'agent-born') {
      return {
        timestamp: new Date(b.t || Date.now()).toISOString(),
        box: 'system',
        question: 'Spawn agent',
        response: `Born new agent: ${b.name} (role: ${b.role})`,
        state: 'AGENT.BORN',
        confidence: 1,
        objective: 'self-spawn on blocked topic',
        concerning: true,
        reason: 'new agent born — verify topic coverage gap is real'
      };
    }
    const concerning =
      (b.c != null && b.c < 0.3) ||
      b.s === 'UNKNOWN' ||
      b.r === 'fetch-error' ||
      b.r === 'no-response';
    let reason = '';
    if (b.r === 'fetch-error') reason = 'aria-research call failed';
    else if (b.r === 'no-response') reason = 'aria-research returned non-200';
    else if (b.s === 'UNKNOWN') reason = 'no curated state matched';
    else if (b.c != null && b.c < 0.3) reason = 'low confidence (<0.3)';
    return {
      timestamp: new Date(b.t || Date.now()).toISOString(),
      box: b.a || 'unknown',
      question: b.q || '',
      response: b.r || '',
      state: b.s || 'UNKNOWN',
      confidence: typeof b.c === 'number' ? b.c : 0,
      objective: roleByAgent[b.a] || '',
      concerning: !!concerning,
      reason
    };
  });

  // Stats
  const concerns = rows.filter(r => r.concerning);
  const byAgent = {};
  for (const r of rows) {
    if (!byAgent[r.box]) byAgent[r.box] = { total: 0, concerning: 0, lastSeen: null };
    byAgent[r.box].total++;
    if (r.concerning) byAgent[r.box].concerning++;
    if (!byAgent[r.box].lastSeen || r.timestamp > byAgent[r.box].lastSeen) {
      byAgent[r.box].lastSeen = r.timestamp;
    }
  }

  // Autonomy score (0-100) — heuristic combining bits, agents, KB cache, run-history
  const totalBits = state ? (state.bitsLearned || 0) : 0;
  const agentsActive = state ? state.roster.length : 0;
  const newAgentsBorn = state ? (state.newAgentsBorn || 0) : 0;
  const sessionStartedMs = state && state.born ? new Date(state.born).getTime() : Date.now();
  const daysRunning = Math.max(0, (Date.now() - sessionStartedMs) / 86400000);

  const autonomyBitsScore = Math.min(40, (totalBits / 500) * 40);          // 500 bits = full
  const autonomyAgentsScore = Math.min(20, (agentsActive / 25) * 20);       // 25 agents = full
  const autonomyDaysScore = Math.min(20, (daysRunning / 14) * 20);          // 14 days = full
  const concernRate = rows.length ? concerns.length / rows.length : 0;
  const autonomyHealthScore = Math.max(0, 20 - concernRate * 20);          // 0% concerns = full

  const autonomy = Math.round(autonomyBitsScore + autonomyAgentsScore + autonomyDaysScore + autonomyHealthScore);

  const summary = {
    ok: true,
    autonomy,
    autonomyBreakdown: {
      bits: Math.round(autonomyBitsScore),
      agents: Math.round(autonomyAgentsScore),
      daysRunning: Math.round(autonomyDaysScore),
      health: Math.round(autonomyHealthScore)
    },
    totalBits,
    agentsActive,
    newAgentsBorn,
    daysRunning: Math.round(daysRunning * 10) / 10,
    rowCount: rows.length,
    concernCount: concerns.length,
    concernRate: Math.round(concernRate * 100),
    perAgent: byAgent,
    rows
  };

  if (format === 'csv') {
    const headers = ['timestamp', 'box', 'question', 'response', 'state', 'confidence', 'objective', 'concerning', 'reason'];
    const escape = (v) => {
      const s = String(v == null ? '' : v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map(h => escape(r[h])).join(','));
    }
    return new Response(lines.join('\n'), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="aria-audit-${new Date().toISOString().slice(0,10)}.csv"` }
    });
  }

  return new Response(JSON.stringify(summary), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
