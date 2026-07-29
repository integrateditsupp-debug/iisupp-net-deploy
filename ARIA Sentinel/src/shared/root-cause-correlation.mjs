// STAGE 3 S3 — SENTINEL-BRAIN-AUDIT F4: cross-subsystem root-cause correlation.
//
// The gap (F4): `surfaceAnomalies` lists incidental per-subsystem errors but nothing correlates
// them. Audio + Bluetooth + Wi-Fi all flapping is usually ONE root cause (power-management /
// driver), yet the brain fixes each symptom separately, so all three return. F4 adds a
// correlation ruleset: when related subsystems co-fail, propose the shared root-cause fix as a
// SINGLE Stage-3 Resolution Plan (trigger.kind = "detector-cluster") instead of N separate fixes.
//
// Contract:
//   • Real-or-empty (Rule 14): no co-failure -> [] . One subsystem -> [] (a singleton is NOT a
//     cluster; it stays a normal per-symptom fix). Unknown subsystems -> [] . Never fabricate a
//     root cause, never invent a fix that isn't a real, named recipe.
//   • R11 is check #1: any off-limits reference in the anomaly labels is dropped content-blind
//     BEFORE any correlation runs.
//   • This module only PROPOSES (rootCause + one sharedFix recipeId + a plan seed). It never
//     executes, never declares success, and never binds an executor — the existing
//     resolution-plan validator + tier-0 executor still gate whether the seed can run.
//   • Pure + node-safe. `sharedFix` recipeIds are recommendations only; an injectable `isBound`
//     lets the caller mark a proposal runnableNow:false when the recipe has no live binding
//     (e.g. F5's still-unbound reset-network-stack) — honest, not a dead action.
import { isBlockedPath, R11_SURFACE } from "./path-guard.mjs";

// Minimum distinct related subsystems that must co-fail before we correlate (a pair, not a single).
export const MIN_CLUSTER = 2;

// Correlation ruleset. Each rule maps a family of related subsystems to ONE shared root cause and
// the single vetted recipe that addresses it. `sharedFix` is a real Tier-0 recipe id (or null when
// the audit says the true fix is still unbound — F5 — in which case we degrade to guidance, never
// a dead action). Ordering: most specific / highest-leverage first.
export const CORRELATION_RULES = Object.freeze([
  Object.freeze({
    rootCause: "power-management-suspending-devices",
    label: "Power management is suspending devices",
    subsystems: Object.freeze(["audio", "bluetooth", "wifi", "usb"]),
    sharedFix: "run-native-troubleshooter",
    explains: "Audio, Bluetooth and Wi-Fi flapping together usually trace to one power/driver cause, not three."
  }),
  Object.freeze({
    rootCause: "network-stack-degraded",
    label: "Network stack is degraded",
    subsystems: Object.freeze(["network", "dns", "adapter", "dhcp"]),
    sharedFix: "flush-dns",
    explains: "DNS + adapter + DHCP failing together is one degraded network stack, not separate faults."
  }),
  Object.freeze({
    rootCause: "storage-pressure",
    label: "Storage pressure is cascading",
    subsystems: Object.freeze(["disk", "search", "update", "temp"]),
    sharedFix: "clear-user-temp",
    explains: "A full disk starves Search indexing, Windows Update and temp writes at once — one cause."
  })
]);

const lc = (s) => String(s == null ? "" : s).toLowerCase().trim();
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * Normalize mixed inputs into a Map of co-failing subsystem names (content-blind, R11-filtered).
 * Accepts: an array of {subsystem,count} (surfaceAnomalies shape), an array of strings, or a
 * context object with eventLog.errorsBySubsystem. `threshold` gates weak signals out.
 */
export function collectFailingSubsystems(input, { threshold = 1 } = {}) {
  const out = new Map();
  const add = (name, count) => {
    const n = lc(name);
    if (!n) return;
    if (isBlockedPath(n)) return; // R11 — never let an off-limits label enter correlation.
    if (num(count) < threshold) return;
    out.set(n, Math.max(out.get(n) || 0, num(count)));
  };
  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item === "object") add(item.subsystem, item.count == null ? threshold : item.count);
      else add(item, threshold);
    }
  } else if (input && typeof input === "object") {
    const map = (input.eventLog && input.eventLog.errorsBySubsystem) || input.errorsBySubsystem || {};
    for (const [sub, count] of Object.entries(map)) add(sub, count);
  }
  return out;
}

/**
 * Correlate co-failing subsystems into shared-root-cause clusters.
 * @returns {Array} — [] when nothing correlates.
 */
export function correlateAnomalies(input, opts = {}) {
  const { threshold = 1, minCluster = MIN_CLUSTER, isBound = null } = opts;
  const failing = collectFailingSubsystems(input, { threshold });
  if (failing.size < minCluster) return []; // real-or-empty: no co-failure, nothing to correlate.

  const clusters = [];
  for (const rule of CORRELATION_RULES) {
    const hits = rule.subsystems.filter((s) => failing.has(s));
    if (hits.length < minCluster) continue; // a lone subsystem is NOT a cluster — leave it per-symptom.
    const severity = hits.reduce((sum, s) => sum + (failing.get(s) || 0), 0);
    const confidence = Math.min(0.95, +(((hits.length / rule.subsystems.length) * 0.7) + (Math.min(hits.length, 4) / 4 * 0.25)).toFixed(3));
    const bound = typeof isBound === "function" ? Boolean(rule.sharedFix && isBound(rule.sharedFix)) : Boolean(rule.sharedFix);
    clusters.push(Object.freeze({
      rootCause: rule.rootCause,
      label: rule.label,
      explains: rule.explains,
      subsystems: hits.slice(),
      severity,
      sharedFix: rule.sharedFix || null,
      runnableNow: bound,
      confidence,
      planTrigger: Object.freeze({ kind: "detector-cluster", rootCause: rule.rootCause, subsystems: hits.slice() })
    }));
  }
  clusters.sort((a, b) => (b.subsystems.length - a.subsystems.length) || (b.severity - a.severity));
  return clusters;
}

/**
 * Turn the single best correlated cluster into a Resolution Plan SEED. Real-or-empty: null when
 * nothing correlates. R11-safe. The seed carries NO goalProbe and NO success claim.
 */
export function toResolutionPlanSeed(input, opts = {}) {
  const clusters = correlateAnomalies(input, opts);
  const top = clusters[0];
  if (!top) return null;
  const seed = {
    id: `correlated-${top.rootCause}`,
    title: `Fix shared root cause: ${top.label}`,
    trigger: top.planTrigger,
    correlatedSubsystems: top.subsystems.slice(),
    confidence: top.confidence,
    candidateSteps: top.sharedFix
      ? [Object.freeze({ recipeId: top.sharedFix, risk: "medium", expectedImpact: top.subsystems.slice(), onFail: "escalate", runnableNow: top.runnableNow })]
      : [],
    guidanceOnly: !top.runnableNow,
    r11Surface: R11_SURFACE
  };
  if (isBlockedPath(JSON.stringify(seed))) return null;
  return Object.freeze(seed);
}
