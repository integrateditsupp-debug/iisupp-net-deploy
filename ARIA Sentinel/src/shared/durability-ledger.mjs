// STAGE 3 S2 — F1 DURABILITY LEDGER (the headline brain-audit gap: "resolve with QUALITY so the
// issue does not return"). Today a fix is called done the moment a post-probe passes; nothing records
// the issue SIGNATURE, watches for its RETURN, or escalates when it recurs — so the same symptom fix
// re-fires forever and the user sees the problem "come back easily".
//
// This ledger closes that loop:
//   1. Every resolution is hashed to a content-blind issue signature (sanitizeToSignature → symbolic
//      code only; never raw user text) and recorded as { signature, fixApplied, resolvedAt, rung }.
//   2. On RECURRENCE within RECURRENCE_WINDOW_MS (72h) the same fix is NEVER repeated: the plan
//      escalates ONE rung up the fix ladder (symptom-recipe → deeper-recipe → root-cause-investigation
//      → human-escalation).
//   3. "durably resolved" is claimed ONLY after the issue stays gone through a QUIET window (24h).
//      Until then the honest state is "resolved (monitoring)" — Rule 14, no premature victory lap.
//   4. Deflection % counts DURABLE resolutions only (real-or-empty: no data → hasData:false, zeros,
//      never a flattering fallback number). This is the number that feeds RUN-B B1 / Stage-4.
// 🔒 R11 is check #1: a blocked reference is never hashed, never recorded, never counted.
// Pure + node-safe (node:crypto only); persistence (plan-durability.json) is wired in main.
import crypto from "node:crypto";
import { isBlockedPath, redactPrivate } from "./path-guard.mjs";
import { sanitizeToSignature } from "./safety.mjs";

export const LEDGER_VERSION = "durability-ledger-v1";
export const RECURRENCE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h — a return inside this window is a RECURRENCE.
export const QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;      // 24h quiet → and only then "durably resolved".
export const FIX_LADDER = Object.freeze(["symptom-recipe", "deeper-recipe", "root-cause-investigation", "human-escalation"]);
export const DURABILITY_STATES = Object.freeze(["monitoring", "durably-resolved", "recurred"]);

export function emptyDurabilityLedger() {
  return { v: LEDGER_VERSION, issues: {} };
}

/** Content-blind signature for an issue: symbolic code + family only, hashed. Null when R11-blocked. */
export function issueSignature(input) {
  let blob = "";
  try { blob = typeof input === "string" ? input : JSON.stringify(input || {}); } catch { blob = String(input); }
  if (isBlockedPath(blob)) return null; // 🔒 R11 — check #1.
  const sig = sanitizeToSignature(input || {});
  const code = String(sig.code || "UNKNOWN.SIGNAL");
  const family = String(sig.family || "UNKNOWN");
  const hash = crypto.createHash("sha256").update(`${code}|${family}`).digest("hex").slice(0, 32);
  return { hash, code, family, confidence: Number(sig.confidence) || 0 };
}

/** Next rung up the fix ladder (never past the last rung: human escalation is terminal). */
export function nextRung(rung) {
  const i = FIX_LADDER.indexOf(String(rung || FIX_LADDER[0]));
  if (i < 0) return FIX_LADDER[0];
  return FIX_LADDER[Math.min(i + 1, FIX_LADDER.length - 1)];
}

function issueOf(ledger, hash) {
  return (ledger && ledger.issues && ledger.issues[hash]) || null;
}

/**
 * What to do when this issue shows up AGAIN. The whole point of F1: never re-fire the same fix.
 * @returns {{recurred:boolean, occurrences:number, rung:string, escalateToHuman:boolean, sinceMs:number|null, reason:string}}
 */
export function decideOnRecurrence(ledger, sigHash, now = Date.now()) {
  const rec = issueOf(ledger, sigHash);
  if (!rec || !rec.lastResolvedAt) {
    return { recurred: false, occurrences: 0, rung: FIX_LADDER[0], escalateToHuman: false, sinceMs: null, lastFixPlanId: "", reason: "first-sighting" };
  }
  const sinceMs = Math.max(0, Number(now) - Number(rec.lastResolvedAt));
  if (sinceMs > RECURRENCE_WINDOW_MS) {
    // Outside the window: the fix HELD for longer than the recurrence horizon → treat as fresh, bottom rung.
    return { recurred: false, occurrences: rec.occurrences || 0, rung: FIX_LADDER[0], escalateToHuman: false, sinceMs, lastFixPlanId: String(rec.planId || ""), reason: "outside-recurrence-window" };
  }
  const rung = nextRung(rec.rung);
  return {
    recurred: true,
    occurrences: (rec.occurrences || 0) + 1,
    rung,
    escalateToHuman: rung === "human-escalation",
    sinceMs,
    lastFixPlanId: String(rec.planId || ""),
    reason: `recurred ${Math.round(sinceMs / 3600000)}h after the last fix — same fix will NOT be repeated; escalating to "${rung}"`
  };
}

/**
 * Record a resolution attempt. `resolved` MUST come from a goalProbe pass (never step completion).
 * A recurrence inside the window bumps the rung and clears any earlier "durably resolved" claim.
 * Returns a NEW ledger (append-only in spirit; callers persist).
 */
export function recordResolution(ledger, { signature, planId, fixApplied, resolved, evidence, now = Date.now() } = {}) {
  const base = ledger && ledger.issues ? { v: LEDGER_VERSION, issues: { ...ledger.issues } } : emptyDurabilityLedger();
  const hash = signature && signature.hash ? String(signature.hash) : "";
  if (!hash) return base;
  if (isBlockedPath(JSON.stringify({ planId, fixApplied, evidence }))) return base; // 🔒 R11 — never record.
  const prev = issueOf(base, hash);
  const decision = decideOnRecurrence(base, hash, now);
  const rung = prev ? (decision.recurred ? decision.rung : FIX_LADDER[0]) : FIX_LADDER[0];
  base.issues[hash] = {
    hash,
    code: String((signature && signature.code) || "UNKNOWN.SIGNAL"),
    family: String((signature && signature.family) || "UNKNOWN"),
    planId: redactPrivate(String(planId || "")),
    fixApplied: redactPrivate(String(fixApplied || "")),
    rung,
    occurrences: prev ? (prev.occurrences || 1) + 1 : 1,
    attempts: (prev ? (prev.attempts || 0) : 0) + 1,
    resolved: resolved === true,
    lastResolvedAt: resolved === true ? Number(now) : (prev ? prev.lastResolvedAt || 0 : 0),
    lastSeenAt: Number(now),
    // Evidence is the probe's already-redacted, capped output — content-blind by construction.
    evidence: redactPrivate(String(evidence || "")).slice(0, 200),
    durablyResolvedAt: 0 // never set at fix time — only a quiet window can earn it (see durabilityState).
  };
  return base;
}

/**
 * Honest state of one issue RIGHT NOW. "durably-resolved" is EARNED by silence, never by a probe.
 * @returns {{state:string, quietMs:number, quietRemainingMs:number, line:string}}
 */
export function durabilityState(ledger, sigHash, now = Date.now()) {
  const rec = issueOf(ledger, sigHash);
  if (!rec) return { state: "monitoring", quietMs: 0, quietRemainingMs: QUIET_WINDOW_MS, line: "No resolution recorded for this issue yet." };
  if (!rec.resolved || !rec.lastResolvedAt) {
    return { state: "recurred", quietMs: 0, quietRemainingMs: QUIET_WINDOW_MS, line: "Not resolved — the issue is still open." };
  }
  // A sighting AFTER the last fix means it came back: the quiet window is broken.
  if (Number(rec.lastSeenAt) > Number(rec.lastResolvedAt)) {
    return { state: "recurred", quietMs: 0, quietRemainingMs: QUIET_WINDOW_MS, line: "The issue came back after the last fix — escalating instead of repeating it." };
  }
  const quietMs = Math.max(0, Number(now) - Number(rec.lastResolvedAt));
  if (quietMs >= QUIET_WINDOW_MS) {
    return { state: "durably-resolved", quietMs, quietRemainingMs: 0, line: "Durably resolved — the issue has stayed gone through the monitoring window." };
  }
  const remaining = QUIET_WINDOW_MS - quietMs;
  return {
    state: "monitoring",
    quietMs,
    quietRemainingMs: remaining,
    line: `Resolved — watching for ${Math.max(1, Math.round(remaining / 3600000))}h more before calling it durably fixed.`
  };
}

/**
 * Deflection metric — DURABLE resolutions only, computed from the ledger and nothing else.
 * Real-or-empty: with no recorded attempts this returns hasData:false and zeros. No vanity fallback.
 */
export function deflectionMetrics(ledger, now = Date.now()) {
  const issues = Object.values((ledger && ledger.issues) || {});
  let attempts = 0;
  let durable = 0;
  let monitoring = 0;
  let recurred = 0;
  for (const rec of issues) {
    attempts += Number(rec.attempts) || 0;
    const s = durabilityState(ledger, rec.hash, now).state;
    if (s === "durably-resolved") durable += 1;
    else if (s === "monitoring") monitoring += 1;
    else recurred += 1;
  }
  const hasData = attempts > 0;
  return {
    hasData,
    attempts,
    durableResolutions: durable,
    monitoring,
    recurred,
    // Percent of ATTEMPTS that ended in a durable resolution. Null (not 0%) when there is no data at all.
    deflectionRate: hasData ? Number((durable / attempts).toFixed(4)) : null,
    line: hasData
      ? `${durable} durable resolution${durable === 1 ? "" : "s"} across ${attempts} attempt${attempts === 1 ? "" : "s"} (${monitoring} still in the monitoring window).`
      : "No resolution attempts recorded yet."
  };
}
