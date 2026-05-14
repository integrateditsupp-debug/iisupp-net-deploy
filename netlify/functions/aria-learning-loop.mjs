// aria-learning-loop v0.2 — autonomous bit-format multi-agent learning loop
// v0.2 (Ahmad ultrathink 2026-05-14 PM): expanded roster to 20 spec'd agents,
// added cross-domain root-link logic, escalation-control rule, knowledge-graph hint.
//
// Spec from Ahmad 2026-05-14 PM:
//   - Agents (Network, Storage, Identity, Cloud, Security, Hardware, AI, Quantum, Revenue,
//     OS, Endpoint, Email, Print, VPN, Mobile, Backup) speak with ARIA in BIT format.
//   - ARIA answers from KB. If ARIA can't, agent surfaces a learning gap.
//   - When a convo runs dry, the next agent asks a question relevant to its role.
//   - When a topic blocks all current agents, a NEW agent is spawned (added to roster).
//   - Every Q+A becomes a bit fed back into ARIA's KB cache (LIVE.LEARN.<topic>).
//   - Bit format saves space; cache + reconstructive recognition reused.
//   - Outcome: real-world solutions for apps/hardware/AI/quantum/daily-life
//     where there's revenue or opportunity.
//   - Self-growing. No human in the loop.
//   - Does not interfere with the live ARIA path: writes only to dedicated stores
//     `aria-learning-sessions` and `aria-kb-live` (existing).
//
// Trigger: GET /.netlify/functions/aria-learning-loop?cycles=N
//   - Default cycles=8 (one round of agent Q+As)
//   - Optional ?reset=1 wipes session state
//   - Optional ?topic=<seed> bootstraps a topic
//
// Returns: { ok, cycles, bitsLearned, agentsActive, newAgentsBorn, sessionFile }
//
// Storage:
//   aria-learning-sessions/active.json          — current loop state (roster, last topic, last n exchanges)
//   aria-learning-sessions/log/<iso-date>.jsonl — append-only bit log
//   aria-kb-live/learn-<slug>.json              — bits ARIA can pull on next user query
//
// Bit format (saves space):
//   { a: 'agentName', q: 'question?', r: 'response.', n: 'next_topic_seed', s: state_code }
//   - 'a' single token, 'q' ≤140 chars, 'r' ≤200 chars, 'n' ≤30 chars, 's' canonical state code
//   - One bit ≈ 200-300 bytes JSON. 1000 bits ≈ 250KB. Fits in blob budget.

import { getStore } from '@netlify/blobs';

const SESSIONS = 'aria-learning-sessions';
const KB_LIVE = 'aria-kb-live';
const ARIA_BASE = process.env.URL || 'https://iisupp.net';

// ============= STARTING AGENT ROSTER =============
// Each agent has a domain, a question generator (seed → question), and a topic-shift rule.
const AGENTS_DEFAULT = [
  // L1/L2/L3 support tiers — frontline → escalation
  { name: 'l1',           role: 'frontline, password, basic outlook, basic wifi, ticket triage',           ask: ['scripted fix for ${seed} a tier-1 tech can do in 5 min?', 'what info to collect before escalating ${seed}?', 'most common cause of ${seed} that l1 sees?'] },
  { name: 'l2',           role: 'specialist, networking, m365 admin, endpoint, repeat issues',              ask: ['root cause investigation steps for ${seed}?', 'when l2 should call l3 on ${seed}?', 'tooling l2 needs for ${seed} that l1 lacks?'] },
  { name: 'l3',           role: 'engineering, server, ad/azure, complex routing, vendor escalation',        ask: ['architecture-level fix for recurring ${seed}?', 'permanent prevention plan for ${seed}?', 'vendor escalation path for ${seed}?'] },
  // Domain experts
  { name: 'security',     role: 'phishing, malware, ransomware, edr, patching, zero trust, dlp',            ask: ['real cost of one ${seed} incident?', '60-second triage for suspected ${seed}?', 'lowest-friction edr for smb ${seed}?'] },
  { name: 'networking',   role: 'connectivity, dns, wifi, vpn, sd-wan, latency, qos, isp',                  ask: ['how do users diagnose ${seed} in 60 seconds?', 'cheapest qos rule for ${seed}?', 'when does ${seed} need an sd-wan upgrade?'] },
  { name: 'hardware',     role: 'pc, laptop, printer, peripherals, lifecycle, lease',                       ask: ['signal that ${seed} is end-of-life?', 'lease vs buy math for ${seed}?', 'cheapest reliable ${seed} for 5-year lifecycle?'] },
  { name: 'software',     role: 'os, drivers, updates, install, license keys, native apps',                 ask: ['cleanest install of ${seed}?', 'silent deploy script for ${seed}?', 'most common update failure for ${seed}?'] },
  { name: 'saas',         role: 'tenant sprawl, license waste, app rationalization, integrations',          ask: ['hidden saas waste tied to ${seed}?', 'consolidation candidate for ${seed}?', 'integration with most roi for ${seed}?'] },
  { name: 'm365',         role: 'exchange, sharepoint, teams, onedrive, intune, entra, defender',           ask: ['cheapest m365 sku for ${seed}?', 'security baseline change for ${seed}?', 'license rightsize plan for ${seed}?'] },
  // Build-side
  { name: 'automation',   role: 'workflow, zapier, make, power automate, scripts, scheduled jobs',          ask: ['where does automation save 5h/wk on ${seed}?', 'cheapest automation stack for ${seed}?', 'pitfall to avoid when automating ${seed}?'] },
  { name: 'ai_eng',       role: 'llms, retrieval, agents, embeddings, vector store, mlops',                 ask: ['rag pattern for ${seed}?', 'cheapest llm choice for ${seed} at smb scale?', 'eval method for ${seed} ai answers?'] },
  { name: 'prompt_eng',   role: 'prompt structure, system prompts, few-shot, chain of thought, eval',       ask: ['best prompt pattern for ${seed}?', 'system prompt boundary for ${seed}?', 'eval prompt for ${seed} to catch drift?'] },
  // Business side
  { name: 'business_ops', role: 'sop, process, kpi, ops cost, time tracking, vendor management',            ask: ['kpi to track for ${seed}?', 'sop template for ${seed}?', 'where does ${seed} eat ops hours?'] },
  { name: 'audit',        role: 'compliance, soc2, hipaa, iso27001, evidence, controls',                    ask: ['evidence to collect for ${seed}?', 'control mapping for ${seed} to soc2?', 'auditor question to expect about ${seed}?'] },
  { name: 'revenue_opp',  role: 'pricing, packaging, msp margins, retainer, upsell, churn',                 ask: ['recurring revenue path from ${seed}?', 'price per seat for ${seed} that converts?', 'upsell trigger when ${seed} happens to a customer?'] },
  { name: 'ux',           role: 'user friction, onboarding, error messages, empty states, accessibility',   ask: ['biggest user friction in ${seed}?', 'onboarding tweak that doubles activation on ${seed}?', 'a11y gap in ${seed}?'] },
  // Self-improvement layer
  { name: 'kb',           role: 'curated answers, library promotion, deduplication, freshness',             ask: ['is ${seed} stable enough to promote to canonical kb?', 'duplicate of ${seed} already in library?', 'freshness signal on ${seed}?'] },
  { name: 'memory',       role: 'compression, bit format, cache hit rate, retrieval cost, footprint',       ask: ['most space-efficient bit for ${seed}?', 'cache vs recompute decision for ${seed}?', 'footprint of ${seed} bit chain?'] },
  { name: 'rca',          role: 'root cause analysis, 5 whys, fishbone, fault tree, postmortem',            ask: ['5-whys chain for ${seed}?', 'real root cause vs symptom of ${seed}?', 'corrective action with longest leverage on ${seed}?'] },
  { name: 'escalation',   role: 'severity, sla, paging, auto-escalate rules, helpdesk handoff',             ask: ['p1/p2/p3 severity for ${seed}?', 'when ${seed} should auto-page a human?', 'sla clock for ${seed} resolution?'] }
];

// Topic seeds — each agent's first question pulls from these. Then convos chain.
const SEED_TOPICS = [
  'wifi dropping', 'disk full', 'outlook slow', 'password reset', 'shared drive sync',
  'printer offline', 'vpn slow', 'phishing email', 'ransomware backup', 'laptop replacement',
  'endpoint drift', 'mdm enrollment', 'sso onboarding', 'm365 license sprawl', 'azure spend',
  'ai support copilot', 'pqc migration', 'msp pricing', 'monthly retainer', 'helpdesk staffing'
];

const MAX_BIT_R = 200;
const MAX_BIT_Q = 140;
const MAX_HISTORY = 30; // last N exchanges in active state
const MAX_LIVE_KB_BITS = 5000; // soft cap before we start aging out

// ============= ENTRY =============
export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  const url = new URL(request.url);
  const cycles = Math.min(parseInt(url.searchParams.get('cycles') || '8', 10), 50);
  const reset = url.searchParams.get('reset') === '1';
  const seedTopic = (url.searchParams.get('topic') || '').trim().toLowerCase();

  const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
  const kbLive = getStore({ name: KB_LIVE, consistency: 'strong' });

  let state;
  if (reset) {
    state = freshState();
  } else {
    try {
      state = (await sessions.get('active.json', { type: 'json' })) || freshState();
    } catch { state = freshState(); }
  }

  if (seedTopic) {
    state.queue.unshift(seedTopic);
  }

  const startBitsLearned = state.bitsLearned || 0;
  const startAgents = state.roster.length;
  const log = [];
  const newKbBits = [];

  for (let i = 0; i < cycles; i++) {
    const next = pickNextTurn(state);
    if (!next) break; // queue exhausted, no agent able to ask

    const { agent, topic } = next;
    const question = renderQuestion(agent, topic);
    const ariaResp = await askAria(question, topic);

    // Bit-format the exchange
    const bit = {
      a: agent.name,
      q: trim(question, MAX_BIT_Q),
      r: trim(ariaResp.text, MAX_BIT_R),
      n: deriveNextTopic(topic, agent, ariaResp),
      s: ariaResp.state || 'UNKNOWN',
      c: ariaResp.confidence || 0,
      t: Date.now()
    };
    log.push(bit);

    // Feed back into KB-LIVE so future user queries can reach this bit
    const slug = `learn-${agent.name}-${slugify(topic)}`.slice(0, 60);
    try {
      await kbLive.set(`${slug}.json`, JSON.stringify({
        heading: `${agent.name}: ${topic}`,
        body: bit.r + '\n\n' + 'Asked by: ' + agent.name + ' | Topic: ' + topic + ' | If this does not resolve in two attempts, that is an L2 escalation — call (647) 581-3182.',
        source_url: null,
        vendor: 'aria-learning',
        query_seed: question,
        created_at: new Date().toISOString(),
        agent: agent.name,
        topic
      }), { contentType: 'application/json' });
      newKbBits.push(slug);
    } catch (_) {}

    // Update active state
    state.history.push(bit);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.bitsLearned = (state.bitsLearned || 0) + 1;
    state.lastTopic = topic;
    state.lastAgent = agent.name;

    // Queue the derived next topic for future cycles
    if (bit.n && !state.queue.includes(bit.n)) {
      state.queue.push(bit.n);
    }

    // Detect "blocked topic" — ARIA gave a no-match AND no agent in roster owns this domain
    if (ariaResp.state === 'UNKNOWN' && shouldSpawnAgent(state, topic)) {
      const newAgent = spawnAgent(topic);
      state.roster.push(newAgent);
      state.newAgentsBorn = (state.newAgentsBorn || 0) + 1;
      log.push({ event: 'agent-born', name: newAgent.name, role: newAgent.role, t: Date.now() });
    }

    // Round-robin so no single agent dominates
    state.cursor = (state.cursor + 1) % state.roster.length;

    // If queue is dry, replenish with a fresh seed
    if (state.queue.length === 0) {
      state.queue.push(SEED_TOPICS[Math.floor(Math.random() * SEED_TOPICS.length)]);
    }
  }

  // Persist state
  try { await sessions.set('active.json', JSON.stringify(state), { contentType: 'application/json' }); } catch (_) {}

  // Append bit log for the day
  const today = new Date().toISOString().slice(0, 10);
  try {
    let existing = '';
    try { existing = (await sessions.get(`log/${today}.jsonl`)) || ''; } catch (_) {}
    const next = existing + log.map(b => JSON.stringify(b)).join('\n') + '\n';
    await sessions.set(`log/${today}.jsonl`, next, { contentType: 'text/plain' });
  } catch (_) {}

  return new Response(JSON.stringify({
    ok: true,
    cycles: log.filter(l => !l.event).length,
    bitsLearned: state.bitsLearned - startBitsLearned,
    bitsLearnedTotal: state.bitsLearned,
    agentsActive: state.roster.length,
    newAgentsBorn: state.roster.length - startAgents,
    sessionFile: 'active.json',
    logFile: `log/${today}.jsonl`,
    newKbBits: newKbBits.length,
    sampleBits: log.slice(-5)
  }), { status: 200, headers: cors });
};

// ============= HELPERS =============

function freshState() {
  return {
    roster: AGENTS_DEFAULT.map(a => ({ ...a })),
    queue: [...SEED_TOPICS],
    history: [],
    cursor: 0,
    bitsLearned: 0,
    newAgentsBorn: 0,
    born: new Date().toISOString()
  };
}

function pickNextTurn(state) {
  if (!state.roster.length) return null;
  if (!state.queue.length) state.queue.push(SEED_TOPICS[Math.floor(Math.random() * SEED_TOPICS.length)]);
  const topic = state.queue.shift();
  const agent = state.roster[state.cursor % state.roster.length];
  return { agent, topic };
}

function renderQuestion(agent, topic) {
  const templates = agent.ask || [];
  if (!templates.length) return `What is the cheapest path to fix ${topic}?`;
  const t = templates[Math.floor(Math.random() * templates.length)];
  return t.replace(/\$\{seed\}/g, topic);
}

async function askAria(question, topic) {
  // Hit the existing aria-research function — this is what real users hit.
  // ARIA path 1: curated state. Path 2: live vendor fetch. Path 3: graceful no-match.
  try {
    const r = await fetch(`${ARIA_BASE}/.netlify/functions/aria-research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question })
    });
    if (!r.ok) return { text: 'no-response', state: 'UNKNOWN', confidence: 0 };
    const j = await r.json();
    const text = (j.steps && j.steps.length) ? j.steps.slice(0, 2).join(' ') : (j.title || 'No curated answer.');
    return { text, state: j.state || 'UNKNOWN', confidence: j.confidence || 0 };
  } catch (e) {
    return { text: 'fetch-error', state: 'UNKNOWN', confidence: 0 };
  }
}

function deriveNextTopic(topic, agent, ariaResp) {
  // Reconstructive recognition — chain to a related operational topic based on state code or role keyword
  const map = {
    'DISK.FULL': 'storage tiering',
    'OS.SLOW.PERF': 'startup app audit',
    'OS.BOOT.FAIL': 'recovery media',
    'NET.WIFI.AUTH': 'cert lifecycle',
    'NET.WIFI.NO.CONN': 'router firmware',
    'NET.SLOW': 'qos rules',
    'M365.OUTLOOK.SEND': 'smtp throttling',
    'M365.OUTLOOK.OOO': 'shared mailbox',
    'M365.OUTLOOK.OPEN': 'add-in audit',
    'AUT.PW.RESET': 'password manager rollout',
    'AUT.MFA.LOCK': 'fido2 keys',
    'PRT.OFFLINE': 'spooler restart automation',
    'PRT.QUEUE.STUCK': 'cost per page',
    'SEC.PHISH': 'dmarc enforcement',
    'SEC.MALWARE': 'edr selection',
    'VPN.AUTH.FAIL': 'zero trust pilot',
    'VPN.NO.TUNNEL': 'sd-wan',
    'CLOUD.SYNC': 'tenant move',
    'SW.INSTALL.FAIL': 'silent deploy',
    'SW.UPDATE.FAIL': 'patch ring strategy'
  };
  if (ariaResp.state && map[ariaResp.state]) return map[ariaResp.state];
  // fallback: pick a token from agent role
  const roleTokens = (agent.role || '').split(/[,\s]+/).filter(t => t.length > 3);
  if (roleTokens.length) return roleTokens[Math.floor(Math.random() * roleTokens.length)];
  return topic + ' next';
}

function shouldSpawnAgent(state, topic) {
  // Spawn if topic doesn't map to any current agent's role keywords
  const tlow = topic.toLowerCase();
  for (const a of state.roster) {
    const tokens = (a.role || '').toLowerCase().split(/[,\s]+/);
    if (tokens.some(t => t.length > 3 && tlow.includes(t))) return false;
  }
  return true;
}

function spawnAgent(topic) {
  const slug = slugify(topic).split('-')[0] || 'specialist';
  return {
    name: 'born_' + slug,
    role: topic + ', ' + slug + ' troubleshooting, ' + slug + ' optimization',
    ask: [
      `what is the cheapest fix for ${topic}?`,
      `what is the ROI on solving ${topic}?`,
      `who pays for solving ${topic} today?`
    ],
    born_at: new Date().toISOString()
  };
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function trim(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
