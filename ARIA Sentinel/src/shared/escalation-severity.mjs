// STAGE 3 S3 · Sentinel brain-audit F7 — SEVERITY-WEIGHTED ESCALATION.
// Today escalation is FLAT: buildEscalationDraft waits for 3 failed safe attempts regardless of impact,
// so a whole-machine-down or data-at-risk issue sits through 3 quiet failures before a human is looped in.
// F7 weights the threshold by severity: high-impact → escalate after 1 attempt · medium → 2 · low → 3.
//
// Purely additive: buildEscalationDraft already takes a `threshold` override, so F7 only SUPPLIES a smarter
// threshold — it changes NOTHING in the existing escalation code. Content-blind (Rule 14 / R11): severity is
// classified ONLY from symbolic fields (explicit severity, subsystem, symptom id, BSOD family, signal code) —
// never from page content, file paths, or free text. Unknown → "low" (threshold 3) so nothing regresses.
// Pure + node-safe.
import { isBlockedPath } from "./path-guard.mjs";

export const SEVERITY_THRESHOLDS = Object.freeze({ high: 1, medium: 2, low: 3 });
export const DEFAULT_THRESHOLD = SEVERITY_THRESHOLDS.low; // backward-compatible with the flat-3 behavior.

// Symbolic, content-blind classifiers. Whole-machine-down or data-at-risk = high; a degraded core
// subsystem the user can work around = medium; single-app / cosmetic = low (the default).
const HIGH_SUBSYSTEMS = new Set(["no-internet", "network-down", "boot", "bsod", "security", "malware", "ransomware", "data-loss", "storage-failing"]);
const MEDIUM_SUBSYSTEMS = new Set(["printer-issues", "printer", "spooler", "audio-issues", "audio", "display-issues", "display", "gpu", "bluetooth-wifi", "bluetooth", "update", "network"]);
const HIGH_FAMILIES = new Set(["BSOD", "BOOT", "SECURITY", "DATALOSS"]);

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();

function collectSubsystems(issue) {
  const out = [];
  const push = (v) => { const n = norm(v); if (n) out.push(n); };
  push(issue.subsystem); push(issue.symptomId); push(issue.id);
  if (Array.isArray(issue.subsystems)) issue.subsystems.forEach(push);
  return out;
}

/**
 * Content-blind severity for an issue → "high" | "medium" | "low".
 * Precedence: explicit severity (validated) → BSOD/boot/security family → subsystem class → low default.
 */
export function severityOf(issue = {}) {
  const i = issue && typeof issue === "object" ? issue : {};
  // 🔒 R11 — a blob that names the off-limits folder is never inspected for signal; treat as low, record nothing.
  let blob = ""; try { blob = JSON.stringify(i); } catch { blob = String(i); }
  if (isBlockedPath(blob)) return "low";

  const explicit = norm(i.severity || i.impact);
  if (explicit === "high" || explicit === "critical") return "high";
  if (explicit === "medium" || explicit === "moderate") return "medium";
  if (explicit === "low" || explicit === "minor" || explicit === "cosmetic") return "low";

  if (HIGH_FAMILIES.has(String(i.family || "").toUpperCase())) return "high";
  const code = norm(i.signalCode || i.stopCode || i.code);
  if (/^(bsod|boot|security|ransom|malware|dataloss)/.test(code)) return "high";

  const subs = collectSubsystems(i);
  if (subs.some((s) => HIGH_SUBSYSTEMS.has(s))) return "high";
  if (subs.some((s) => MEDIUM_SUBSYSTEMS.has(s))) return "medium";
  return "low";
}

/** The number of failed safe attempts before escalation, for a given severity. Unknown → the flat default. */
export function escalationThreshold(severity) {
  const s = norm(severity);
  return Object.prototype.hasOwnProperty.call(SEVERITY_THRESHOLDS, s) ? SEVERITY_THRESHOLDS[s] : DEFAULT_THRESHOLD;
}

/** Convenience: the severity-weighted threshold to hand straight to buildEscalationDraft(input, threshold). */
export function escalationThresholdFor(issue = {}) {
  return escalationThreshold(severityOf(issue));
}

/**
 * Pure escalate-now predicate. High-impact issues escalate after 1 failed safe attempt; low after 3.
 * @param {{issue?:object, severity?:string, attempts?:Array}} args
 * @returns {{escalate:boolean, severity:string, threshold:number, attempts:number, reason:string}}
 */
export function shouldEscalate({ issue = {}, severity, attempts = [] } = {}) {
  const sev = severity ? norm(severity) : severityOf(issue);
  const threshold = escalationThreshold(sev);
  const n = Array.isArray(attempts) ? attempts.length : Number(attempts) || 0;
  const escalate = n >= threshold;
  return {
    escalate, severity: sev, threshold, attempts: n,
    reason: escalate
      ? `${n} failed safe attempt${n === 1 ? "" : "s"} ≥ ${sev} threshold (${threshold}) — loop in a human`
      : `${n}/${threshold} failed safe attempts for a ${sev}-severity issue — keep trying safe fixes`
  };
}
