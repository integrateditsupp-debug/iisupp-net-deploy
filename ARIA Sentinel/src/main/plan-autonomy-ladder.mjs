// STAGE 3 S1 — plan-level earned-autonomy ladder (mirrors the recipe ladder in dry-run-policy).
// A plan may run UNATTENDED only when ALL hold: (a) every step recipe is vetted Tier ≤ 1,
// (b) the plan has ≥ 10 supervised successes (plan-history.json, sibling of recipe-history.json),
// (c) mode = Autonomous, (d) the supervisor approves at plan start AND every step (enforced by the
// executor, not here). S1 ships the PREDICATE only: S1_UNATTENDED_ENABLED is false, so unattended
// execution is structurally impossible until S3 flips it after live review. 🔒 R11 — a blocked plan
// id is never recorded and never earns autonomy. Pure + node-safe.
import { isBlockedPath } from "../shared/path-guard.mjs";
import { vettedTier } from "./dry-run-policy.mjs";

// S1 hard gate — Confirmed mode only. KEPT (Rule 15): it is the historic contract line, and any caller
// that passes `unattendedEnabled: S1_UNATTENDED_ENABLED` still gets S1 behaviour.
export const S1_UNATTENDED_ENABLED = false;
// S3 — the conscious flip. Unattended plan execution now EXISTS, but it is not a free pass: the plan
// must still be EARNED (≥10 supervised successes, every step vetted Tier ≤1, Autonomous mode), the
// supervisor still re-approves EVERY step against live state, the plan-start countdown still runs (an
// unattended plan is never silent), the kill-switch still aborts + rolls back, and the dry-run checkbox
// still wins over everything. Autonomy removes the CLICK — it removes no gate.
export const S3_UNATTENDED_ENABLED = true;
export const PLAN_UNATTENDED_MIN_SUCCESSES = 10;
export const PLAN_UNATTENDED_MAX_STEP_TIER = 1;

export function emptyPlanHistory() { return { plans: {} }; }

/** Record a plan outcome. success → +1 supervised success; veto/abort → −1 (floored). Returns a NEW ledger. */
export function recordPlanOutcome(history, planId, outcome, now = Date.now()) {
  if (isBlockedPath(planId)) return history && history.plans ? history : emptyPlanHistory(); // 🔒 R11
  const base = history && history.plans ? { plans: { ...history.plans } } : emptyPlanHistory();
  const cur = base.plans[planId] || { supervisedSuccesses: 0, runs: [], lastTs: 0 };
  let n = cur.supervisedSuccesses || 0;
  if (outcome === "success") n += 1;
  else if (outcome === "veto" || outcome === "abort") n = Math.max(0, n - 1);
  const runs = [...(cur.runs || []), { ts: now, outcome }].slice(-20);
  base.plans[planId] = { supervisedSuccesses: n, runs, lastTs: now };
  return base;
}

export function planSupervisedSuccesses(history, planId) {
  return (history && history.plans && history.plans[planId] && history.plans[planId].supervisedSuccesses) || 0;
}

/**
 * The unattended predicate. Returns { allowed, reasons[] } — reasons name every failed condition
 * so the plan card can say honestly why a plan still needs a click.
 * @param {{plan:object, planHistory:object, vettedCountOf:(recipeId:string)=>number, mode:string, unattendedEnabled?:boolean}} args
 */
export function canRunUnattended({ plan, planHistory, vettedCountOf, mode, unattendedEnabled = S1_UNATTENDED_ENABLED } = {}) {
  const reasons = [];
  // 🔒 R11 — check #1: a blocked plan can never run at all, let alone unattended.
  let blob = "";
  try { blob = JSON.stringify(plan || {}); } catch { blob = String(plan); }
  if (isBlockedPath(blob)) return { allowed: false, reasons: ["R11: plan references the off-limits private folder"] };

  if (!unattendedEnabled) reasons.push("S1: unattended plan execution is not enabled (Confirmed mode only)");
  if (mode !== "autonomous") reasons.push(`mode is "${mode || "unset"}" — Autonomous mode required`);
  const steps = (plan && Array.isArray(plan.steps)) ? plan.steps : [];
  if (!steps.length) reasons.push("plan has no steps");
  const countOf = typeof vettedCountOf === "function" ? vettedCountOf : () => 0;
  for (const s of steps) {
    const tier = vettedTier(countOf(s && s.recipeId));
    if (tier > PLAN_UNATTENDED_MAX_STEP_TIER) reasons.push(`step "${(s && s.recipeId) || "?"}" is vetted Tier ${tier} (must be ≤ ${PLAN_UNATTENDED_MAX_STEP_TIER})`);
  }
  const successes = planSupervisedSuccesses(planHistory, plan && plan.id);
  if (successes < PLAN_UNATTENDED_MIN_SUCCESSES) reasons.push(`plan has ${successes}/${PLAN_UNATTENDED_MIN_SUCCESSES} supervised successes`);
  return { allowed: reasons.length === 0, reasons };
}

/**
 * S3 entry point: the same predicate, with the stage flag ON by default.
 * Callers that want S1 semantics pass `unattendedEnabled: false` explicitly.
 */
export function canRunUnattendedS3(args = {}) {
  const enabled = args.unattendedEnabled === undefined ? S3_UNATTENDED_ENABLED : args.unattendedEnabled;
  const d = canRunUnattended({ ...args, unattendedEnabled: enabled });
  // Reason strings are what the plan card shows the user, so keep them in S3 language when the flag is on.
  return enabled ? d : { ...d, reasons: d.reasons };
}

/**
 * The honest sentence under the plan card. Never claims autonomy the plan has not earned.
 */
export function autonomyLine(decision, plan, planHistory) {
  if (decision && decision.allowed) {
    return `This plan has earned autonomy — it will run on its own, with the countdown, the live step banner and Stop always on screen.`;
  }
  const n = planSupervisedSuccesses(planHistory, plan && plan.id);
  const reasons = (decision && decision.reasons) || [];
  return `This plan still needs your click (${n}/${PLAN_UNATTENDED_MIN_SUCCESSES} supervised successes). ${reasons[0] || ""}`.trim();
}
