// STAGE 3 S3 / BRAIN-AUDIT F7 — SEVERITY-WEIGHTED ESCALATION.
// The old rule was flat: three failed safe attempts before a human is looped in. For a high-impact
// issue (machine unusable, no network at all, data at risk) that is three attempts too many — the
// user sits there while we retry. Severity now sets the threshold, and a critical issue can escalate
// in PARALLEL with the first attempt so the human is already moving.
//
// Rule 14: severity is derived from evidence the caller actually has (impact + scope), never guessed
// upward to look responsive. 🔒 R11 — a blocked issue never produces an escalation payload at all.
import { isBlockedPath } from "./path-guard.mjs";

export const SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);
export const DEFAULT_ATTEMPT_THRESHOLD = 3; // the historic flat rule — still the floor for low severity.

// Attempts allowed BEFORE a human is looped in.
export const SEVERITY_THRESHOLDS = Object.freeze({
  critical: 1,  // escalate immediately (in parallel with the first safe attempt)
  high: 1,
  medium: 2,
  low: 3
});

/** Evidence → severity. Only signals the caller really has; unknown → "medium", never inflated. */
export function classifySeverity({ workBlocking = false, scope = "single-app", dataAtRisk = false, securityImpact = false, recurred = false } = {}) {
  if (dataAtRisk === true || securityImpact === true) return "critical";
  if (workBlocking === true && (scope === "whole-machine" || scope === "network")) return "high";
  if (workBlocking === true) return recurred ? "high" : "medium";
  if (recurred === true) return "medium";
  return "low";
}

export function escalationThreshold(severity, fallback = DEFAULT_ATTEMPT_THRESHOLD) {
  const s = String(severity || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_THRESHOLDS, s) ? SEVERITY_THRESHOLDS[s] : fallback;
}

/**
 * Should a human be looped in now?
 * @returns {{escalate:boolean, threshold:number, severity:string, parallel:boolean, reason:string, line:string}}
 */
export function shouldEscalate({ severity, attempts = 0, recurred = false } = {}) {
  const sev = SEVERITIES.includes(String(severity)) ? String(severity) : "medium";
  const threshold = escalationThreshold(sev);
  const n = Number(attempts) || 0;
  // A recurrence is itself a reason: repeating a fix that did not hold is the F1 bug.
  const escalate = n >= threshold || recurred === true;
  return {
    escalate,
    threshold,
    severity: sev,
    // Critical: the human starts moving WHILE we make our one safe attempt — we do not wait to fail first.
    parallel: sev === "critical",
    reason: recurred === true ? "recurrence" : (escalate ? "attempt-threshold" : "below-threshold"),
    line: escalate
      ? (recurred === true
        ? "This issue came back — looping in a human instead of repeating a fix that did not hold."
        : `Escalating after ${n} safe attempt${n === 1 ? "" : "s"} (${sev} severity).`)
      : `${threshold - n} safe attempt${threshold - n === 1 ? "" : "s"} left before this goes to a human (${sev} severity).`
  };
}

/** Guard: no escalation payload may ever be built for a blocked issue. 🔒 R11 check #1. */
export function escalationAllowed(issue) {
  let blob = "";
  try { blob = JSON.stringify(issue || {}); } catch { blob = String(issue); }
  return !isBlockedPath(blob);
}
