// deployment-policy-schema — the per-customer deployment policy object + its validator.
//
// An MDM (Intune, Workspace ONE, etc.) or the admin console ships one of these per customer. It is
// the object the managed/admin policy lock CONSUMES: it declares whether browser protection is on /
// off / locked, how the malicious-site policy behaves, which end-user overrides are allowed, and where
// escalations route. This module is pure: it defines the shape + validates it. It performs NO I/O,
// enforces nothing, and reads no user content.
//
// Design mirrors the existing shared validators (rdp-access.validateAuthorityConfig,
// customer-config.normalizeCustomerConfig): enum-bounded fields, clear string error codes, and a
// { valid, errors } (plus a normalized policy) return.
import { PROTECTION_MODES, MALICIOUS_SITE_DECISIONS, THREAT_LEVELS } from "./malicious-site-policy.mjs";

export const DEPLOYMENT_POLICY_SCHEMA_VERSION = "deployment-policy-v1";

// End-user override capabilities an admin may grant. "none" = fully locked; the rest are additive.
export const OVERRIDE_RULES = ["none", "allow-warn", "allow-suspicious", "request-exception"];

// Where an escalation is routed. Symbolic destinations only — never a raw email/URL.
export const ESCALATION_ROUTES = ["support-desk", "security-team", "managed-soc", "customer-admin", "none"];

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function asId(value, max = 64) {
  return String(value == null ? "" : value).trim().replace(/[^A-Za-z0-9._-]/g, "").slice(0, max);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate a per-customer deployment policy object.
 * @param {object} obj  candidate policy
 * @returns {{ valid: boolean, errors: string[], policy: object|null }}
 *   `policy` is the normalized, enum-clamped object when valid; null otherwise.
 */
export function validateDeploymentPolicy(obj) {
  const errors = [];

  if (!isPlainObject(obj)) {
    return { valid: false, errors: ["policy-must-be-object"], policy: null };
  }

  // --- customerId (required, opaque id shape) ---
  const customerId = asId(obj.customerId ?? obj.customer_id ?? obj.id);
  if (!customerId) errors.push("customerId-required");
  else if (!ID_RE.test(customerId)) errors.push("customerId-invalid");

  // --- browserProtection (required enum) ---
  const browserProtection = String(obj.browserProtection ?? "").trim().toLowerCase();
  if (!browserProtection) errors.push("browserProtection-required");
  else if (!PROTECTION_MODES.includes(browserProtection)) errors.push("browserProtection-invalid");

  // --- maliciousSitePolicy (required object; per-threat-level decision map) ---
  const msp = obj.maliciousSitePolicy;
  const normalizedDecisions = {};
  if (!isPlainObject(msp)) {
    errors.push("maliciousSitePolicy-required");
  } else {
    const decisions = isPlainObject(msp.decisions) ? msp.decisions : msp;
    for (const [level, decision] of Object.entries(decisions)) {
      if (!THREAT_LEVELS.includes(level)) {
        errors.push(`maliciousSitePolicy-unknown-level:${asId(level, 24) || "?"}`);
        continue;
      }
      const d = String(decision ?? "").trim().toLowerCase();
      if (!MALICIOUS_SITE_DECISIONS.includes(d)) {
        errors.push(`maliciousSitePolicy-invalid-decision:${level}`);
        continue;
      }
      normalizedDecisions[level] = d;
    }
  }

  // --- overrideRules (optional; enum) ---
  let overrideRule = "none";
  if (obj.overrideRules != null) {
    overrideRule = String(obj.overrideRules).trim().toLowerCase();
    if (!OVERRIDE_RULES.includes(overrideRule)) errors.push("overrideRules-invalid");
  }
  // A locked protection mode may not simultaneously grant end-user overrides.
  const locked = browserProtection === "locked-on" || browserProtection === "locked-off";
  if (locked && OVERRIDE_RULES.includes(overrideRule) && overrideRule !== "none") {
    errors.push("locked-protection-cannot-allow-override");
  }

  // --- escalationRouting (optional; enum) ---
  let escalationRouting = "support-desk";
  if (obj.escalationRouting != null) {
    escalationRouting = String(obj.escalationRouting).trim().toLowerCase();
    if (!ESCALATION_ROUTES.includes(escalationRouting)) errors.push("escalationRouting-invalid");
  }

  if (errors.length) return { valid: false, errors, policy: null };

  return {
    valid: true,
    errors: [],
    policy: {
      v: DEPLOYMENT_POLICY_SCHEMA_VERSION,
      customerId,
      browserProtection,
      locked,
      maliciousSitePolicy: { decisions: normalizedDecisions },
      overrideRules: overrideRule,
      escalationRouting
    }
  };
}

// Convenience boolean guard, matching the *Safe() convention of the sibling modules.
export function isDeploymentPolicyValid(obj) {
  return validateDeploymentPolicy(obj).valid;
}

// ── Phase B wiring helpers (still pure — no I/O, no enforcement) ─────────────────────────────

// The safe-default policy an unmanaged install (or a rejected/malformed managed file) runs under:
// protection ON but unlocked, no override grants, default per-threat decisions, support-desk routing.
export function defaultDeploymentPolicy() {
  return {
    v: DEPLOYMENT_POLICY_SCHEMA_VERSION,
    customerId: "unmanaged",
    browserProtection: "on",
    locked: false,
    maliciousSitePolicy: { decisions: {} },
    overrideRules: "none",
    escalationRouting: "support-desk"
  };
}

/**
 * Resolve a candidate policy to something the runtime can ALWAYS use: a valid managed policy when
 * the candidate validates, otherwise the safe defaults plus the validator's error codes. A missing
 * file (`present: false` or a nullish candidate) is unmanaged — defaults with NO errors, because
 * "no policy shipped" is a normal state, not a misconfiguration.
 * @returns {{ policy: object, source: "managed"|"default", errors: string[] }}
 */
export function safeDeploymentPolicy(raw, { present = true } = {}) {
  if (!present || raw == null) return { policy: defaultDeploymentPolicy(), source: "default", errors: [] };
  const res = validateDeploymentPolicy(raw);
  if (res.valid) return { policy: res.policy, source: "managed", errors: [] };
  return { policy: defaultDeploymentPolicy(), source: "default", errors: res.errors };
}

/**
 * Map a (normalized) deployment policy onto the input evaluateMaliciousSite() expects:
 * { mode, decisions, escalationRoute }. Unknown/garbage input falls back to the safe defaults.
 */
export function deploymentPolicyToEvaluator(policy) {
  const p = isPlainObject(policy) ? policy : defaultDeploymentPolicy();
  const mode = PROTECTION_MODES.includes(p.browserProtection) ? p.browserProtection : "on";
  const decisions = isPlainObject(p.maliciousSitePolicy) && isPlainObject(p.maliciousSitePolicy.decisions)
    ? p.maliciousSitePolicy.decisions
    : {};
  return { mode, decisions, escalationRoute: p.escalationRouting || "support-desk" };
}
