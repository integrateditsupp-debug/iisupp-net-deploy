// axis-model-router.mjs — pick the cheapest model that can actually answer, and only climb when it can't.
//
// Ahmad, 2026-08-12: "ensure it is smart to know if its a simple question it uses kaiku 4.5 to look
// for answers and complex ones sonnet 4.6 and so on, basically it has to know not to use too much
// token unless needed and there is no choice."
//
// THE BUG THIS FIXES: axis-brain-worker.mjs called `claude --print` with NO --model flag, so every
// question — "how many videos are staged?" included — ran on the session default. On a Max plan that
// is not a dollar cost, but it is a *rate-limit* cost: the plan meters usage, and spending the
// heavy model on a one-line lookup is what makes the plan run out mid-afternoon. Routing by
// difficulty is the whole saving.
//
// The ladder, cheapest first. Each rung only runs if the one below it declined or failed the gate:
//   0  vault      — answered from the Obsidian vault, no model at all      (see axis-vault-brain.mjs)
//   1  haiku      — lookups, status, yes/no, short factual, rephrasing
//   2  sonnet     — real questions: explain, compare, draft, debug, plan a change
//   3  opus       — architecture, multi-system reasoning, anything that already failed at sonnet
//
// Escalation is one rung at a time and capped, because "no choice" has to mean *demonstrated* no
// choice — the cheap tier actually produced something unusable — not a guess made before trying.

// Pinned rather than aliased. `sonnet` tracks whatever is newest, which silently changes AXIS's
// behaviour and cost profile under Ahmad without a commit. Override per-tier with env vars.
// (Claude Sonnet 5 is available and is the stronger model at this rung; Ahmad specified 4.6, so 4.6
// is the default and AXIS_MODEL_STANDARD=claude-sonnet-5 switches it without a code change.)
// timeoutMs is per-tier because the flat 55s cap was measured killing exactly the answers that
// mattered most: on 2026-08-12 "remove all those from our to-do list" escalated fast→standard→deep
// and BOTH upper rungs died at 55s — total silence — while a deep answer that did land took 69s.
// The heavy model being slower is the point of escalating to it; capping it at the fast tier's
// budget makes the ladder's top rung unreachable exactly when it is needed.
export const TIERS = [
  { name: 'fast',     model: process.env.AXIS_MODEL_FAST     || 'claude-haiku-4-5',  maxTokensHint: 400,  timeoutMs: 45000 },
  { name: 'standard', model: process.env.AXIS_MODEL_STANDARD || 'claude-sonnet-4-6', maxTokensHint: 1200, timeoutMs: 75000 },
  { name: 'deep',     model: process.env.AXIS_MODEL_DEEP     || 'claude-opus-5',     maxTokensHint: 3000, timeoutMs: 150000 },
];
export const TIER_BY_NAME = Object.fromEntries(TIERS.map(t => [t.name, t]));

// ── Execution vs answering ───────────────────────────────────────────────────
// Ahmad, 2026-08-12: "ensure claude code uses opus 5 to execute unless I specify to use fable 5 or
// any other model. and claude cowork should use which ever model relevant based on what I ask. End
// goal is quality work."
//
// The ladder above is for ANSWERING, where a wrong cheap answer costs a re-ask. Execution is not
// that: Claude Code edits files, and a wrong edit costs a debugging session or a bad deploy. So
// execution does NOT ride the cost ladder — it has a flat quality floor.
//
// Until now askClaudeIn() passed no --model at all, so self.fix, machine.run and cowork.ask each ran
// on whatever the CLI session happened to default to. That is the same omission that made every
// answer run on the default model before the router existed, one function over.
export const EXECUTE_MODEL = process.env.AXIS_MODEL_EXECUTE || 'claude-opus-5';

// Cowork plans and reasons about the repo. Routing a planning conversation down to the fast tier is
// precisely the quality loss Ahmad is guarding against, so Cowork picks per request but never drops
// below `standard`. (AXIS_MODEL_STANDARD is claude-sonnet-4-6 because Ahmad named that version;
// claude-sonnet-5 is the stronger model at the same rung and is a drop-in env change if he wants it.)
export const COWORK_FLOOR = 'standard';

// Spoken or typed model requests. "use fable 5 for this", "run that on opus", "with haiku".
// Requires a directive word before the name so a passing mention ("why is opus expensive?") does not
// silently re-route the task.
const MODEL_ALIASES = [
  [/\bfable(\s*5)?\b/i, 'claude-fable-5'],
  [/\bmythos(\s*5)?\b/i, 'claude-mythos-5'],
  [/\bopus\s*4[.\s-]?8\b/i, 'claude-opus-4-8'],
  [/\bopus\s*4[.\s-]?7\b/i, 'claude-opus-4-7'],
  [/\bopus\s*4[.\s-]?6\b/i, 'claude-opus-4-6'],
  [/\bopus(\s*5)?\b/i, 'claude-opus-5'],
  [/\bsonnet\s*4[.\s-]?6\b/i, 'claude-sonnet-4-6'],
  [/\bsonnet(\s*5)?\b/i, 'claude-sonnet-5'],
  [/\bhaiku(\s*4[.\s-]?5)?\b/i, 'claude-haiku-4-5'],
];
const DIRECTIVE = /\b(use|using|used|with|on|via|through|switch(?:ing)?\s+to|run\s+(?:it\s+|this\s+|that\s+)?(?:on|with)|in)\b/i;

/**
 * An explicit model instruction inside Ahmad's own words, or null.
 * A full model id anywhere in the text always wins — that is unambiguous by construction.
 */
export function modelOverride(text) {
  const s = String(text || '');
  const exact = s.match(/\bclaude-[a-z0-9-]+\b/i);
  if (exact) return exact[0].toLowerCase();
  if (!DIRECTIVE.test(s)) return null;
  for (const [re, id] of MODEL_ALIASES) if (re.test(s)) return id;
  return null;
}

/**
 * Resolve the model for one request.
 * @param {string} text        what Ahmad actually said
 * @param {'execute'|'cowork'|'answer'} purpose
 * @returns {{model:string, why:string, overridden:boolean}}
 */
export function modelForRequest(text, purpose = 'answer') {
  const override = modelOverride(text);
  if (override) return { model: override, why: 'Ahmad named the model', overridden: true };

  if (purpose === 'execute') {
    return { model: EXECUTE_MODEL, why: 'execution floor - code edits are not cost-optimised', overridden: false };
  }
  if (purpose === 'cowork') {
    const r = classify(text);
    const floored = SEVERITY_ORDER.indexOf(r.tier) < SEVERITY_ORDER.indexOf(COWORK_FLOOR) ? COWORK_FLOOR : r.tier;
    return {
      model: TIER_BY_NAME[floored].model,
      why: floored === r.tier ? `matched request (${r.why})` : `raised to ${floored} - planning never runs on the fast tier`,
      overridden: false,
    };
  }
  const r = classify(text);
  return { model: r.model, why: r.why, overridden: false };
}

// Cheapest-to-strongest, for the floor comparison above.
const SEVERITY_ORDER = ['fast', 'standard', 'deep'];

// ── Signals ──────────────────────────────────────────────────────────────────
// Deliberately lexical, not a model call. Asking a model which model to use would cost a round trip
// and defeat the point.

// Things that are cheap no matter how they are phrased: a fact, a count, a status, a yes/no.
const FAST_SIGNALS = [
  /^(what|when|where|who|which|how many|how much|is|are|was|were|do|does|did|can|should|will)\b/i,
  /\b(status|how many|what time|when is|when did|what is the|what'?s the|list|show me|remind me)\b/i,
  /\b(yes or no|quick|quickly|just tell me|one line|briefly)\b/i,
];

// Things that genuinely need reasoning across several facts or a piece of writing.
const STANDARD_SIGNALS = [
  /\b(why|explain|compare|difference between|pros and cons|walk me through|how do i|how would|draft|write|rewrite|summari[sz]e|review)\b/i,
  /\b(debug|fix|troubleshoot|diagnose|error|failing|broken|not working)\b/i,
  /\b(plan|approach|options|recommend|suggest|should we|worth it)\b/i,
];

// Things that need the heavy model: whole-system design, trade-offs with consequences, or work that
// spans several moving parts at once.
const DEEP_SIGNALS = [
  /\b(architect|architecture|design (?:a|the|our) (?:system|schema|pipeline|migration)|re-?architect)\b/i,
  /\b(migrat(?:e|ion) plan|trade-?offs?|end-to-end|from scratch|strategy for|roadmap|scales? to)\b/i,
  /\b(security review|threat model|audit the|refactor the (?:whole|entire))\b/i,
  /\b(multi-step|several systems|across (?:the )?(?:stack|services|repos))\b/i,
];

const CODE_BLOCK = /```|\bfunction\s+\w+\s*\(|\bclass\s+\w+|=>\s*\{|\bSELECT\b.+\bFROM\b/i;

/**
 * Classify a question into a starting tier.
 * @returns {{tier:'fast'|'standard'|'deep', model:string, why:string, score:number}}
 */
export function classify(question, { contextChars = 0 } = {}) {
  const q = String(question || '').trim();
  const words = q.split(/\s+/).filter(Boolean).length;
  const why = [];
  let score = 0;   // <1 fast · 1–2.5 standard · >2.5 deep

  const isStandard = STANDARD_SIGNALS.some(r => r.test(q));
  const isDeep = DEEP_SIGNALS.some(r => r.test(q));

  // Length is a weak proxy for difficulty; an explicit reasoning verb is a strong one. When both are
  // present the verb wins, so the short-length penalty is suppressed. Without this, "compare
  // Sourcewell and MERX for our next bid" (8 words) scored -0.8 for brevity against +1.4 for
  // "compare" and routed to haiku — a genuine comparison sent to the cheapest model because it was
  // phrased tersely. Caught by tests/axis-vault-brain.test.mjs.
  if (words >= 45) { score += 0.9; why.push('long'); }
  else if (words >= 28) { score += 0.4; why.push('medium-long'); }
  else if (!isStandard && !isDeep) {
    if (words <= 8) { score -= 0.8; why.push('very short'); }
    else if (words <= 18) { score -= 0.3; why.push('short'); }
  }

  // A lookup phrasing only argues for the cheap tier when nothing else argues against it: "how do i
  // fix the paywall" opens like a lookup but is a debugging question.
  if (FAST_SIGNALS.some(r => r.test(q)) && !isStandard && !isDeep) { score -= 0.7; why.push('lookup phrasing'); }
  if (isStandard) { score += 1.4; why.push('reasoning verb'); }
  // Weighted to clear the deep threshold on its own: "architect a billing pipeline" is the deep
  // tier by definition, and should not need a second corroborating signal to get there.
  if (isDeep) { score += 2.6; why.push('design/architecture'); }
  if (CODE_BLOCK.test(q)) { score += 1.2; why.push('contains code'); }

  // Several distinct asks in one breath is a complexity signal that phrasing alone misses.
  const clauses = (q.match(/\b(and then|after that|also|as well as|plus)\b/gi) || []).length
    + Math.max(0, (q.match(/\?/g) || []).length - 1);
  if (clauses >= 2) { score += 0.9; why.push(`${clauses} sub-asks`); }

  // A big pile of vault context means the answer has to reconcile several notes, not recite one.
  if (contextChars > 1500) { score += 0.5; why.push('wide vault context'); }

  const tier = score > 2.5 ? 'deep' : score >= 1 ? 'standard' : 'fast';
  return { tier, model: TIER_BY_NAME[tier].model, score: Number(score.toFixed(2)), why: why.join(', ') || 'default' };
}

/** The next rung up, or null at the top. */
export function escalate(tierName) {
  const i = TIERS.findIndex(t => t.name === tierName);
  return (i < 0 || i >= TIERS.length - 1) ? null : TIERS[i + 1];
}

// ── Did the cheap tier actually answer? ──────────────────────────────────────
// This is the "no choice" test. Escalation is justified only by evidence, so it keys on the answer
// being unusable — empty, an error, a refusal, a hedge, or a clarifying question — never on a hunch.
const HEDGE = /\b(i (don'?t|do not) know|i'?m not sure|not certain|cannot determine|unable to|insufficient (?:information|context)|need more (?:information|context|detail)|as an ai)\b/i;
const CLARIFYING = /\?\s*$/;

/**
 * @returns {{ok:boolean, reason?:string}} — ok:false means try the next rung up.
 */
export function answerUsable(answer, { minChars = 40 } = {}) {
  const a = String(answer || '').trim();
  if (!a) return { ok: false, reason: 'empty' };
  if (a.length < minChars) return { ok: false, reason: 'too short' };
  if (HEDGE.test(a)) return { ok: false, reason: 'model hedged' };
  if (CLARIFYING.test(a) && a.length < 240) return { ok: false, reason: 'asked for clarification' };
  return { ok: true };
}

// ── Usage ledger ─────────────────────────────────────────────────────────────
// Not billing — the Max plan is flat. This exists so "the plan ran out again" is answerable with
// numbers instead of a guess, and so a routing regression (everything landing on opus) is visible.
const ledger = new Map();

export function recordUse(tierName, model, { escalatedFrom = null, ms = 0 } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const k = `${day}|${tierName}`;
  const e = ledger.get(k) || { day, tier: tierName, model, calls: 0, escalations: 0, totalMs: 0 };
  e.calls++;
  if (escalatedFrom) e.escalations++;
  e.totalMs += ms;
  ledger.set(k, e);
  return e;
}

export function usageReport() {
  const rows = [...ledger.values()].sort((a, b) => (a.day + a.tier).localeCompare(b.day + b.tier));
  const total = rows.reduce((n, r) => n + r.calls, 0);
  return { total, rows: rows.map(r => ({ ...r, avgMs: r.calls ? Math.round(r.totalMs / r.calls) : 0 })) };
}

export function resetUsage() { ledger.clear(); }
