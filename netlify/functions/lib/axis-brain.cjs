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
//   1 recall       — ARIA brain, previously-banked answers (never pay twice)     $0
//   2 kb           — ARIA brain, curated static KB (aria-kb-query)               $0
//   3 research     — the research agents (aria-research)                         $0
//   4 subscription — local Claude CLI on the Max plan, time-boxed                $0 API spend
//   5 anthropic    — metered API. Last resort, run by the caller, not here.
// Whatever tier ≥2 answers, the result is written back so tier 1 catches it next time.

const KB_LIVE = 'aria-kb-live';           // same store aria-kb-query merges promoted entries from
const JOBS = 'axis-brain-jobs';           // question queue the local worker polls
const HEARTBEAT_KEY = 'worker-heartbeat'; // worker liveness; stale ⇒ skip tier 3 rather than stall
const HEARTBEAT_MAX_MS = 120000;          // 2 min — worker writes every 30s
const SUB_WAIT_MS = 7800;                 // hard cap; the function itself must return in ~10s.
                                          // The local CLI needs ~6s for a real answer (measured), so a
                                          // smaller budget escalated to the metered API every time.
const SUB_POLL_MS = 400;
// The cascade's own KB bar. aria-kb-query's floor is 8 and stays 8 for its other callers; a weak
// topical match must not pre-empt the Max plan with a wrong answer. See kbTier() for the measurements.
const KB_MIN_CONFIDENCE = 15;

// NOTE: no getStore() anywhere in this file on purpose. Netlify does not inject the Blobs context
// into legacy CJS `exports.handler` functions, so every Blobs touch goes through axis-brain-queue.mjs.

// ── Tier 1: ARIA brain ───────────────────────────────────────────────────────
// Two halves, both $0:
//   a) previously-banked answers (the learning loop's own output), read via the v2 helper, and
//   b) the curated static KB via aria-kb-query.
// (a) goes first because it is the whole point of banking — a question answered once should never
// be paid for again. It has to be read through axis-brain-queue.mjs because aria-kb-query is a
// v1-style function with no Blobs context, so its own live-KB merge silently returns nothing.
async function recallTier(query, origin, auth) {
  if (!origin) return null;
  try {
    const r = await queueCall(origin, auth, { action: 'recall', query });
    if (!r || !r.ok || !r.match || !r.answer) return null;
    return { text: String(r.answer).trim(), tier: 'kb-learned', source: r.source || 'aria-brain-learned',
      confidence: r.confidence || null, cost: 0 };
  } catch (_) { return null; }
}

async function kbTier(query, origin) {
  try {
    const r = await fetch(`${origin}/.netlify/functions/aria-kb-query`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.match) return null;                       // below the KB's own confidence floor
    // aria-kb-query's floor is 8, tuned for Sentinel's troubleshooting queries. The cascade needs a
    // higher bar, because a weak topical match here PRE-EMPTS the Max plan and ships a wrong answer.
    // Measured 2026-08-11 against the live KB — the separation is clean:
    //   "reseller margin for M365 Business Premium" → 8  (returned a TENANT MIGRATION article)
    //   "Synology NAS degraded RAID"                → 8  (returned a MAPPED DRIVE article)
    //   "outlook keeps asking for password"         → 28 (correct)
    //   "printer is offline"                        → 36 (correct)
    // False positives sit exactly on the floor; real hits are 28+. 15 splits them with room either
    // side. aria-kb-query is untouched — it still answers ARIA and Sentinel at its own threshold.
    if (typeof j.confidence === 'number' && j.confidence < KB_MIN_CONFIDENCE) return null;
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

// Is the local worker alive? Exported so the caller can tell "the plan is unreachable" apart from
// "the plan answered nothing". Those need opposite advice: the first is fixed for free by starting a
// process, the second by topping up an account. Reporting the second when it is the first is what
// sent Ahmad to Plans & Billing on 2026-08-12 for a problem that cost nothing to fix.
async function workerOnline({ origin, auth } = {}) {
  if (!origin) return false;
  try {
    const live = await queueCall(origin, auth, { action: 'online' });
    return !!(live && live.online);
  } catch (_) { return false; }
}

async function subscriptionTier(query, { origin, auth, waitMs = SUB_WAIT_MS, turns = [], board = '' } = {}) {
  if (!origin) return null;
  try {
    // Never queue a job nobody will pick up — that would burn the whole budget waiting on silence.
    const live = await queueCall(origin, auth, { action: 'online' });
    if (!live || !live.online) return null;

    // The conversation and the on-screen board ride with the question, because this is the tier
    // where a model reasons — "remove it" without its antecedent turns is unanswerable by design.
    const q = await queueCall(origin, auth, {
      action: 'enqueue', query: String(query).slice(0, 4000),
      turns: Array.isArray(turns) ? turns.slice(-10) : [],
      board: String(board || '').slice(0, 1500),
    });
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
    // STILL RUNNING, not failed. Measured 2026-08-11: the local CLI needs ~16.7s for a real
    // question, while a Netlify function must return in ~10s. Returning null here made the caller
    // fall through to the metered API and report "out of credit" — a wrong diagnosis for a plan
    // answer that arrives seconds later and is banked correctly. Hand the job id back instead so
    // the console can collect it.
    return { pending: true, jobId: q.id, tier: 'subscription', source: 'claude-max-plan', cost: 0 };
  } catch (_) { return null; }
}

// ── Quality gate ─────────────────────────────────────────────────────────────
// The learning loop once banked its own boilerplate as "knowledge" (~90% slop, fixed 2026-06-02).
// Nothing gets written back unless it is a real answer: not a greeting, not a clarifying question,
// not a refusal, not an error string, and long enough to actually say something.
const SLOP = /^(hi|hello|hey|sure|ok|okay|got it|heard you|thanks|understood)\b/i;
const NON_ANSWER = /\b(i (don'?t|do not) know|i'?m not sure|cannot help|can'?t help|no curated answer|unable to|as an ai)\b/i;
const IS_QUESTION = /\?\s*$/;

// A long, useful answer often ends with a friendly offer ("Want me to draft the rate card?").
// That is conversational cruft, not knowledge — strip it rather than discard the whole answer.
// Measured 2026-08-11: a 1965-character Max-plan answer was thrown away by a bare /\?$/ test
// purely because of its closing sentence.
const OFFER = /(?:^|[.!?]\s+)((?:want me to|shall i|should i|would you like|do you want|need me to|let me know if)[^.!?]*\?)\s*$/i;
function stripTrailingOffer(text) {
  return String(text || '').trim().replace(OFFER, (m, q, off) => m.slice(0, m.length - q.length)).trim();
}

function isSubstantive(text) {
  const t = stripTrailingOffer(text);
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
async function learnBack({ query, answer, tier, source, origin, auth }, now = Date.now) {
  if (!worthLearning(query, answer, tier)) return { learned: false, reason: 'gate' };
  if (!origin) return { learned: false, reason: 'no-origin' };
  const topic = String(query).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const key = 'learn-' + topic.replace(/\s+/g, '-').slice(0, 60) + '-' + now().toString(36);
  try {
    const r = await queueCall(origin, auth, {
      action: 'learn', key, topic, question: String(query).slice(0, 500),
      body: stripTrailingOffer(answer).slice(0, 3500), source: source || tier,
    });
    return r && r.ok ? { learned: true, key } : { learned: false, reason: (r && r.reason) || 'learn-failed' };
  } catch (_) { return { learned: false, reason: 'unreachable' }; }
}

// ── The cascade ──────────────────────────────────────────────────────────────
// Returns an answer from the cheapest tier that has one, or null so the caller escalates to the
// metered API. `skip` lets tests and callers disable a tier without editing this file.
async function askBrain({ query, turns = [], board = '', origin, auth, skip = [], subWaitMs = SUB_WAIT_MS }) {
  const q = String(query || '').trim();
  if (!q) return null;
  const tried = [];

  // Ahmad's stated order (2026-08-11): "ARIA brain > research agents > KBs we have > max plan."
  //   recall       = the ARIA brain proper — everything AXIS has previously learned and banked.
  //   research     = the research agents.
  //   kb           = the static KB packs (281 curated chunks).
  //   subscription = the Claude Max plan he pays for monthly.
  // The metered Anthropic API is not a tier here at all — it stays where it always was, after this
  // whole cascade returns null, in axis-director.js. All four below are $0.
  for (const [name, run] of [
    ['recall', () => recallTier(q, origin, auth)],   // banked answers first — never pay twice
    ['research', () => researchTier(q, origin)],
    ['kb', () => kbTier(q, origin)],
    ['subscription', () => subscriptionTier(q, { origin, auth, waitMs: subWaitMs, turns, board })],
  ]) {
    if (skip.includes(name)) continue;
    tried.push(name);
    let hit = null;
    try { hit = await run(); } catch (_) { hit = null; }
    if (hit && (hit.text || hit.pending)) return { ...hit, tried };
  }
  return null;
}

module.exports = { askBrain, stripTrailingOffer, recallTier, kbTier, researchTier, subscriptionTier, workerOnline, learnBack, isSubstantive, worthLearning,
  KB_LIVE, JOBS, HEARTBEAT_KEY, HEARTBEAT_MAX_MS };
