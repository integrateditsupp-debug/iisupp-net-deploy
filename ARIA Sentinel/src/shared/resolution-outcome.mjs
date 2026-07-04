// "Was this fixed?" outcome ledger. Content-blind and real-or-empty.
export const OUTCOMES = ["resolved", "not_resolved", "escalated"];

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

function cleanId(value) {
  return String(value || "").replace(/[^a-z0-9_.:-]+/gi, "").slice(0, 120);
}

export function recordOutcome(events = [], payload = {}, { now = Date.now() } = {}) {
  const outcome = String(payload.outcome || "").trim();
  const id = cleanId(payload.id || payload.sessionId || payload.issueId);
  const errors = [];
  if (!OUTCOMES.includes(outcome)) errors.push("outcome-invalid");
  if (!id) errors.push("id-required");
  if (errors.length) return { ok: false, errors, events: Array.isArray(events) ? events : [] };
  const list = Array.isArray(events) ? [...events] : [];
  const existing = list.find((e) => e.id === id);
  if (existing) return { ok: true, deduped: true, record: existing, events: list };
  const record = {
    id,
    outcome,
    resolved: outcome === "resolved",
    escalated: outcome === "escalated",
    ts: Number.isFinite(payload.ts) ? payload.ts : now,
    confidence: payload.confidence && typeof payload.confidence === "object"
      ? { level: String(payload.confidence.level || "").slice(0, 40) }
      : null
  };
  list.unshift(record);
  return { ok: true, deduped: false, record, events: list };
}

export function deflectionStats(events = []) {
  const list = Array.isArray(events) ? events : [];
  const conversations = list.length;
  const resolved = list.filter((e) => e && (e.resolved === true || e.outcome === "resolved")).length;
  const escalated = list.filter((e) => e && (e.escalated === true || e.outcome === "escalated")).length;
  const notResolved = list.filter((e) => e && e.outcome === "not_resolved").length;
  return {
    conversations,
    resolved,
    escalated,
    notResolved,
    deflectionPct: pct(resolved, conversations),
    realOrEmpty: conversations > 0
  };
}

export function pilotProofMetrics(events = [], { fixes = 0 } = {}) {
  const stats = deflectionStats(events);
  const realFixes = Math.max(0, Math.floor(Number(fixes) || 0));
  return {
    fixes: realFixes,
    conversations: stats.conversations,
    resolved: stats.resolved,
    deflectionPct: stats.deflectionPct,
    hours_saved: realFixes > 0 ? Math.round(((realFixes * 47) / 60) * 10) / 10 : null,
    hasProof: realFixes > 0 || stats.conversations > 0
  };
}
