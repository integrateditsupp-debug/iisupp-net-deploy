// RUN 20 §5 — the doctor brain. Pure + node-safe: matches a user's symptom against the KB, ranks causes
// by probability × live-system relevance, surfaces unrelated anomalies, gates actions by "first, do no
// harm", and drafts an escalation after repeated Tier-0 failures. No I/O, no Electron, no actuation.

const STOP = new Set(["the", "a", "an", "is", "it", "my", "to", "of", "on", "in", "and", "i", "me", "no", "not", "cant", "cannot", "wont", "keeps", "very", "so", "this", "that", "with", "for"]);

function tokens(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
}

/** 0..1 similarity between a user input and a known phrasing (token Jaccard + substring bonus). */
export function fuzzyScore(input, phrasing) {
  const a = new Set(tokens(input));
  const b = new Set(tokens(phrasing));
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size;
  let score = inter / union;
  const inLc = String(input || "").toLowerCase();
  const phLc = String(phrasing || "").toLowerCase();
  if (inLc.includes(phLc) || phLc.includes(inLc)) score += 0.4; // strong phrase containment
  return Math.min(1, score);
}

/** Top-N symptom files by best phrasing/title match. */
export function fuzzyMatchSymptoms(input, kb, limit = 3) {
  const scored = (kb || []).map((rec) => {
    const candidates = [...(rec.phrasings || []), rec.title, ...(rec.symptoms || [])];
    let best = 0;
    for (const c of candidates) best = Math.max(best, fuzzyScore(input, c));
    return { id: rec.id, title: rec.title, score: Number(best.toFixed(3)), record: rec };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

// Map detection-text keywords to the live system-context signal that should boost that cause.
const CONTEXT_SIGNALS = [
  { rx: /\b(ram|memory)\b/i, test: (c) => num(c?.ram?.percentUsed) >= 85 },
  { rx: /\bcpu\b/i, test: (c) => num(c?.cpu?.load) >= 85 },
  { rx: /\b(disk|drive|storage|space)\b/i, test: (c) => num(c?.disk?.percentFree) > 0 && num(c?.disk?.percentFree) <= 10 },
  { rx: /\b(driver|gpu|graphics)\b/i, test: (c) => num(errorCount(c, "gpu")) >= 5 || num(errorCount(c, "display")) >= 5 },
  { rx: /\b(network|dns|adapter|wifi|wi-fi)\b/i, test: (c) => num(errorCount(c, "network")) >= 5 }
];

function num(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function errorCount(ctx, subsystem) {
  const map = (ctx && ctx.eventLog && ctx.eventLog.errorsBySubsystem) || {};
  return num(map[subsystem]);
}

/** Boost added to a cause's probability when the live context confirms its detection signal. */
export function contextBoost(cause, context) {
  if (!context) return 0;
  let boost = 0;
  for (const sig of CONTEXT_SIGNALS) {
    if (sig.rx.test(cause.detection || "") && sig.test(context)) boost += 50;
  }
  return boost;
}

/** Rank causes by probability + live-context relevance (highest first). */
export function rankCauses(causes, context) {
  return (causes || [])
    .map((c) => ({ ...c, boost: contextBoost(c, context), relevance: c.probability + contextBoost(c, context) }))
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Flag subsystems with high error counts that are UNRELATED to the symptom being worked — the doctor
 * noticing an incidental finding ("I also notice X — might be related. Want to investigate?").
 */
export function surfaceAnomalies(context, { relatedSubsystems = [], threshold = 10 } = {}) {
  const map = (context && context.eventLog && context.eventLog.errorsBySubsystem) || {};
  const related = new Set(relatedSubsystems.map((s) => String(s).toLowerCase()));
  return Object.entries(map)
    .filter(([sub, count]) => num(count) >= threshold && !related.has(String(sub).toLowerCase()))
    .map(([sub, count]) => ({ subsystem: sub, count: num(count), note: `${count} errors in ${sub} in the last 24h — unrelated to the reported symptom.` }))
    .sort((a, b) => b.count - a.count);
}

/**
 * First, do no harm. Only a Tier-0, read-only, dry-run action may proceed without an explicit OK;
 * anything that changes state requires user confirmation.
 */
export function canAutoRun(action = {}) {
  return action.tier === "tier-0-safe-generic" && action.readOnly === true && action.dryRun === true
    && action.touchesSystemFiles !== true && action.deletesUserData !== true;
}
export function requiresConfirmation(action = {}) {
  return !canAutoRun(action);
}

/** After N (default 3) failed Tier-0 attempts, draft a content-blind ServiceNow escalation. */
export function buildEscalationDraft({ symptomTitle = "Unresolved issue", attempts = [], context = {} } = {}, threshold = 3) {
  const tried = Array.isArray(attempts) ? attempts : [];
  if (tried.length < threshold) return null;
  return {
    escalate: true,
    shortDescription: `ARIA Sentinel: ${symptomTitle} unresolved after ${tried.length} safe attempts`,
    category: "endpoint",
    contentBlind: true,
    // Symbolic only — recipe ids + outcomes, never page content or file paths.
    attempts: tried.map((a) => ({ recipeId: a.recipeId || a.id || "unknown", outcome: a.outcome || "no-change" })),
    systemSummary: {
      os: (context.os && context.os.edition) ? "<edition>" : "unknown",
      ramPercentUsed: num(context?.ram?.percentUsed),
      diskPercentFree: num(context?.disk?.percentFree)
    }
  };
}

/**
 * One reasoning turn. Returns the ranked top-3 causes for the best symptom match, any incidental
 * anomalies, and whether the recommended next action may auto-run or must be confirmed.
 */
export function diagnose(input, kb, context = {}) {
  const matches = fuzzyMatchSymptoms(input, kb, 3);
  const top = matches[0];
  const ranked = top ? rankCauses(top.record.causes, context) : [];
  const relatedSubsystems = top ? subsystemsFor(top.id) : [];
  return {
    matches,
    topSymptom: top ? top.title : null,
    causes: ranked.slice(0, 3),
    anomalies: surfaceAnomalies(context, { relatedSubsystems }),
    needsMoreInfo: matches.length === 0
  };
}

function subsystemsFor(id) {
  const map = {
    "no-internet": ["network"],
    "bluetooth-wifi": ["network", "bluetooth"],
    "display-issues": ["display", "gpu"],
    "audio-issues": ["audio"],
    "slow-performance": ["cpu", "memory", "disk"],
    "printer-issues": ["printer", "spooler"]
  };
  return map[id] || [];
}
