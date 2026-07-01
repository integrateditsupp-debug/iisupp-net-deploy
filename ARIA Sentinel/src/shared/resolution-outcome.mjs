// resolution-outcome — RUN-B B1: the "Was this fixed?" feedback loop turned into the ONE number buyers ask
// for — a real, defensible first-touch-resolution / deflection %. Pure + node-safe (no DOM, no Electron, no
// I/O; the main process owns ~/.aria-sentinel via `store`, this module owns every decision so it is unit-tested).
//
// 🔒 Rule 14 (honesty IS the moat): the deflection metric is REAL-OR-EMPTY — null until a real outcome event
// exists, it moves ONLY on a real *resolved* outcome, and it is NEVER a fabricated or flattering default.
// It reuses the case-study.mjs deflectionRate shape (resolved ÷ conversations) so the RUN-D D2 pilot->paid
// proof consumes the SAME real number instead of just a fix count.
// 🔒 R11: any free-text (session id) is path-scrubbed before it can be persisted.

export const RESOLUTION_SCHEMA = "resolution-outcome.v1";
export const OUTCOME_KINDS = ["resolved", "not-yet"];

// Confidence thresholds on a 0..1 match score. Chosen conservatively — "high" only when the match is strong.
export const CONFIDENCE_HIGH = 0.75;
export const CONFIDENCE_UNCERTAIN = 0.45;

// 🔒 R11 — strip anything path-like out of a free-text field before it is persisted
// (mirrors pilot-state.scrubField; kept local so this module has no deps).
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

// Normalize an outcome to a KNOWN kind or null. It never guesses "resolved" — an unknown value records nothing.
export function normalizeOutcome(kind) {
  const k = String(kind == null ? "" : kind).trim().toLowerCase().replace(/\s+/g, "-");
  if (k === "resolved" || k === "yes" || k === "fixed") return "resolved";
  if (k === "not-yet" || k === "no" || k === "notyet" || k === "unresolved") return "not-yet";
  return null;
}

// Normalize a raw match score (accepts 0..1 or 0..100) into 0..1, or null if it is not a real number.
export function normalizeScore(score) {
  if (!Number.isFinite(score)) return null;
  let s = Number(score);
  if (s < 0) return 0;
  if (s > 1) s = s / 100;   // accept the 0..100 form
  if (s > 1) s = 1;
  return Math.round(s * 1000) / 1000;
}

// Per-answer confidence badge derived from the REAL top match score. Real-or-empty: no score => null
// (we never display a confidence we did not actually measure).
export function confidenceBadge(score) {
  const s = normalizeScore(score);
  if (s == null) return null;
  const level = s >= CONFIDENCE_HIGH ? "high" : s >= CONFIDENCE_UNCERTAIN ? "uncertain" : "low";
  const label = level === "high" ? "High confidence" : level === "uncertain" ? "Uncertain" : "Low confidence";
  return { level, label, score: s };
}

// Build ONE real outcome event. Real-or-empty: an unknown kind => not ok (nothing is recorded).
export function buildOutcomeEvent(input = {}, { now = Date.now() } = {}) {
  const outcome = normalizeOutcome(input.outcome != null ? input.outcome : input.kind);
  if (!outcome) return { ok: false, errors: ["outcome-invalid"], record: null };
  const badge = confidenceBadge(input.matchScore != null ? input.matchScore : input.score);
  return {
    ok: true,
    errors: [],
    record: {
      schema: RESOLUTION_SCHEMA,
      ts: new Date(now).toISOString(),
      outcome,
      resolved: outcome === "resolved",
      session_id: scrubField(input.sessionId != null ? input.sessionId : input.session_id),
      confidence: badge,                 // { level, score } or null
      match_score: badge ? badge.score : null
    }
  };
}

// Append a valid outcome to the event array. Idempotent per session_id (the FIRST real outcome for a given
// answer wins → the metric cannot be gamed by spamming thumbs); events with no session_id are always kept.
// Returns a NEW array (never mutates the input).
export function recordOutcome(events = [], input = {}, opts = {}) {
  const list = Array.isArray(events) ? events.slice() : [];
  const built = buildOutcomeEvent(input, opts);
  if (!built.ok) return { ok: false, errors: built.errors, deduped: false, events: list, record: null };
  const sid = built.record.session_id;
  if (sid && list.some((e) => e && e.session_id === sid)) {
    return { ok: true, deduped: true, events: list, record: list.find((e) => e && e.session_id === sid) };
  }
  list.push(built.record);
  return { ok: true, deduped: false, events: list, record: built.record };
}

// Keep only real, well-formed outcome events. Each surviving event is one "conversation" (one "was this
// fixed?" ask); the resolved ones are the numerator.
export function normalizeEvents(events = []) {
  return (Array.isArray(events) ? events : []).filter((e) => e && normalizeOutcome(e.outcome));
}

// Deflection % = resolved ÷ conversations (clamped 0..100). Reuses the case-study deflectionRate contract.
// Real-or-empty: null until at least one real conversation exists — NEVER a flattering default.
export function deflectionRate(events = []) {
  const evs = normalizeEvents(events);
  if (evs.length === 0) return null;
  const resolved = evs.filter((e) => normalizeOutcome(e.outcome) === "resolved").length;
  const pct = Math.round((resolved / evs.length) * 100);
  return Math.max(0, Math.min(100, pct));
}

// First-touch resolution is the same real number under the name a buyer often uses.
export const firstTouchResolution = deflectionRate;

// Full stats block — every field real-or-empty. `deflectionPct` is null until a real conversation exists;
// `resolved` (the numerator) moves ONLY on a real resolved outcome.
export function deflectionStats(events = []) {
  const evs = normalizeEvents(events);
  const conversations = evs.length;
  const resolved = evs.filter((e) => normalizeOutcome(e.outcome) === "resolved").length;
  return {
    conversations,
    resolved,
    notYet: conversations - resolved,
    deflectionPct: deflectionRate(events),
    sample: conversations               // buyers always ask "out of how many?"
  };
}

// Dashboard tile descriptor — fills the tile RUN-A A1 left as an honest empty-state. `value` is null (not a
// fake %) until there is real data, so the renderer shows "--" exactly like every other real-or-empty tile.
export function deflectionTile(events = []) {
  const st = deflectionStats(events);
  return {
    id: "deflection",
    label: "Deflection (resolved first-touch)",
    value: st.deflectionPct,
    unit: "%",
    sample: st.sample,
    resolved: st.resolved,
    conversations: st.conversations
  };
}

// The metrics shape case-study.mjs / conversionMoment consume — so the pilot->paid proof shows the SAME real
// deflection (resolvedNoEscalation ÷ conversations), not just a fix count. Real-or-empty throughout: with no
// outcomes, conversations/resolvedNoEscalation stay null and case-study.deflectionRate returns null.
export function pilotProofMetrics(events = [], { fixes = null } = {}) {
  const st = deflectionStats(events);
  return {
    fixes: Number.isFinite(fixes) && fixes >= 0 ? fixes : null,
    conversations: st.conversations > 0 ? st.conversations : null,
    resolvedNoEscalation: st.conversations > 0 ? st.resolved : null
  };
}
