// STAGE 3 · Sentinel brain-audit F7 × F1 JOIN — the single escalation DECISION.
// F7 (escalation-severity) weights the escalate threshold by impact: high→1 attempt, medium→2, low→3.
// F1 (durability-ledger) climbs a fix ladder when the SAME issue recurs inside 72h: apply → escalate-rung
// → human-escalation. Until now these two lived apart: escalation-severity had NO consumer, and durability
// recurrence never touched the severity threshold. This module is the pure policy that composes them so the
// (separately, gated) executor wiring has ONE thing to call.
//
// Composition law (Rule 14 — recurrence may only ever escalate SOONER, never later):
//   • durability "human-escalation" (recurred at the terminal rung) → escalate NOW, forced, any attempt count.
//   • durability "escalate-rung"   (recurred within 72h)            → tighten the severity threshold by one
//                                                                      attempt (min 1): loop a human sooner.
//   • durability "apply"           (fresh, or the last fix held)    → fall back to pure F7 (backward-compatible).
// There is NO input under which this returns escalate:false while pure F7 returns escalate:true — a monotonic
// superset of F7. Content-blind / R11: a blocked planId earns no signature, so durability degrades to "apply"
// and the decision is exactly pure F7 — never a crash, never a fabricated suppression. Pure + node-safe.
import { shouldEscalate, severityOf, escalationThreshold } from "./escalation-severity.mjs";
import { nextFixAction } from "./durability-ledger.mjs";

/**
 * The one escalation decision, severity-weighted AND durability-recurrence-aware.
 * @param {{issue?:object, attempts?:Array|number, ledger?:object, planId?:string, now?:number, opts?:object}} a
 * @returns {{escalate:boolean, severity:string, baseThreshold:number, effectiveThreshold:number,
 *            attempts:number, recurrence:{action:string,rung:number,ladder:string,recurred:boolean},
 *            forcedByRecurrence:boolean, reason:string}}
 */
export function escalationDecision({ issue = {}, attempts = [], ledger = null, planId = "", now = Date.now(), opts = {} } = {}) {
  // F7 first — the severity-weighted baseline (also the total fallback when there is no durability history).
  const base = shouldEscalate({ issue, attempts });
  const n = base.attempts;
  const severity = base.severity;
  const baseThreshold = base.threshold;

  // F1 — has this exact issue recurred inside the window? Pure read; blocked/unknown ids → "apply".
  const fix = ledger ? nextFixAction(ledger, planId, now, opts) : { action: "apply", rung: 0, ladder: "symptom-recipe", reason: "no ledger" };
  const recurred = fix.action === "escalate-rung" || fix.action === "human-escalation";

  let effectiveThreshold = baseThreshold;
  let forcedByRecurrence = false;
  let reason;

  if (fix.action === "human-escalation") {
    // The fix ladder is exhausted and the issue is still coming back → a human, now.
    effectiveThreshold = 0;
    forcedByRecurrence = true;
    reason = `durability: recurred at the top of the fix ladder (${fix.ladder}) — human escalation forced regardless of the ${severity} threshold`;
  } else if (fix.action === "escalate-rung") {
    // Last fix did not hold → loop a human one attempt sooner than the flat severity threshold.
    effectiveThreshold = Math.max(1, baseThreshold - 1);
    reason = `durability: recurred within window (next rung ${fix.ladder}) — ${severity} threshold tightened ${baseThreshold}→${effectiveThreshold}; ${n}/${effectiveThreshold} attempts`;
  } else {
    reason = base.reason; // pure F7 — identical to escalation-severity alone.
  }

  const escalate = forcedByRecurrence || n >= effectiveThreshold;
  return {
    escalate, severity, baseThreshold, effectiveThreshold, attempts: n,
    recurrence: { action: fix.action, rung: fix.rung, ladder: fix.ladder, recurred },
    forcedByRecurrence, reason
  };
}

/** Convenience for the executor: just the boolean. */
export function shouldEscalateDurable(args) { return escalationDecision(args).escalate; }

// Re-export the severity threshold helpers so a caller needs only this one module.
export { severityOf, escalationThreshold };
