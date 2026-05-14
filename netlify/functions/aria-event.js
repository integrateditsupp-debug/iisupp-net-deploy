// aria-event — append an event to a session
// POST /.netlify/functions/aria-event
// Body: { sessionId, type, payload }
// Returns: { ok: true, derived: { ... } }
//
// Event types:
//   - message_user      payload: { text }
//   - message_aria      payload: { text }
//   - agent_fired       payload: { agent }
//   - stage_change      payload: { label, step, max }
//   - layer_used        payload: { layer }
//   - framework_lead    payload: { framework }
//   - resolved | escalated  payload: { summary? }

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, cors, { error: 'invalid JSON' }); }

  const { sessionId, type, payload } = body;
  if (!sessionId || !type) return resp(400, cors, { error: 'sessionId and type required' });

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });

  // Verify session exists
  const meta = await sessions.get(`${sessionId}/meta.json`, { type: 'json' });
  if (!meta) return resp(404, cors, { error: 'session not found' });

  // Append event
  const now = Date.now();
  const evt = { type, ts: now, payload: payload || {} };
  const existing = (await sessions.get(`${sessionId}/events.jsonl`, { type: 'text' })) || '';
  await sessions.set(`${sessionId}/events.jsonl`, existing + JSON.stringify(evt) + '\n');

  // Re-derive classification + status if it's a content event
  if (type === 'message_user' || type === 'message_aria') {
    const allEvents = parseEvents(existing + JSON.stringify(evt) + '\n');
    const derived = deriveMetrics(allEvents, meta);
    meta.classification = derived.classification;
    meta.derived = derived.metrics;
    meta.lastActivity = now;
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
    return resp(200, cors, { ok: true, derived });
  }

  if (type === 'resolved' || type === 'escalated') {
    meta.status = type;
    meta.endedAt = now;
    meta.summary = (payload && payload.summary) || meta.summary || null;
    await sessions.setJSON(`${sessionId}/meta.json`, meta);
  }

  return resp(200, cors, { ok: true });
};

function resp(status, cors, obj) { return { statusCode: status, headers: cors, body: JSON.stringify(obj) }; }

function parseEvents(jsonl) {
  return jsonl.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

// ========== Classification ==========
function deriveMetrics(events, meta) {
  const messages = events.filter(e => e.type === 'message_user' || e.type === 'message_aria');
  const text = messages.map(m => (m.payload && m.payload.text) || '').join(' ').toLowerCase();
  const startMs = events[0] ? events[0].ts : Date.now();
  const lastMs = events[events.length - 1] ? events[events.length - 1].ts : startMs;
  const durationSec = Math.max(1, Math.round((lastMs - startMs) / 1000));

  // Tier classification (signal-based, transparent)
  const L3 = /ransom|breach|replication|site-to-site|firewall|security incident|encrypt|exfil/.test(text);
  const L2 = /migration|sharepoint|permission|group policy|azure ad|entra|mailbox|conditional access|sso|saml|domain controller/.test(text);
  const tier = L3 ? 'L3' : L2 ? 'L2' : 'L1';

  // Difficulty
  const hardSignals = /escalat|handoff|l2 ticket|l3 ticket|call.*back|cannot resolve|need (a )?human|specialist/.test(text);
  let difficulty = 'easy';
  if (durationSec > 90 || messages.length > 10 || hardSignals) difficulty = 'hard';
  else if (durationSec > 30 || messages.length > 4) difficulty = 'mid';

  // Agent derivation (heuristic — flagged as derived in UI)
  const agents = {};
  if (/check|let me look|pulling|i'm checking/.test(text)) agents.reasoning = (agents.reasoning || 0) + 1;
  if (/i see|in the kb|knowledge base|article/.test(text)) agents.kb = (agents.kb || 0) + 1;
  if (/security|safety|risk|permission/.test(text)) agents.safety = (agents.safety || 0) + 1;
  if (/automate|workflow|n8n|trigger/.test(text)) agents.automation = (agents.automation || 0) + 1;
  if (/i understand|frustrating|let me help|on your side/.test(text)) agents.psychology = (agents.psychology || 0) + 1;
  if (/research|look that up|i don.?t know yet/.test(text)) agents.research = (agents.research || 0) + 1;
  if (/escalat|hand.?off|callback|call you/.test(text)) agents.escalation = (agents.escalation || 0) + 1;
  if (/verify|confirm|test|did that work/.test(text)) agents.quality = (agents.quality || 0) + 1;
  if (/what is|why|when|where|how/.test(text)) agents.intent = (agents.intent || 0) + 1;
  agents.orchestrator = Math.max(1, Math.floor(messages.length / 4));

  const agentList = Object.entries(agents).filter(([_, v]) => v > 0).map(([k, v]) => [k, v]);
  const agentsTotal = agentList.reduce((a, [, v]) => a + v, 0);

  // Framework lead (one of I-IX)
  const FRAMEWORKS = [
    { roman: 'I',   name: '5 W\'s',           re: /what|why|when|where|who/ },
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
  // Default to 5W's for L1, First Principles for L1-hard, DMAIC for L3, etc.
  if (!leadFw) leadFw = FRAMEWORKS[0];

  // Layer usage (derived %)
  const layerCounts = {
    LLM:           messages.filter(m => m.type === 'message_aria').length * 3,
    Memory:        Math.round(messages.length * 0.6),
    KB:            (agents.kb || 0) * 2 + 1,
    'Vector DB':   (agents.kb || 0) + 1,
    Tools:         (agents.automation || 0) + 1,
    Automation:    (agents.automation || 0) * 1.5,
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

  // Stage progress (heuristic: messages / target * 100)
  const stageMax = tier === 'L1' ? 8 : tier === 'L2' ? 12 : 18;
  const stageNow = Math.min(stageMax, messages.length);
  const stageLabel = (events.find(e => e.type === 'resolved') ? 'response · summary'
                   : events.find(e => e.type === 'escalated') ? 'STAR handoff'
                   : messages.length === 0 ? 'waiting — press start'
                   : messages.length < 3 ? 'intent + triage'
                   : messages.length < 6 ? 'reasoning · KB lookup'
                   : 'response · verification');

  return {
    classification: { tier, difficulty },
    metrics: {
      durationSec,
      messages: messages.length,
      agents: agentList,
      agentsUnique: agentList.length,
      agentsTotal,
      framework: { roman: leadFw.roman, name: leadFw.name },
      layers: layerPct,
      layerTotalUnits: layerTotal,
      stage: { now: stageNow, max: stageMax, label: stageLabel },
      derivedFrom: 'message-level signals (until full ARIA telemetry wired)'
    }
  };
}
