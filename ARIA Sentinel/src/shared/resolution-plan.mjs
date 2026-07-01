// STAGE 3 S1 — Resolution Plan schema. A Plan is a multi-step, end-to-end fix:
//   { id, title, trigger, steps[], goalProbe, riskEnvelope, rollbackPolicy }
//   step = { recipeId, args?, risk, expectedImpact, successProbe?, onFail }
// Success is declared by the goalProbe ("is the user's actual problem gone?"), NEVER by step
// completion — real-or-empty. Steps execute ONLY through the existing tier-0 executor, so in S1
// every step recipeId must resolve to a live Tier-0 binding (`isBound` is injected to keep this
// module pure/shared — main passes resolveExecutorId).
// 🔒 R11 is check #1: an off-limits reference ANYWHERE in the plan invalidates it before any
// other validation runs. Pure + node-safe.
import { isBlockedPath, R11_SURFACE } from "./path-guard.mjs";

export const STEP_ON_FAIL = Object.freeze(["retry-once", "rollback-plan", "escalate"]);
export const RISK_LEVELS = Object.freeze(["low", "medium", "high"]);
export const ROLLBACK_POLICIES = Object.freeze(["reverse-order", "escalate-only"]);
export const PROBE_INTERPRETS = Object.freeze(["service-running", "count-positive"]);
export const TRIGGER_KINDS = Object.freeze(["detector-cluster", "user-request", "vision-intake"]);
const MAX_STEPS = 12;

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

/** Validate a probe spec ({ command, interpret, description }). Returns an error-string array. */
export function validateProbe(probe, path = "goalProbe") {
  const errors = [];
  if (!probe || typeof probe !== "object") return [`${path} is required (real-or-empty: no probe → no success claim)`];
  if (!probe.command || typeof probe.command !== "string") errors.push(`${path}.command must be a non-empty string`);
  if (!PROBE_INTERPRETS.includes(probe.interpret)) errors.push(`${path}.interpret must be one of ${PROBE_INTERPRETS.join("|")}`);
  if (!probe.description || typeof probe.description !== "string") errors.push(`${path}.description must state honestly what the probe proves`);
  return errors;
}

function validateStep(step, i, isBound) {
  const errors = [];
  const p = `steps[${i}]`;
  if (!step || typeof step !== "object") return [`${p} must be an object`];
  if (!step.recipeId || typeof step.recipeId !== "string") errors.push(`${p}.recipeId must be a non-empty string`);
  else if (isBound && !isBound(step.recipeId)) errors.push(`${p}.recipeId "${step.recipeId}" has no live Tier-0 executor binding (S1 runs only bound, vetted recipes)`);
  if (!RISK_LEVELS.includes(step.risk)) errors.push(`${p}.risk must be one of ${RISK_LEVELS.join("|")}`);
  if (!Array.isArray(step.expectedImpact)) errors.push(`${p}.expectedImpact must be an array of touched service names (may be empty)`);
  if (!STEP_ON_FAIL.includes(step.onFail)) errors.push(`${p}.onFail must be one of ${STEP_ON_FAIL.join("|")}`);
  if (step.successProbe != null) errors.push(...validateProbe(step.successProbe, `${p}.successProbe`));
  return errors;
}

/**
 * Validate a Resolution Plan. 🔒 R11 is check #1 and short-circuits everything else.
 * @param {object} plan
 * @param {{isBound?:(recipeId:string)=>boolean}} opts
 * @returns {{ok:boolean, code:string, errors:string[], surfaced?:string}}
 */
export function validatePlan(plan, opts = {}) {
  // 1 — 🔒 R11. Any off-limits reference anywhere in the plan → invalid, before shape checks.
  if (isBlockedPath(safeStringify(plan))) {
    return { ok: false, code: "R11_BLOCKED", surfaced: R11_SURFACE, errors: ["R11: plan references the off-limits private folder"] };
  }
  const errors = [];
  if (!plan || typeof plan !== "object") return { ok: false, code: "INVALID", errors: ["plan must be an object"] };
  if (!plan.id || typeof plan.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(plan.id)) errors.push("id must be a kebab-case string");
  if (!plan.title || typeof plan.title !== "string") errors.push("title must be a non-empty string");
  if (!plan.trigger || typeof plan.trigger !== "object" || !TRIGGER_KINDS.includes(plan.trigger.kind)) {
    errors.push(`trigger.kind must be one of ${TRIGGER_KINDS.join("|")}`);
  }
  const isBound = typeof opts.isBound === "function" ? opts.isBound : null;
  if (!Array.isArray(plan.steps) || plan.steps.length < 1) errors.push("steps must be a non-empty array");
  else if (plan.steps.length > MAX_STEPS) errors.push(`steps must have at most ${MAX_STEPS} entries`);
  else plan.steps.forEach((s, i) => errors.push(...validateStep(s, i, isBound)));
  errors.push(...validateProbe(plan.goalProbe, "goalProbe"));
  if (!plan.riskEnvelope || typeof plan.riskEnvelope !== "object" || !RISK_LEVELS.includes(plan.riskEnvelope.level) || typeof plan.riskEnvelope.touchesSystemState !== "boolean") {
    errors.push("riskEnvelope must be { level: low|medium|high, touchesSystemState: boolean }");
  }
  if (!ROLLBACK_POLICIES.includes(plan.rollbackPolicy)) errors.push(`rollbackPolicy must be one of ${ROLLBACK_POLICIES.join("|")}`);
  return { ok: errors.length === 0, code: errors.length ? "INVALID" : "", errors };
}
