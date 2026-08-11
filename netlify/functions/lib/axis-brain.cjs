// axis-brain.cjs — the cost cascade behind AXIS.
//
// Ahmad, 2026-08-11: "the brain should be using ARIA brain, then research using the agents we have,
// and if we are time pressed … use the plan I pay for every month and move to anthropic if needed
// and no solution found. Once it finds a solution the kb agent notes it down and saves into the
// ARIA brain so in the future we dont have to use anthropic credit and waste tokens and money."
//
// WHY THE MONTHLY PLAN CANNOT BE CALLED FROM HERE (the honest constraint):
// Ahmad's Claude **Max subscription** authenticates over OAuth stored on his machine at
// ~/.claude/.credentials.json (subscriptionType "max", scope user:inference). It is bound to Claude
// Code / claude.ai sessions. A Netlify function has no access to it, and shipping those tokens to a
// server would be both a terms problem and a credential-exfiltration risk. `ANTHROPIC_API_KEY` is a
// *separate, metered* pay-as-you-go account — which is the one that ran out of credit on 2026-08-11.
// So the plan is reached the only sound way: the question is queued, and the worker already running
// on Ahmad's machine (scripts/axis-brain-worker.mjs) answers it with the local `claude` CLI on his
// subscription. Zero API credits.
//
// CJS on purpose: axis-director.js is `exports.handler` CJS and cannot import ESM.
//
// TIERS, cheapest first. Each returns null to fall through; nothing here ever throws upward.
//   1 kb           — ARIA brain (aria-kb-query, incl. promoted learned bits)   $0
//   2 research     — the research agents (aria-research)                        $0
//   3 subscription — local Claude CLI on the Max plan, time-boxed               $0 API spend
//   4 anthropic    — metered API. Last resort, run by the caller, not here.
// Whatever tier ≥2 answers, the result is written back so tier 1 catches it next time.

const KB_LIVE = 'aria-kb-live';           // same store aria-kb-query merges promoted entries from
const JOBS = 'axis-brain-jobs';           // question queue the local worker polls
const HEARTBEAT_KEY = 'worker-heartbeat'; // worker liveness; stale ⇒ skip tier 3 rather than stall
const HEARTBEAT_MAX_MS = 120000;          // 2 min — worker writes every 30s
const SUB_WAIT_MS = 6500;                 // hard cap; the function itself must return in ~10s
const SUB_POLL_MS = 400;

function store(name, consistency = 'strong') {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name, consistency });
}

// ── Tier 1: ARIA brain ───────────────────────────────────────────────────────
async function kbTier(query, origin) {
  try {
    const r = await fetch(`${origin}/.netlify/functions/aria-kb-query`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.match) return null;                       // below the KB's own confidence floor
    const text = String(j.content_excerpt || j.answer || '').trim();
    if (!text) return null;
    return { text, tier: 'kb', source: j.source || 'aria-kb', confidence: j.confidence || null, cost: 0 };
  } catch (_) { return null; }
}

// ── Tier 2: research agents ──────────────────────────────────────────────────
async function researchTier(query, origin) {
  try {
    const r = await fetch(`${origin}/.netlify/functions/aria-research`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, q: query }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = String((j && (j.answer || j.text || j.summary)) || '').trim();
    if (!text || !isSubstantive(text)) return null;
    const steps = j && Array.isArray(j.steps) ? j.steps : null;
    return { text: steps && steps.length ? text + '\n' + steps.map(s => '• ' + s).join('\n') : text,
      tier: 'research', source: 'aria-research', cost: 0 };
  } catch (_) { return null; }
}

// ── Tier 3: the monthly plan, via the local worker ───────────────────────────
// Goes through axis-brain-queue.mjs rather than touching Blobs here. Measured 2026-08-11: Netlify
// does NOT inject the Blobs context into legacy CJS `exports.handler` functions like axis-director
// — `getStore()` there throws "The environment has not been configured to use Netlify Blobs", while
// a v2 ESM function in the SAME deploy gets it automatically. So the mailbox lives in v2 and we call
// it over HTTP, exactly like tiers 1 and 2 call aria-kb-query / aria-research.
async function queueCall(origin, auth, payload) {
  const r = await fetch(`${origin}/.netlify/functions/axis-brain-queue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return null;
  return r.json();
}

async function subscriptionTier(query, { origin, auth, waitMs = SUB_WAIT_MS } = {}) {
  if (!origin) return null;
  try {
    // Never queue a job nobody will pick up — that would burn the whole budget waiting on silence.
    const live = await queueCall(origin, auth, { action: 'online' });
    if (!live || !live.online) return null;

    const q = await queueCall(origin, auth, { action: 'enqueue', query: String(query).slice(0, 4000) });
    if (!q || !q.ok || !q.id) return null;

    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, SUB_POLL_MS));
      const p = await queueCall(origin, auth, { action: 'poll', id: q.id });
      if (p && p.ready) {
        if (p.answer) return { text: String(p.answer).trim(), tier: 'subscription', source: 'claude-max-plan', cost: 0 };
        return null;                      // worker reported an error — escalate
      }
    }
    return null;                          // too slow this time — caller escalates to the metered API
  } catch (_) { return null; }
}

// ── Quality gate ─────────────────────────────────────────────────────────────
// The learning loop once banked its own boilerplate as "knowledge" (~90% slop, fixed 2026-06-02).
// Nothing gets written back unless it is a real answer: not a greeting, not a clarifying question,
// not a refusal, not an error string, and long enough to actually say something.
const SLOP = /^(hi|hello|hey|sure|ok|okay|got it|heard you|thanks|understood)\b/i;
const NON_ANSWER = /\b(i (don'?t|do not) know|i'?m not sure|cannot help|can'?t help|no curated answer|unable to|as an ai)\b/i;
const IS_QUESTION = /\?\s*$/;

function isSubstantive(text) {
  const t = String(text || '').trim();
  if (t.length < 60) return false;          // one-liners carry no reusable procedure
  if (SLOP.test(t)) return false;
  if (NON_ANSWER.test(t)) return false;
  if (IS_QUESTION.test(t)) return false;    // a clarifying question is not a solution
  return true;
}

// A learned bit is only worth banking if the question was a real one too — "hi" must never create
// a KB entry, no matter how good the answer looked.
function worthLearning(query, answer, tier) {
  if (tier === 'kb') return false;          // already in the brain; re-banking it is the echo chamber
  const q = String(query || '').trim();
  if (q.length < 12 || SLOP.test(q)) return false;
  return isSubstantive(answer);
}

// ── KB write-back (the "KB agent notes it down" step) ────────────────────────
// Writes into the SAME store + shape aria-kb-query reads and aria-learning-promote curates.
// `promoted: true` is set only for answers that came from a real reasoning tier AND passed the gate
// — that is the one-shot-learning fast path Ahmad asked for. The existing 3-recurrence promotion
// path in aria-learning-promote.mjs is untouched and still governs everything else.
async function learnBack({ query, answer, tier, source }, now = Date.now) {
  if (!worthLearning(query, answer, tier)) return { learned: false, reason: 'gate' };
  const topic = String(query).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const key = 'learn-' + topic.replace(/\s+/g, '-').slice(0, 60) + '-' + now().toString(36);
  try {
    await store(KB_LIVE).setJSON(key, {
      topic,
      question: String(query).slice(0, 500),
      body: String(answer).slice(0, 3500),
      agent: 'axis-brain',
      source: source || tier,
      verified_answer: true,          // came from a reasoning tier and cleared the quality gate
      promoted: true,                 // searchable immediately — that is the whole point
      promoted_at: new Date(now()).toISOString(),
      created_at: new Date(now()).toISOString(),
    });
    return { learned: true, key };
  } catch (e) {
    return { learned: false, reason: 'store-unavailable' };
  }
}

// ── The cascade ──────────────────────────────────────────────────────────────
// Returns an answer from the cheapest tier that has one, or null so the caller escalates to the
// metered API. `skip` lets tests and callers disable a tier without editing this file.
async function askBrain({ query, origin, auth, skip = [], subWaitMs = SUB_WAIT_MS }) {
  const q = String(query || '').trim();
  if (!q) return null;
  const tried = [];

  for (const [name, run] of [
    ['kb', () => kbTier(q, origin)],
    ['research', () => researchTier(q, origin)],
    ['subscription', () => subscriptionTier(q, { origin, auth, waitMs: subWaitMs })],
  ]) {
    if (skip.includes(name)) continue;
    tried.push(name);
    let hit = null;
    try { hit = await run(); } catch (_) { hit = null; }
    if (hit && hit.text) return { ...hit, tried };
  }
  return null;
}

module.exports = { askBrain, kbTier, researchTier, subscriptionTier, learnBack, isSubstantive, worthLearning,
  KB_LIVE, JOBS, HEARTBEAT_KEY, HEARTBEAT_MAX_MS };
