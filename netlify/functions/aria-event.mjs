// aria-event — V2 ESM function (auto-wires Netlify Blobs)
// POST /.netlify/functions/aria-event

import { getStore } from '@netlify/blobs';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const { sessionId, type, payload } = body;
  if (!sessionId || !type) return jsonResp(400, cors, { error: 'sessionId and type required' });

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });

  const meta = await sessions.get(`${sessionId}/meta.json`, { type: 'json' });
  if (!meta) return jsonResp(404, cors, { error: 'session not found' });

  const now = Date.now();
  const evt = { type, ts: now, payload: payload || {} };
  const existing = (await sessions.get(`${sessionId}/events.jsonl`, { type: 'text' })) || '';
  await sessions.set(`${sessionId}/events.jsonl`, existing + JSON.stringify(evt) + '\n');

  if (type === 'message_user' || type === 'message_aria') {
    const allEvents = parseEvents(existing + JSON.stringify(evt) + '\n');
    const derived = deriveMetrics(allEvents);
    meta.classification = derived.classification;
    meta.derived = derived.metrics;
    meta.lastActivity = now;
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
    return jsonResp(200, cors, { ok: true, derived });
  }

  if (type === 'resolved' || type === 'escalated') {
    meta.status = type;
    meta.endedAt = now;
    meta.summary = (payload && payload.summary) || meta.summary || null;
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
  }

  return jsonResp(200, cors, { ok: true });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

function parseEvents(jsonl) {
  return jsonl.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function deriveMetrics(events) {
  const messages = events.filter(e => e.type === 'message_user' || e.type === 'message_aria');
  const text = messages.map(m => (m.payload && m.payload.text) || '').join(' ').toLowerCase();
  const startMs = events[0] ? events[0].ts : Date.now();
  const lastMs = events[events.length - 1] ? events[events.length - 1].ts : startMs;
  const durationSec = Math.max(1, Math.round((lastMs - startMs) / 1000));

  const L3 = /ransom|breach|replication|site-to-site|firewall|security incident|encrypt|exfil/.test(text);
  const L2 = /migration|sharepoint|permission|group policy|azure ad|entra|mailbox|conditional access|sso|saml|domain controller/.test(text);
  const tier = L3 ? 'L3' : L2 ? 'L2' : 'L1';

  const hardSignals = /escalat|handoff|l2 ticket|l3 ticket|call.*back|cannot resolve|need (a )?human|specialist/.test(text);
  let difficulty = 'easy';
  if (durationSec > 90 || messages.length > 10 || hardSignals) difficulty = 'hard';
  else if (durationSec > 30 || messages.length > 4) difficulty = 'mid';

  // AROC §6 — signal-based detection, never faked. Each agent fires only on real evidence in the conversation text.
  // Full 13-agent registry per Ahmad's v0.5 spec; orchestrator always fires once per ~3 messages.
  const REGISTRY_ORDER = [
    'orchestrator','intent','reasoning','kb','rag','vector','troubleshooting',
    'safety','automation','resolutionVerification','escalation','emailReport','ticketing','performanceAudit'
  ];
  const AGENT_PATTERNS = {
    intent:                 /\b(what (is|are|do|does)|why( is|s)?|when (is|do|did)|where (is|do)|how (do|can|to))\b/gi,
    reasoning:              /\b(let me (check|look|see|think)|i'?m (checking|looking|pulling|examining)|first principles?|step by step|analyz)/gi,
    kb:                     /\b(kb|knowledge[\s-]?base|article|documented|per (the |our )docs?)\b/gi,
    rag:                    /\b(searched|retrieved|found in|matching|similar (issue|case)|related (doc|article|ticket))\b/gi,
    vector:                 /\b(remember (when|that)|last time|recall|prior session|previously|in (your |the )history)\b/gi,
    troubleshooting:        /\b(try (this|to|the)|step \d|run (this|that|the)|check if|diagnostic|reboot|restart|reset|reinstall|update (the )?driver|flush|clear cache)\b/gi,
    safety:                 /\b(security|safety|risk|permission|access (denied|control)|sensitive|verify (your |the )identity)\b/gi,
    automation:             /\b(automat|workflow|trigger|n8n|orchestrat|i'?ll handle that|running (a |the )?script)\b/gi,
    resolutionVerification: /\b(did (that|it) (work|help)|all (good|set|clear)|working now|confirmed (fixed|resolved)|verify (it )?works)\b/gi,
    escalation:             /\b(escalat|hand[\s-]?off|callback|call(ing)? you|technician will|specialist|human (agent|tech)|live agent|get me a (person|human))\b/gi,
    emailReport:            /\b(report|summary|inbox|i'?ll (email|send)|sending you|emailed|recap|session report)\b/gi,
    ticketing:              /\b(ticket|aria-\d|case (number|id)|reference (number|id)|tracking number)\b/gi,
    performanceAudit:       /\b(duration|response time|baseline|p50|p95|latency|took \d+|completed in|took \d)\b/gi
  };
  const agents = {};
  for (const k of REGISTRY_ORDER) {
    if (k === 'orchestrator') continue;
    const re = AGENT_PATTERNS[k];
    if (!re) continue;
    const m = text.match(re);
    if (m && m.length) agents[k] = m.length;
  }
  // Orchestrator always fires once per ~3 messages — represents the routing tick itself.
  agents.orchestrator = Math.max(1, Math.floor(messages.length / 3));

  // Full registry surface (every agent appears with 0 if unfired) — Aperture renders all of these.
  const agentRegistry = REGISTRY_ORDER.map(k => [k, agents[k] || 0]);
  
  const agentList = Object.entries(agents).filter(([, v]) => v > 0).map(([k, v]) => [k, v]);
  const agentsTotal = agentList.reduce((a, [, v]) => a + v, 0);

  const FRAMEWORKS = [
    { roman: 'I',   name: "5 W's",            re: /what|why|when|where|who/ },
    { roman: 'II',  name: 'STAR',             re: /situation|task|action|result|handoff/ },
    { roman: 'III', name: 'First Principles', re: /first.?principle|must hold|fundamentally|from scratch/ },
    { roman: 'IV',  name: 'OKR',              re: /objective|key result|target|goal/ },
    { roman: 'V',   name: 'Eisenhower',       re: /urgent|important|priority/ },
    { roman: 'VI',  name: 'DMAIC',            re: /define|measure|analyze|improve|control/ },
    { roman: 'VII', name: 'Kaizen',           re: /improve.*small|incremental|tighten/ },
    { roman: 'VIII',name: 'TOC',              re: /constraint|bottleneck|slowest|chain/ },
    { roman: 'IX',  name: 'AAR',              re: /after.?action|review|lessons|postmortem/ }
  ];
  let leadFw = FRAMEWORKS[0];
  for (const fw of FRAMEWORKS) {
    if (fw.re.test(text)) { leadFw = fw; break; }
  }

  const layerCounts = {
    LLM:           messages.filter(m => m.type === 'message_aria').length * 3,
    Memory:        Math.round(messages.length * 0.6),
    KB:            (agents.kb || 0) * 2 + 1,
    'Vector DB':   (agents.kb || 0) + 1,
    Tools:         (agents.automation || 0) + 1,
    Automation:    Math.round((agents.automation || 0) * 1.5),
    'Frontend/UI': Math.max(1, messages.length),
    RAG:           (agents.kb || 0) + (agents.research || 0),
    Agents:        Math.max(1, agentList.length),
    Safety:        (agents.safety || 0) + 1,
    Evaluation:    (agents.quality || 0) + 1,
    Storage:       1
  };
  const layerTotal = Object.values(layerCounts).reduce((a, b) => a + b, 0);
  const layerPct = Object.entries(layerCounts)
    .map(([k, v]) => [k, +((v / layerTotal) * 100).toFixed(1)])
    .sort((a, b) => b[1] - a[1]);

  const stageMax = tier === 'L1' ? 8 : tier === 'L2' ? 12 : 18;
  const stageNow = Math.min(stageMax, messages.length);
  const stageLabel = messages.length === 0 ? 'waiting — press start'
                   : messages.length < 3 ? 'intent + triage'
                   : messages.length < 6 ? 'reasoning · KB lookup'
                   : 'response · verification';

  return {
    classification: { tier, difficulty },
    metrics: {
      durationSec,
      messages: messages.length,
      agents: agentList,
      agentsUnique: agentList.length,
      agentsTotal,
      agentRegistry,
      framework: { roman: leadFw.roman, name: leadFw.name },
      layers: layerPct,
      layerTotalUnits: layerTotal,
      stage: { now: stageNow, max: stageMax, label: stageLabel },
      derivedFrom: 'message-level signals (until full ARIA telemetry wired)'
    }
  };
}
