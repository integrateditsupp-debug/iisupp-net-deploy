// aperture-audit — V2 ESM function · JWT-gated · single session deep dive
// GET /.netlify/functions/aperture-audit?sid=<sid>
//   headers: Authorization: Bearer <jwt>
// Returns the full audit object per the v0.5 schema: meta + events + derived metrics + agents

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return jsonResp(405, cors, { error: 'GET only' });

  const claims = verifyAperture(request);
  if (!claims) return jsonResp(401, cors, { error: 'auth required' });

  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');
  if (!sid) return jsonResp(400, cors, { error: 'sid required' });

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });
  const meta = await sessions.get(`${sid}/meta.json`, { type: 'json' });
  if (!meta) return jsonResp(404, cors, { error: 'session not found' });

  let events = [];
  try {
    const e = await sessions.get(`${sid}/events.json`, { type: 'json' });
    if (e && Array.isArray(e.list)) events = e.list;
  } catch (_) {}

  const derived = deriveMetrics(meta, events);

  return jsonResp(200, cors, {
    ok: true,
    sid,
    ticket: meta.ticket || null,
    user: meta.user || {},
    issueSummary: meta.issueSummary || meta.firstUserMessage || null,
    category: meta.category || classifyCategory(events),
    status: meta.status || 'open',
    startedAt: meta.startedAt || null,
    endedAt: meta.endedAt || null,
    timeToFirstResponseMs: derived.ttfr,
    timeToResolutionMs: derived.ttr,
    confidence: derived.confidence,
    agentActivations: derived.agents,
    kb: derived.kb,
    safetyChecks: derived.safetyChecks,
    architectureLayers: derived.archLayers,
    emailReport: meta.email || null,
    recommendedNextAction: derived.nextAction,
    transcript: events.map(ev => ({
      ts: ev.ts,
      role: ev.role || (ev.kind === 'user' ? 'user' : 'assistant'),
      kind: ev.kind || null,
      text: ev.text || ev.message || null,
      meta: ev.meta || null
    })),
    rawEventsCount: events.length
  });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// ============ derivation helpers ============

const AGENT_PATTERNS = {
  reasoning: /(think|reason|analy|plan)/i,
  intent: /(intent|classify|fuzzy|operationalstate)/i,
  kb: /(kb hit|knowledge base|kb article)/i,
  rag: /(rag retrieval|chunk|vector match)/i,
  vector: /(vector memory|embedding)/i,
  safety: /(safety|guardrail|block|veto)/i,
  troubleshooting: /(troubleshoot|diagnose|recipe|step)/i,
  automation: /(automation|workflow|automate|execute)/i,
  escalation: /(escalate|transfer|human|helpdesk)/i,
  verification: /(verify|confirm|resolved)/i,
  emailReport: /(email|report sent|admin email)/i,
  ticketing: /(ticket|aria-\d{8})/i,
  performance: /(perf|metrics|audit)/i,
  research: /(research|recipe|operational state|state code)/i,
  psychology: /(empathy|tone|acknowledge|sorry)/i,
  observability: /(trace|log|tick|orchestrator)/i,
  curator: /(curator|kb update|article add)/i,
  learning: /(learn|teach|feedback signal)/i,
  measurement: /(measure|kpi|nps|csat)/i,
  quality: /(quality|review|polish)/i
};

function deriveMetrics(meta, events) {
  const agents = {};
  let kbHits = 0;
  let firstAssistantAt = null;
  let resolveAt = null;
  let confidence = 0;
  const safety = [];

  for (const ev of events) {
    const text = ((ev.text || ev.message || '') + ' ' + (ev.kind || '')).toLowerCase();
    if (!firstAssistantAt && (ev.role === 'assistant' || ev.kind === 'aria')) {
      firstAssistantAt = ev.ts || null;
    }
    if (ev.kind === 'resolved' || ev.kind === 'end' || /resolved|escalated|ended/.test(text)) {
      resolveAt = ev.ts || resolveAt;
    }
    if (/kb hit|knowledge base/.test(text)) kbHits += 1;
    if (ev.meta && typeof ev.meta.confidence === 'number') {
      confidence = Math.max(confidence, ev.meta.confidence);
    }
    for (const [agent, re] of Object.entries(AGENT_PATTERNS)) {
      if (re.test(text)) agents[agent] = (agents[agent] || 0) + 1;
    }
    if (/safety|guardrail|block/.test(text)) {
      safety.push({ ts: ev.ts, kind: ev.kind || 'check', passed: !/block|veto/.test(text) });
    }
  }

  const startedTs = meta.startedAt ? new Date(meta.startedAt).getTime() : null;
  const firstTs = firstAssistantAt ? new Date(firstAssistantAt).getTime() : null;
  const resolveTs = resolveAt ? new Date(resolveAt).getTime() : null;
  const endedTs = meta.endedAt ? new Date(meta.endedAt).getTime() : null;

  const ttfr = (startedTs && firstTs) ? (firstTs - startedTs) : null;
  const ttr = (startedTs && (resolveTs || endedTs)) ? ((resolveTs || endedTs) - startedTs) : null;

  // Architecture layers — derived percentages
  const totalSignals = Object.values(agents).reduce((s, n) => s + n, 0) || 1;
  const archLayers = {
    cognition: pct((agents.reasoning || 0) + (agents.intent || 0) + (agents.psychology || 0), totalSignals),
    knowledge: pct((agents.kb || 0) + (agents.rag || 0) + (agents.vector || 0) + (agents.research || 0), totalSignals),
    action: pct((agents.troubleshooting || 0) + (agents.automation || 0) + (agents.verification || 0), totalSignals),
    safety: pct(agents.safety || 0, totalSignals),
    ops: pct((agents.ticketing || 0) + (agents.escalation || 0) + (agents.emailReport || 0) + (agents.observability || 0), totalSignals)
  };

  const agentList = Object.entries(agents)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => [name, count]);

  let nextAction = 'await_user';
  if (resolveAt) nextAction = 'closed';
  else if ((agents.escalation || 0) > 0) nextAction = 'escalate_to_human';
  else if ((agents.research || 0) > 0 && !kbHits) nextAction = 'add_kb_article';

  return {
    ttfr, ttr, confidence,
    agents: agentList,
    kb: { hits: kbHits, articles: meta.kbArticles || [] },
    safetyChecks: safety,
    archLayers,
    nextAction
  };
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function classifyCategory(events) {
  const text = events.map(e => (e.text || e.message || '').toLowerCase()).join(' ');
  if (/escalate|transfer|human/.test(text)) return 'L2 · Hard';
  if (/disk|space|outlook|wifi|password|printer/.test(text)) return 'L1 · Easy';
  if (/vpn|sync|update|driver|registry/.test(text)) return 'L1 · Mid';
  return 'L1 · Unclassified';
}
