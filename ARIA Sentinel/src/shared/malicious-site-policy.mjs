// malicious-site-policy — GATED policy DECISION layer for suspicious/malicious browser signals.
//
// SCOPE (read before extending):
//   This module owns ONLY the safe decision: given a managed policy object + a content-blind
//   browser signal, return one of { allow, warn, block-recommend, escalate } plus a reason code
//   and whether the managed/admin policy lock refused a user override.
//
//   It deliberately does NOT block, redirect, quarantine, or override anything. There is no OS,
//   registry, hosts-file, proxy, DNS, or browser-policy write anywhere in this file. "block-recommend"
//   means "recommend the user/admin block it" — guidance + escalation only. Live enforcement stays
//   RED/gated behind customer authority + a safe test tenant + RBAC + audit (same posture as
//   rdp-access.mjs, which is policy-only and never opens a session).
//
// Managed/admin lock pattern (mirrors the Browser-protection lock): when the policy is locked
//   (locked-on / locked-off), an end-user override request is REFUSED and the decision carries a
//   `policy_locked` reason. An unlocked policy honours a user override.
//
// Content-blind: inputs are already-symbolic signals (a code token, a severity enum, an origin
//   category enum). No URL/title/email/raw domain/path is read or emitted. The final guard
//   asserts the decision object is content-safe.
import { assertContentSafePayload } from "./safety.mjs";

export const MALICIOUS_SITE_POLICY_VERSION = "malicious-site-policy-v1";

// The only decisions this layer may ever return. Ordered least->most severe.
export const MALICIOUS_SITE_DECISIONS = ["allow", "warn", "block-recommend", "escalate"];

// How the managed policy classifies a signal's threat level. "clean" flows straight to allow.
export const THREAT_LEVELS = ["clean", "suspicious", "malicious", "critical"];

// Protection modes an admin/MDM can set. The two "locked-*" modes refuse end-user override.
export const PROTECTION_MODES = ["on", "off", "locked-on", "locked-off"];

// Default decision each threat level maps to when protection is active. Guidance/escalation only.
const DEFAULT_THREAT_DECISION = {
  clean: "allow",
  suspicious: "warn",
  malicious: "block-recommend",
  critical: "escalate"
};

function asCode(value, max = 80) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, max);
}

function asEnum(value, allowed, fallback) {
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

function severityRank(value) {
  // A coarse, symbolic severity rank so a signal without an explicit threat level can still be
  // triaged. Anything unknown stays low (fail-safe toward guidance, never a silent allow of danger).
  const s = String(value == null ? "" : value).trim().toLowerCase();
  if (["critical", "severe"].includes(s)) return 3;
  if (["danger", "high", "malicious"].includes(s)) return 2;
  if (["warning", "warn", "medium", "suspicious"].includes(s)) return 1;
  return 0; // notice / info / unknown
}

// Derive a threat level from a signal when the caller/classifier did not set one explicitly.
// Purely symbolic: looks at a threatLevel field, then the code shape, then the severity enum.
function deriveThreatLevel(signal = {}) {
  const explicit = asEnum(signal.threatLevel ?? signal.threat_level, THREAT_LEVELS, "");
  if (explicit) return explicit;
  const code = asCode(signal.signal ?? signal.code);
  // An active/confirmed threat (malware running, confirmed phishing) is critical when severe.
  const looksActiveThreat = /(MALWARE|RANSOMWARE)\b/.test(code) || /PHISH\.(CONFIRMED|ACTIVE)/.test(code) || /THREAT\.ACTIVE/.test(code);
  // A "this site is malicious/blocklisted" style code -> recommend a block, not an escalation.
  const looksMalicious = /MALICIOUS|BLOCKLIST|PHISH/.test(code);
  const looksSuspicious = /SUSPICIOUS|UNSAFE|RISKY|BLOCKED/.test(code);
  const rank = severityRank(signal.severity);
  if (rank >= 3) return "critical";                       // explicit critical/severe severity
  if (looksActiveThreat && rank >= 2) return "critical";  // confirmed active threat + high severity
  if (looksMalicious || rank >= 2) return "malicious";    // flagged-malicious code OR high severity
  if (looksSuspicious || rank >= 1) return "suspicious";  // suspicious code OR warning severity
  return "clean";
}

export function normalizeMaliciousSitePolicy(policy = {}) {
  const p = policy && typeof policy === "object" ? policy : {};
  const mode = asEnum(p.mode ?? p.protection ?? p.browserProtection, PROTECTION_MODES, "on");
  // A per-threat-level decision override map, clamped to the allowed decision enum.
  const decisions = {};
  const src = p.decisions && typeof p.decisions === "object" ? p.decisions : {};
  for (const level of THREAT_LEVELS) {
    decisions[level] = asEnum(src[level], MALICIOUS_SITE_DECISIONS, DEFAULT_THREAT_DECISION[level]);
  }
  return {
    v: MALICIOUS_SITE_POLICY_VERSION,
    mode,
    locked: mode === "locked-on" || mode === "locked-off",
    protectionActive: mode === "on" || mode === "locked-on",
    // When protection is off/locked-off, malicious signals still ESCALATE (never silently allowed) --
    // this flag lets an unmanaged/off tenant choose to fully allow, but a locked-off tenant cannot
    // suppress escalation of a critical signal.
    silenceWhenOff: p.silenceWhenOff === true && mode !== "locked-off",
    decisions,
    escalationRoute: asCode(p.escalationRoute ?? p.escalation ?? "SUPPORT.DESK", 60) || "SUPPORT.DESK"
  };
}

/**
 * Decide what to do with a browser signal under a managed policy.
 * Returns a content-blind decision object -- NEVER performs a block or override.
 *
 * @param {object} policy  managed policy object (see normalizeMaliciousSitePolicy)
 * @param {object} signal  content-blind signal { signal/code, severity, threatLevel, originCategory,
 *                         userOverride?: "allow"|"block" } -- userOverride is an end-user request only.
 * @returns {{ decision: string, reason: string, policy_locked: boolean, threatLevel: string,
 *            escalationRoute: string|null, enforced: false }}
 */
export function evaluateMaliciousSite(policy = {}, signal = {}) {
  const p = normalizeMaliciousSitePolicy(policy);
  const threatLevel = deriveThreatLevel(signal || {});
  const wantsOverride = asEnum(signal.userOverride ?? signal.override, ["allow", "block"], "");

  // Baseline decision the managed policy would take for this threat level while protection is active.
  const baseline = p.decisions[threatLevel] || DEFAULT_THREAT_DECISION[threatLevel] || "warn";

  let decision = baseline;
  let reason = `policy.${threatLevel}`;
  let policy_locked = false;

  if (!p.protectionActive) {
    // Protection is off or locked-off. A critical/malicious signal must STILL be surfaced
    // (escalate) -- we never silently allow a dangerous site just because protection is off.
    if (threatLevel === "critical") {
      decision = "escalate";
      reason = "protection-off-critical-still-escalates";
    } else if (threatLevel === "malicious") {
      decision = "warn";
      reason = "protection-off-malicious-downgraded-to-warn";
    } else if (p.silenceWhenOff) {
      decision = "allow";
      reason = "protection-off-silenced";
    } else {
      decision = threatLevel === "clean" ? "allow" : "warn";
      reason = "protection-off";
    }
  }

  // End-user override handling -- the managed/admin lock is the authority here.
  if (wantsOverride) {
    if (p.locked) {
      // Locked policy refuses the override. Decision is unchanged; caller is told why.
      policy_locked = true;
      reason = "policy_locked";
    } else if (wantsOverride === "allow" && threatLevel !== "critical") {
      // Unlocked policy honours an allow override -- but never for a critical signal.
      decision = "allow";
      reason = "user-override-allow";
    } else if (wantsOverride === "allow" && threatLevel === "critical") {
      // Even unlocked, a critical signal cannot be waved through by an end user -- it escalates.
      decision = "escalate";
      reason = "override-refused-critical";
    } else if (wantsOverride === "block") {
      decision = "block-recommend";
      reason = "user-override-block";
    }
  }

  const escalationRoute = decision === "escalate" ? p.escalationRoute : null;

  const result = {
    v: MALICIOUS_SITE_POLICY_VERSION,
    decision: MALICIOUS_SITE_DECISIONS.includes(decision) ? decision : "warn",
    reason,
    policy_locked,
    threatLevel,
    escalationRoute,
    enforced: false // DECISION ONLY -- this layer never blocks or overrides anything for real.
  };

  // Final content-blind guard: the decision object must carry no URL/email/path/card-length run.
  if (!assertContentSafePayload(result)) {
    return {
      v: MALICIOUS_SITE_POLICY_VERSION,
      decision: "escalate",
      reason: "content-unsafe-decision-suppressed",
      policy_locked,
      threatLevel,
      escalationRoute: p.escalationRoute,
      enforced: false
    };
  }
  return result;
}

// Convenience guard mirroring the other shared modules' *Safe() exports.
export function isMaliciousSiteDecisionSafe(result) {
  if (!result || typeof result !== "object") return false;
  if (result.v !== MALICIOUS_SITE_POLICY_VERSION) return false;
  if (!MALICIOUS_SITE_DECISIONS.includes(result.decision)) return false;
  if (result.enforced !== false) return false; // this layer must never claim it enforced anything
  return assertContentSafePayload(result);
}
