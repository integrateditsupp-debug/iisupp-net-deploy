// STAGE 3 S3 / BRAIN-AUDIT F4 — CROSS-SUBSYSTEM ROOT-CAUSE CORRELATION.
// Audio + Bluetooth + Wi-Fi all flapping is usually ONE root cause (power management suspending the
// bus, or a chipset/driver fault) — but the old brain fixed each symptom separately, so all three came
// back. This module correlates co-failing subsystems into a SINGLE root-cause proposal that Stage-3
// runs as ONE Resolution Plan.
//
// Rule 14 the whole way down: a rule fires only on evidence that is actually present; when we have no
// executable fix for a root cause we say "investigate" and hand over an honest guided path — we never
// invent a recipe that does not exist (that is exactly the F5 "dead action" bug). 🔒 R11 first.
import { isBlockedPath } from "./path-guard.mjs";

export const CORRELATION_MIN_ERRORS = 5;      // per-subsystem error floor before it counts as "failing"
export const CORRELATION_MIN_SUBSYSTEMS = 2;  // one subsystem is a symptom, not a correlation

// Each rule: the subsystems that must CO-fail, the shared root cause, and the honest response.
// `planId` is set ONLY where a real, bound playbook exists. Otherwise → investigation, never a fake fix.
export const CORRELATION_RULES = Object.freeze([
  {
    id: "power-management-bus-suspend",
    subsystems: ["audio", "bluetooth", "network"],
    minMatches: 3,
    rootCause: "Power management is suspending the shared bus these devices sit on (USB/PCIe selective suspend), or one chipset driver underneath them is faulting.",
    planId: null, // no bound Tier-0 recipe changes power policy — we do NOT pretend one exists
    investigation: "power-and-driver-review",
    line: "Audio, Bluetooth and Wi-Fi are failing together — that pattern is almost always one cause underneath them, not three. Fixing them one at a time is why they keep coming back."
  },
  {
    id: "wireless-radio-stack",
    subsystems: ["bluetooth", "network"],
    minMatches: 2,
    rootCause: "Bluetooth and Wi-Fi commonly share one radio module — a single radio/driver fault takes both down.",
    planId: null,
    investigation: "wireless-radio-review",
    line: "Bluetooth and Wi-Fi are failing together — they usually share one radio, so this is likely one fault, not two."
  },
  {
    id: "print-subsystem",
    subsystems: ["printer", "spooler"],
    minMatches: 2,
    rootCause: "The print spooler and the printer queue are failing together — a stuck queue takes the spooler down with it.",
    planId: "print-recovery", // REAL, bound playbook (clear queue → restart spooler → outcome probe)
    investigation: null,
    line: "The printer and the spooler are failing together — one Resolution Plan clears the queue and restarts the spooler in the right order."
  },
  {
    id: "resource-exhaustion",
    subsystems: ["cpu", "memory", "disk"],
    minMatches: 2,
    rootCause: "The machine is out of headroom (CPU/RAM/disk together) — every downstream subsystem will look broken until that is addressed.",
    planId: null,
    investigation: "resource-exhaustion-review",
    line: "Several subsystems are struggling at once while the machine is out of headroom — the headroom is the root cause."
  }
]);

/** Subsystems that are actually failing right now, per the live event log. Evidence-only. */
export function failingSubsystems(context, { minErrors = CORRELATION_MIN_ERRORS } = {}) {
  const map = (context && context.eventLog && context.eventLog.errorsBySubsystem) || {};
  return Object.entries(map)
    .filter(([sub, n]) => !isBlockedPath(sub) && Number(n) >= minErrors)   // 🔒 R11
    .map(([sub, n]) => ({ subsystem: String(sub).toLowerCase(), errors: Number(n) }))
    .sort((a, b) => b.errors - a.errors);
}

/**
 * Correlate. Returns null when no rule is supported by the evidence — silence beats a made-up theory.
 * @returns {null | {ruleId, rootCause, subsystems:string[], evidence:Array, planId:string|null,
 *                   investigation:string|null, line:string, confidence:number, proposal:object}}
 */
export function correlateRootCause(context, { minErrors = CORRELATION_MIN_ERRORS } = {}) {
  const failing = failingSubsystems(context, { minErrors });
  if (failing.length < CORRELATION_MIN_SUBSYSTEMS) return null;
  const names = new Set(failing.map((f) => f.subsystem));

  let best = null;
  for (const rule of CORRELATION_RULES) {
    const hit = rule.subsystems.filter((s) => names.has(s));
    if (hit.length < rule.minMatches) continue;
    // Confidence = how completely the rule's pattern is present. Bounded, explainable, not invented.
    const confidence = Number((hit.length / rule.subsystems.length).toFixed(2));
    if (!best || hit.length > best.hit.length || (hit.length === best.hit.length && confidence > best.confidence)) {
      best = { rule, hit, confidence };
    }
  }
  if (!best) return null;
  const evidence = failing.filter((f) => best.hit.includes(f.subsystem));
  return {
    ruleId: best.rule.id,
    rootCause: best.rule.rootCause,
    subsystems: best.hit,
    evidence,
    planId: best.rule.planId,
    investigation: best.rule.investigation,
    line: best.rule.line,
    confidence: best.confidence,
    // What Stage-3 should do about it — ONE plan, or an honest investigation. Never N symptom fixes.
    proposal: best.rule.planId
      ? { kind: "resolution-plan", planId: best.rule.planId, trigger: { kind: "detector-cluster", detail: best.hit.join("+") } }
      : { kind: "investigation", id: best.rule.investigation, reason: "no bound Tier-0 recipe fixes this root cause — we will not run symptom fixes that we know will not hold" }
  };
}

/** Would we be symptom-patching? True when the proposed per-subsystem fixes are downstream of a correlation. */
export function isSymptomPatch(correlation, recipeIds = []) {
  if (!correlation) return false;
  const symptomFixes = new Set(["restart-audio", "restart-audio-service", "restart-bluetooth", "flush-dns", "flush-dns-cache", "reset-network-stack"]);
  return (recipeIds || []).some((r) => symptomFixes.has(String(r))) && correlation.planId == null;
}
