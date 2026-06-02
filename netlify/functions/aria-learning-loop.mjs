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

  const t0 = Date.now(); // soft time budget — skip the LLM grounding pass on slow runs
  const url = new URL(request.url);
  const cycles = Math.min(parseInt(url.searchParams.get('cycles') || '8', 10), 50);
  const reset = url.searchParams.get('reset') === '1';
  const seedTopic = (url.searchParams.get('topic') || '').trim().toLowerCase();

  const sessions = getStore({ name: SESSIONS, consistency: 'strong' });
  const kbLive = getStore({ name: KB_LIVE, consistency: 'strong' });

  // ?purge=1 — one-time cleanup after the echo-chamber audit (2026-06-02). Sweeps the
  // junk bits that the old loop banked as "knowledge" (its own clarifying questions,
  // generic first-principles boilerplate, no-match stubs) out of the live store and
  // rebuilds kb-index.json from only the surviving real answers. Idempotent.
  if (url.searchParams.get('purge') === '1') {
    return new Response(JSON.stringify(await purgeJunk(kbLive)), { status: 200, headers: cors });
  }

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
  const indexAdds = []; // retrieval-index entries so aria-research can SERVE these bits
  const gaps = [];      // genuine knowledge gaps (ARIA couldn't answer) → LLM grounding pass

  for (let i = 0; i < cycles; i++) {
    // Capture the prior turn BEFORE it's overwritten, so an agent can build on it.
    const prevAgent = state.lastAgent || null;
    const prevTopic = state.lastTopic || null;

    const next = pickNextTurn(state);
    if (!next) break; // queue exhausted, no agent able to ask

    const { agent, topic } = next;

    // Every 3rd turn, make it a real CONVERSATION instead of isolated Q&As: the agent
    // asks a follow-up that explicitly builds on the previous agent's exchange (deeper
    // root cause / what's missing / does it scale). The ARIA-facing topic stays clean
    // (prevTopic) so retrieval still matches. (Ahmad 2026-06-01)
    const isFollowup = (i % 3 === 2) && prevAgent && prevTopic && prevAgent !== agent.name;
    const effTopic = isFollowup ? prevTopic : topic;
    const question = isFollowup
      ? renderFollowup(agent, prevAgent, prevTopic)
      : renderQuestion(agent, topic);
    const ariaResp = await askAria(question, effTopic);

    // Bit-format the exchange
    const bit = {
      a: agent.name,
      q: trim(question, MAX_BIT_Q),
      r: trim(ariaResp.text, MAX_BIT_R),
      n: deriveNextTopic(effTopic, agent, ariaResp),
      s: ariaResp.state || 'UNKNOWN',
      c: ariaResp.confidence || 0,
      t: Date.now(),
      tp: effTopic, // topic, so aria-self-audit can group dead-ends without re-deriving
      ref: (prevAgent && prevAgent !== agent.name) ? { a: prevAgent, t: prevTopic } : null,
      f: isFollowup ? 1 : 0
    };
    log.push(bit);

    // Feed back into KB-LIVE so future user queries can reach this bit.
    // NOTE (2026-05-25): slug now includes a short content hash of the response so
    // genuinely-new insights ACCUMULATE instead of overwriting the same agent+topic
    // file (the old `learn-<agent>-<topic>` key capped distinct KBs at a few hundred).
    // Identical answers still collapse to one file (idempotent dedup).
    // (2026-06-02) Echo-chamber audit: 90% of "learned" bits were non-content — ARIA
    // banking its own clarifying questions (conf 0.9) and generic first-principles
    // boilerplate as knowledge. Decide ONCE, up front, whether this exchange is worth
    // persisting at all. If it isn't, we write NOTHING — no junk file, no index entry.
    //  - isDialogMove: "Happy to help, which app?" — a conversational turn, not a fact.
    //  - isGuess: first-principles structured guess — a live fallback, never banked.
    //  - isRealAnswer: not a "No curated answer." / error / too-short stub.
    const isDialogMove = ariaResp.conversational || /^CONVO\./.test(ariaResp.state || '');
    const isGuess = /first-principles-reasoner/.test(ariaResp.source || '');
    // CONTENT-based guard (2026-06-02, found on live): clarifiers like "Happy to help.
    // Which app is this about?" also arrive via NON-conversational paths (state
    // DIAGNOSING_WHAT, conf 1.0), so a state/flag-only gate misses them. isJunkBody keys
    // off the TEXT (greeting prefix / generic boilerplate), catching them from any path.
    const worthKeeping = isRealAnswer(bit.r) && !isDialogMove && !isGuess && !isJunkBody(bit.r);

    // Feed REAL answers back into KB-LIVE so future user queries can reach this bit.
    // NOTE (2026-05-25): slug includes a short content hash so genuinely-new insights
    // ACCUMULATE while identical answers collapse to one file (idempotent dedup).
    const slug = `learn-${agent.name}-${slugify(effTopic)}-${hash6(bit.r)}`.slice(0, 72);
    if (worthKeeping) {
      try {
        await kbLive.set(`${slug}.json`, JSON.stringify({
          heading: `${agent.name}: ${effTopic}`,
          body: bit.r + '\n\n' + 'Asked by: ' + agent.name + ' | Topic: ' + effTopic + ' | If this does not resolve in two attempts, that is an L2 escalation — call (647) 581-3182.',
          source_url: null,
          vendor: 'aria-learning',
          query_seed: question,
          created_at: new Date().toISOString(),
          agent: agent.name,
          topic: effTopic
        }), { contentType: 'application/json' });
        newKbBits.push(slug);
        indexAdds.push({
          key: `${slug}.json`,
          topic: effTopic,
          agent: agent.name,
          kw: `${effTopic} ${agent.name} ${bit.r}`.toLowerCase().slice(0, 200),
          bodyHash: hash6(bit.r), // cross-topic dedup: collapse near-identical bodies
          c: bit.c || 0,
          promoted: false,
          t: bit.t
        });
      } catch (_) {}
    } else {
      state.skipped = (state.skipped || 0) + 1; // observability: how much slop we rejected
      // A genuine KNOWLEDGE gap = ARIA gave no real answer AND it wasn't just a
      // conversational turn (a greeting isn't something to learn). These are the topics
      // worth spending a governed LLM call on below. (2026-06-02)
      if (!isDialogMove && effTopic && question) {
        gaps.push({ topic: effTopic, question, agent: agent.name });
      }
    }

    // Update active state
    state.history.push(bit);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    // Count only bits we actually BANKED — the old counter incremented on every turn,
    // inflating "bitsLearned" to ~10x the real number of facts retained. (2026-06-02)
    if (worthKeeping) state.bitsLearned = (state.bitsLearned || 0) + 1;
    state.lastTopic = effTopic;
    state.lastAgent = agent.name;

    // Queue the derived next topic for future cycles
    if (bit.n && !state.queue.includes(bit.n)) {
      state.queue.push(bit.n);
    }

    // Detect "blocked topic" — ARIA gave a no-match AND no agent in roster owns this domain
    if (ariaResp.state === 'UNKNOWN' && shouldSpawnAgent(state, effTopic)) {
      const newAgent = spawnAgent(effTopic);
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

  // === LLM GROUNDING PASS (Ahmad approved #2, 2026-06-02) ===
  // For the genuine knowledge gaps this run surfaced, spend ONE governed LLM call each to
  // produce a real, vetted KB answer — the only way the loop learns something it didn't
  // already have, instead of echoing its own templates. Every call is gated by
  // aria-llm-governor (kill switch, monthly cap, dedicated learning sub-cap, one-shot per
  // topic) so it cannot run away or starve the user-facing budget. Dormant-safe: with no
  // ANTHROPIC_API_KEY it simply skips. Bounded to PER_RUN per invocation for speed/cost.
  let llmLearned = 0;
  const llmKey = process.env.ANTHROPIC_API_KEY;
  const perRun = Math.max(0, parseInt(process.env.ARIA_LEARN_LLM_PER_RUN || '1', 10) || 0);
  const timeBudgetMs = parseInt(process.env.ARIA_LEARN_TIME_BUDGET_MS || '7000', 10);
  const slowRun = (Date.now() - t0) > timeBudgetMs;
  if (slowRun && gaps.length) log.push({ event: 'llm-skip', why: 'time-budget', elapsedMs: Date.now() - t0, t: Date.now() });
  if (llmKey && perRun > 0 && gaps.length && !slowRun) {
    // De-dupe gaps by topic, prefer the first occurrence (keeps its question).
    const uniq = [];
    const seenTopic = new Set();
    for (const g of gaps) {
      const k = slugify(g.topic);
      if (seenTopic.has(k)) continue;
      seenTopic.add(k);
      uniq.push(g);
    }
    for (const g of uniq.slice(0, perRun)) {
      try {
        // 1. Authorize (read-only check — does NOT charge or lock yet).
        const auth = await fetch(`${ARIA_BASE}/.netlify/functions/aria-llm-governor`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'authorize-learning', topic: g.topic, estCostUsd: 0.005 })
        }).then(r => r.json()).catch(() => null);
        if (!auth || !auth.permit) {
          log.push({ event: 'llm-skip', topic: g.topic, why: auth ? auth.code : 'governor-unreachable', t: Date.now() });
          continue;
        }
        // 2. Make the one authorized call.
        const ans = await groundWithLLM(g.question, g.topic, llmKey);
        // 3. Commit the ACTUAL cost (charges + locks one-shot only now).
        await fetch(`${ARIA_BASE}/.netlify/functions/aria-llm-governor`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'commit-learning', topic: g.topic, actualCostUsd: ans.costUsd })
        }).catch(() => {});
        // 4. Store ONLY if the model gave a real answer (it returns SKIP when unsure, so
        //    we never bank a hallucination or a non-answer).
        if (ans.text && !/^skip\b/i.test(ans.text) && isRealAnswer(ans.text)) {
          const bitBody = ans.text + '\n\nLearned by ARIA (model: ' + ans.model + '). If this does not resolve in two attempts, that is an L2 escalation — call (647) 581-3182.';
          const slug = `learn-llm-${slugify(g.topic)}-${hash6(ans.text)}`.slice(0, 72);
          await kbLive.set(`${slug}.json`, JSON.stringify({
            heading: `${g.topic}`,
            body: bitBody,
            source_url: null,
            vendor: 'aria-llm-learning',
            query_seed: g.question,
            model: ans.model,
            created_at: new Date().toISOString(),
            agent: 'llm',
            topic: g.topic
          }), { contentType: 'application/json' });
          newKbBits.push(slug);
          indexAdds.push({
            key: `${slug}.json`, topic: g.topic, agent: 'llm',
            kw: `${g.topic} ${ans.text}`.toLowerCase().slice(0, 200),
            bodyHash: hash6(ans.text), c: 0.7, promoted: false, t: Date.now()
          });
          llmLearned++;
          state.bitsLearned = (state.bitsLearned || 0) + 1;
          log.push({ event: 'llm-learn', topic: g.topic, chars: ans.text.length, cost: ans.costUsd, t: Date.now() });
        } else {
          log.push({ event: 'llm-skip', topic: g.topic, why: 'model-skip', t: Date.now() });
        }
      } catch (e) {
        log.push({ event: 'llm-error', topic: g.topic, err: String(e && e.message || e), t: Date.now() });
      }
    }
  }

  // Merge new entries into the retrieval index (kb-index.json) so aria-research can
  // SERVE what was just learned. Read-modify-write is best-effort; the daily promote
  // job rebuilds this index authoritatively. Capped + deduped by key. (Ahmad 2026-06-01)
  if (indexAdds.length) {
    try {
      let idx = (await kbLive.get('kb-index.json', { type: 'json' })) || { entries: [] };
      if (!Array.isArray(idx.entries)) idx.entries = [];
      const seen = new Set(idx.entries.map(e => e.key));
      // Cross-body dedup: if a body with this exact hash is already indexed (under any
      // topic/agent), don't index a second copy — 60 "Scope: single user…" clones used to
      // all land as distinct retrievable entries. (2026-06-02)
      const seenBody = new Set(idx.entries.map(e => e.bodyHash).filter(Boolean));
      for (const add of indexAdds) {
        if (seen.has(add.key)) continue;
        if (add.bodyHash && seenBody.has(add.bodyHash)) continue;
        idx.entries.push(add);
        seen.add(add.key);
        if (add.bodyHash) seenBody.add(add.bodyHash);
      }
      if (idx.entries.length > 6000) idx.entries = idx.entries.slice(-6000); // drop oldest
      idx.updatedAt = new Date().toISOString();
      await kbLive.set('kb-index.json', JSON.stringify(idx), { contentType: 'application/json' });
    } catch (_) {}
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
    skipped: state.skipped || 0, // exchanges rejected by the trust gate (dialog/guess/stub)
    gapsFound: gaps.length,      // genuine knowledge gaps this run
    llmLearned,                  // gaps the governed LLM pass turned into real KB bits
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

// Conversational follow-up: the current agent reacts to the PREVIOUS agent's exchange.
// Stays answerable by aria-research (the topic keyword is preserved) while reading like
// a real back-and-forth in the monitor. (Ahmad 2026-06-01)
const FOLLOWUP_TEMPLATES = [
  'building on what ${prevAgent} said, what is the deeper root cause of ${prev}?',
  'what would ${curAgent} add to ${prevAgent}’s take on ${prev}?',
  'is the ${prev} fix enough, or what breaks it at scale?',
  'what does ${prevAgent} miss about ${prev} that ${curAgent} would catch?',
  'cheapest way to PREVENT ${prev} from recurring after ${prevAgent}’s fix?'
];
function renderFollowup(agent, prevAgent, prevTopic) {
  const t = FOLLOWUP_TEMPLATES[Math.floor(Math.random() * FOLLOWUP_TEMPLATES.length)];
  return t
    .replace(/\$\{prev\}/g, prevTopic)
    .replace(/\$\{prevAgent\}/g, prevAgent)
    .replace(/\$\{curAgent\}/g, agent.name);
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
    // Capture the SUBSTANTIVE steps, not just the first two. For the first-principles
    // reasoner steps[0,1] are generic Scope/Trigger boilerplate (identical across every
    // topic) while the real diagnostic value is in the hypotheses that follow — the old
    // slice(0,2) threw the value away and kept the noise. Join up to the bit budget and
    // drop the canned clarifying-question / L2 footer lines. (Ahmad 2026-06-02)
    const rawSteps = Array.isArray(j.steps) ? j.steps : [];
    const useful = rawSteps.filter(s =>
      !/^CLARIFYING QUESTION:/i.test(s) && !/^If none of these resolve/i.test(s));
    const text = useful.length ? useful.join(' ') : (j.title || 'No curated answer.');
    return {
      text,
      state: j.state || 'UNKNOWN',
      confidence: j.confidence || 0,
      source: j.source || '',
      conversational: j.conversational === true
    };
  } catch (e) {
    return { text: 'fetch-error', state: 'UNKNOWN', confidence: 0 };
  }
}

// Ground a genuine knowledge gap with ONE Anthropic call. Returns { text, costUsd, model }.
// The system prompt forces a CONCISE, vetted answer or the literal token "SKIP" when the
// model isn't confident — so we never bank a hallucination. Cost is computed from the
// returned token usage (rates default to Haiku 4.5; override via env). (Ahmad #2, 2026-06-02)
async function groundWithLLM(question, topic, apiKey) {
  const model = process.env.ARIA_LEARN_MODEL || 'claude-haiku-4-5-20251001';
  // Per-million-token rates, chosen by model family so cost stays accurate whatever model
  // is configured (env overrides win). Over-estimating is fail-safe for the cap.
  const fam = /opus/i.test(model) ? [15, 75] : /sonnet/i.test(model) ? [3, 15] : [1, 5]; // [in,out] $/M; default Haiku
  const inRate = (parseFloat(process.env.ARIA_LEARN_IN_RATE || '') || fam[0]) / 1e6;
  const outRate = (parseFloat(process.env.ARIA_LEARN_OUT_RATE || '') || fam[1]) / 1e6;
  const system = [
    'You are ARIA, writing a concise internal IT-support knowledge-base entry for a Canadian MSP (Integrated IT Support).',
    'A support specialist asked the question below. Answer it as vetted, reusable KB guidance: a tight set of concrete steps or a short paragraph (max ~140 words, no preamble, no sign-off).',
    'Be accurate and specific to real IT/M365/Windows/networking practice. Prefer numbered steps.',
    'If the question is vague, not a real IT question, or you are not confident of a correct answer, reply with EXACTLY the single word: SKIP. Never guess or invent.'
  ].join(' ');
  // Defensive (2026-06-02): the stored ANTHROPIC_API_KEY has a stray backslash+newline
  // from a wrapped paste, which makes Headers.append throw "invalid header value". Anthropic
  // keys contain no whitespace or backslashes, so stripping them reconstructs the real key.
  const cleanKey = String(apiKey || '').replace(/[\s\\]/g, '');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': cleanKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 400, system,
      messages: [{ role: 'user', content: `Topic: ${topic}\nQuestion: ${question}` }]
    })
  });
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    throw new Error(`anthropic ${r.status}: ${err.slice(0, 120)}`);
  }
  const data = await r.json();
  const text = ((data.content && data.content[0] && data.content[0].text) || '').trim();
  const u = data.usage || {};
  const costUsd = +(((u.input_tokens || 0) * inRate) + ((u.output_tokens || 0) * outRate)).toFixed(6);
  return { text, costUsd, model };
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

// Tiny stable hash (djb2 -> base36, 6 chars) so distinct answers earn distinct KB keys
// while identical answers dedupe. No deps, deterministic, $0.
function hash6(s) {
  let h = 5381;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}

function trim(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// A bit is only worth indexing if ARIA actually answered. Filters out the loop's
// no-match placeholders, fetch errors, and too-short stubs.
function isRealAnswer(r) {
  const s = String(r || '').trim();
  if (s.length < 25) return false;
  if (/^(no curated answer|no-response|fetch-error|no response)/i.test(s)) return false;
  return true;
}

// Signature of a junk body that the OLD loop banked as knowledge. Used by ?purge=1 to
// recognize the ~90% non-content already sitting in the live store. (2026-06-02)
function isJunkBody(body) {
  const s = String(body || '').trim();
  if (!isRealAnswer(s.split('\n')[0])) return true;          // stub / too short / no-match
  // Conversational dialog moves — ARIA's greetings & "which app is this about?" clarifiers.
  // Real KB answers open with content ("Microsoft 365…", "Confirm…", "DO NOT…", "Go to…"),
  // never a greeting, so a greeting-prefix is a safe junk signature. Catches the dynamic
  // clarifiers too ("Of course — what is OneDrive doing?"). (2026-06-02)
  if (/^(Hi|Hey|Hello|Sure|Of course|Happy to|Absolutely|Great|Glad|No problem|Sorry|Take care|You're|You’re|Got it|Thanks|Thank you)\b[ ,—-]/i.test(s)) return true;
  // Stock clarifier phrasings — catch them by content too, since they reach the loop via
  // several states (CONVO.*, DIAGNOSING_WHAT, …), not just a greeting prefix. (2026-06-02)
  if (/which app or service is this about/i.test(s)) return true;
  if (/what (are you running into|exactly is happening|is .{1,30} doing)\b/i.test(s)) return true;
  if (/^Scope: .*Isolate by trying the same action/i.test(s)) return true; // first-principles boilerplate
  if (/^Scope: .*check status pages first/i.test(s)) return true;
  return false;
}

// One-time sweep: delete junk learn-* bits from the live store and rebuild kb-index.json
// from the survivors. Returns a report. (2026-06-02)
async function purgeJunk(kbLive) {
  let removed = 0, kept = 0, scanned = 0;
  const survivors = [];
  let cursor;
  do {
    const page = await kbLive.list({ prefix: 'learn-', cursor });
    cursor = page.cursor;
    for (const { key } of page.blobs) {
      scanned++;
      let doc;
      try { doc = await kbLive.get(key, { type: 'json' }); } catch { continue; }
      if (!doc) continue;
      if (isJunkBody(doc.body)) {
        try { await kbLive.delete(key); removed++; } catch (_) {}
      } else {
        kept++;
        survivors.push({
          key,
          topic: doc.topic || '',
          agent: doc.agent || '',
          kw: `${doc.topic || ''} ${doc.agent || ''} ${doc.body || ''}`.toLowerCase().slice(0, 200),
          bodyHash: hash6(String(doc.body || '').split('\n')[0]),
          c: 0, promoted: false, t: Date.parse(doc.created_at || '') || 0
        });
      }
    }
  } while (cursor);
  // Rebuild the index from survivors, collapsing identical bodies.
  const seenBody = new Set();
  const entries = [];
  for (const e of survivors) {
    if (e.bodyHash && seenBody.has(e.bodyHash)) continue;
    if (e.bodyHash) seenBody.add(e.bodyHash);
    entries.push(e);
  }
  try {
    await kbLive.set('kb-index.json', JSON.stringify({ entries, updatedAt: new Date().toISOString(), rebuiltBy: 'purge' }), { contentType: 'application/json' });
  } catch (_) {}
  return { ok: true, action: 'purge', scanned, removed, kept, indexed: entries.length };
}
