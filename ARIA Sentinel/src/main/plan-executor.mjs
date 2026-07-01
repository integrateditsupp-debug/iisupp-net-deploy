// STAGE 3 S1 — Resolution Plan executor. Turns "one gated recipe at a time" into multi-step plans,
// reusing the existing safety stack UNCHANGED:
//   supervisor-agent  → per-STEP re-approval against CURRENT (live) state, not plan-time state
//   action-countdown  → plan-start countdown ALWAYS; per-step countdown for medium/high-risk steps
//   tier-0-executor   → THE step executor (pre→exec→post→rollback, 30s timeout, allowlist)
//   dry-run-policy    → the dry-run checkbox still wins over everything
// Every transition lands in the hash-chained plan journal (PLAN.* events; `persist` is the
// crash-safe per-entry hook). Success is declared ONLY by the goalProbe — never step completion —
// and only when at least one step actually changed something (NO-OP-NEUTRAL is never a fix).
// S1 is Confirmed mode only: consent is an injected confirmPlan callback (no silent default-yes)
// and unattended execution is refused outright (see plan-autonomy-ladder S1_UNATTENDED_ENABLED).
// 🔒 R11 is check #1 at the plan layer, re-checked by the supervisor per step, by the tier-0
// executor per command, and redacted at the journal + evidence layers. Kill-switch (Ctrl+Alt+K →
// ctx.isKilled / countdownManager.abortAll) aborts the plan and engages the rollbackPolicy.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { validatePlan } from "../shared/resolution-plan.mjs";
import { appendEntry } from "../shared/plan-journal.mjs";
import { superviseProposal } from "./supervisor-agent.mjs";
import { createCountdown, COUNTDOWN_SECONDS } from "./action-countdown.mjs";
import { executeTier0, resolveExecutorId, validateTier0Command, defaultRun, TIER0_COMMANDS } from "./tier-0-executor.mjs";
import { resolveDryRun } from "./dry-run-policy.mjs";

export const PLAN_OUTCOMES = Object.freeze([
  "resolved", "already-healthy", "escalated", "aborted", "blocked", "invalid", "dry-run"
]);

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

async function safeRun(run, cmd) {
  try { return (await run(cmd)) || { stdout: "", stderr: "", exitCode: 1 }; }
  catch { return { stdout: "", stderr: "run-threw", exitCode: 1 }; }
}

/** Pure probe-output interpretation. */
export function evaluateProbe(spec, output) {
  const text = String(output == null ? "" : output).trim();
  if (!spec) return false;
  if (spec.interpret === "service-running") {
    const last = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || "";
    return last === "Running";
  }
  if (spec.interpret === "count-positive") {
    const m = text.match(/-?\d+/);
    return !!m && Number(m[0]) > 0;
  }
  return false;
}

/**
 * Run a probe spec through R11 + the Tier-0 allowlist, then interpret its output.
 * Evidence output is redacted at the source and capped — content-blind by construction.
 */
export async function runProbe(spec, run) {
  if (!spec || !spec.command) return { pass: false, blocked: false, output: "", reason: "no-probe" };
  if (isBlockedPath(spec.command) || isBlockedPath(spec.description || "")) {
    return { pass: false, blocked: true, output: "", reason: "R11", surfaced: R11_SURFACE };
  }
  if (!validateTier0Command(spec.command)) {
    return { pass: false, blocked: true, output: "", reason: "probe-not-allowlisted" };
  }
  const res = await safeRun(run || defaultRun, spec.command);
  const output = redactPrivate(String(res.stdout || "")).trim().slice(0, 200);
  return { pass: res.exitCode === 0 && evaluateProbe(spec, output), blocked: false, output, reason: "" };
}

// Default countdown gate — real createCountdown, registered with ctx.countdownManager so the
// kill-switch's abortAll() funnels here too. Resolves true (completed) / false (aborted).
function defaultCountdownGate(ctx) {
  return ({ id, seconds }) => new Promise((resolve) => {
    const c = createCountdown({
      recipeId: id,
      seconds: Number.isFinite(seconds) ? seconds : COUNTDOWN_SECONDS,
      setIntervalFn: ctx.setIntervalFn,
      clearIntervalFn: ctx.clearIntervalFn,
      onTick: ctx.onTick,
      onComplete: () => { if (ctx.countdownManager) ctx.countdownManager.remove(c); resolve(true); },
      onAbort: () => { if (ctx.countdownManager) ctx.countdownManager.remove(c); resolve(false); }
    });
    if (ctx.countdownManager) ctx.countdownManager.register(c);
    c.start();
  });
}

/**
 * Execute a Resolution Plan (S1: Confirmed mode only).
 * @param {object} plan  a validated Resolution Plan (validated again here — defense in depth)
 * @param {object} ctx
 *   mode, dryRunCheckbox, confirmPlan (REQUIRED async ({plan,planRunId})=>boolean),
 *   run (PowerShell runner, injectable), now, persist (per-journal-entry crash-safe hook),
 *   logger (audit bridge), liveContext (()=>supervisor context — CURRENT state per step),
 *   history/recentAttempts/vettedCatalog (supervisor inputs when liveContext is not given),
 *   supervise/executeStep (injectable for tests), countdownGate/countdownManager/setIntervalFn,
 *   isKilled (()=>boolean) or killSignal ({aborted}), unattended (S1: refused when true),
 *   planRunId (stable id for resume; defaults to `${plan.id}-run-${now()}`)
 * @returns {Promise<{outcome:string, planRunId:string, journal:Array, evidence?:string, errors?:string[], surfaced?:string}>}
 */
export async function executePlan(plan, ctx = {}) {
  const now = typeof ctx.now === "function" ? ctx.now : () => Date.now();
  const planRunId = String(ctx.planRunId || `${(plan && plan.id) || "plan"}-run-${now()}`);
  let entries = [];
  const journal = (event, fields = {}) => {
    entries = appendEntry(entries, { event, planId: (plan && plan.id) || "", planRunId, ...fields }, now);
    const e = entries[entries.length - 1];
    if (typeof ctx.persist === "function") { try { ctx.persist(e); } catch { /* journaling must never kill the plan */ } }
    if (typeof ctx.logger === "function") { try { ctx.logger(e.event, e.detail, { planId: e.planId, planRunId: e.planRunId, stepIndex: e.stepIndex, recipeId: e.recipeId, ...(e.extra || {}) }); } catch { /* same */ } }
    return e;
  };
  const finish = (outcome, extraFields = {}) => ({ outcome, planRunId, journal: entries, ...extraFields });
  const killed = () => (typeof ctx.isKilled === "function" && !!ctx.isKilled()) || !!(ctx.killSignal && ctx.killSignal.aborted === true);

  // 1 — 🔒 R11: check #1 at the plan layer, before validation, before ANY journal detail can leak.
  if (isBlockedPath(safeStringify(plan))) {
    journal("PLAN.ABORTED", { detail: "R11 blocked — plan references the off-limits private folder", extra: { code: "R11_BLOCKED", surfaced: R11_SURFACE } });
    return finish("blocked", { surfaced: R11_SURFACE });
  }

  // 2 — schema + live-binding validation (defense in depth even for authored playbooks).
  const v = validatePlan(plan, { isBound: (r) => !!resolveExecutorId(r) });
  if (!v.ok) {
    journal("PLAN.ABORTED", { detail: `invalid plan: ${v.errors[0] || v.code}`, extra: { code: "INVALID_PLAN" } });
    return finish("invalid", { errors: v.errors });
  }

  const mode = String(ctx.mode || "confirmed");
  journal("PLAN.PROPOSED", { detail: plan.title, extra: { steps: plan.steps.length, riskEnvelope: plan.riskEnvelope.level, mode } });

  // 3 — S1 hard gate: unattended execution does not exist yet. Refuse, never silently downgrade.
  if (ctx.unattended === true) {
    journal("PLAN.ABORTED", { detail: "S1: unattended plan execution is not enabled — Confirmed mode (one click) required", extra: { code: "UNATTENDED_NOT_ENABLED" } });
    return finish("aborted");
  }

  // 4 — consent. No confirm channel → no consent → no execution (real-or-empty, never default-yes).
  if (typeof ctx.confirmPlan !== "function") {
    journal("PLAN.ABORTED", { detail: "no confirm channel wired — refusing to assume consent", extra: { code: "NO_CONFIRM_CHANNEL" } });
    return finish("aborted");
  }
  if (killed()) { journal("PLAN.ABORTED", { detail: "kill-switch engaged before start", extra: { code: "KILL_SWITCH" } }); return finish("aborted"); }
  let confirmed = false;
  try { confirmed = (await ctx.confirmPlan({ plan, planRunId })) === true; } catch { confirmed = false; }
  if (!confirmed) {
    journal("PLAN.ABORTED", { detail: "user declined the plan", extra: { code: "USER_DECLINED" } });
    return finish("aborted");
  }

  // 5 — plan-start countdown ALWAYS (abort funnel: banner button, Stop, Ctrl+Alt+K via abortAll).
  const gate = typeof ctx.countdownGate === "function" ? ctx.countdownGate : defaultCountdownGate(ctx);
  if (!(await gate({ id: plan.id, phase: "plan-start", seconds: COUNTDOWN_SECONDS }))) {
    journal("PLAN.ABORTED", { detail: "aborted during the plan-start countdown", extra: { code: "COUNTDOWN_ABORT" } });
    return finish("aborted");
  }
  journal("PLAN.APPROVED", { detail: "confirmed + plan-start countdown passed", extra: { mode } });

  // Dry-run resolution: the checkbox always wins; S1 executes in confirmed semantics.
  const dryRun = resolveDryRun({ mode: mode === "autonomous" ? "confirmed" : mode, dryRunCheckbox: ctx.dryRunCheckbox });
  const supervise = typeof ctx.supervise === "function" ? ctx.supervise : superviseProposal;
  const executeStep = typeof ctx.executeStep === "function" ? ctx.executeStep : executeTier0;
  const runFn = ctx.run || defaultRun;
  const liveContext = typeof ctx.liveContext === "function"
    ? ctx.liveContext
    : () => ({ mode, history: ctx.history || [], recentAttempts: ctx.recentAttempts, vettedCatalog: ctx.vettedCatalog, now: now() });
  const completed = []; // { stepIndex, recipeId (canonical), outcome }

  // Reverse-order plan rollback: completed service steps are brought back to Running; a DNS flush
  // has no inverse (the cache repopulates) and is journaled as such. Never throws.
  const rollbackCompleted = async () => {
    if (plan.rollbackPolicy !== "reverse-order" || dryRun) return false;
    let any = false;
    for (const c of [...completed].reverse()) {
      const spec = TIER0_COMMANDS[c.recipeId];
      if (spec && spec.kind === "service" && spec.service) {
        const cmd = `Start-Service ${spec.service}`;
        if (isBlockedPath(cmd) || !validateTier0Command(cmd)) {
          journal("PLAN.STEP.ROLLBACK", { stepIndex: c.stepIndex, recipeId: c.recipeId, detail: "rollback command rejected; manual intervention needed", extra: { recovered: false, planRollback: true } });
          continue;
        }
        await safeRun(runFn, cmd);
        const probe = await safeRun(runFn, spec.probe);
        const running = redactPrivate(String(probe.stdout || "")).trim().split(/\r?\n/).filter(Boolean).pop() === "Running";
        journal("PLAN.STEP.ROLLBACK", { stepIndex: c.stepIndex, recipeId: c.recipeId, detail: running ? `recovered ${spec.service}` : `manual intervention needed for ${spec.service}`, extra: { recovered: running, planRollback: true } });
        any = true;
      } else {
        journal("PLAN.STEP.ROLLBACK", { stepIndex: c.stepIndex, recipeId: c.recipeId, detail: "no rollback applicable (one-way step; e.g. a DNS flush repopulates on its own)", extra: { recovered: false, planRollback: true } });
      }
    }
    return any;
  };
  const abortPlan = async (code, stepIndex, detail) => {
    const rolledBack = await rollbackCompleted();
    journal("PLAN.ABORTED", { stepIndex, detail: detail || `aborted (${code})`, extra: { code, rolledBack } });
    return finish("aborted");
  };

  const events = { PRE: "PLAN.STEP.PRE", EXEC: "PLAN.STEP.EXEC", POST: "PLAN.STEP.POST", ROLLBACK: "PLAN.STEP.ROLLBACK" };
  const runStep = async (step, i, attempt) => {
    const bridge = (event, text, extra = {}) => {
      const mapped = events[String(event).split(".")[1]];
      if (mapped) journal(mapped, { stepIndex: i, recipeId: extra.recipeId || step.recipeId, detail: text, extra: { ...extra, attempt } });
      else journal("PLAN.STEP.PRE", { stepIndex: i, recipeId: step.recipeId, detail: text, extra: { ...extra, security: true, attempt } });
    };
    return executeStep(step.recipeId, { dryRun, run: runFn, logger: bridge, now });
  };

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (killed()) return abortPlan("KILL_SWITCH", i, "kill-switch engaged mid-plan");

    // Per-step supervisor re-approval against CURRENT state (mid-plan drift → veto → rollbackPolicy).
    const verdict = supervise(
      { recipeId: step.recipeId, args: step.args, riskTier: step.risk, expectedImpact: step.expectedImpact, rollbackPlan: plan.rollbackPolicy },
      liveContext()
    );
    if (verdict.verdict === "veto") {
      journal("PLAN.STEP.PRE", { stepIndex: i, recipeId: step.recipeId, detail: `supervisor veto: ${verdict.code} — ${verdict.reason}`, extra: { veto: true, code: verdict.code } });
      const rolledBack = await rollbackCompleted();
      journal("PLAN.ESCALATED", { stepIndex: i, detail: `mid-plan supervisor veto (${verdict.code}) — escalating to IIS`, extra: { code: verdict.code, rolledBack } });
      return finish("escalated");
    }

    // Per-step countdown for medium/high-risk steps; approve-fast + low-risk fast-path inside the plan.
    if (step.risk !== "low" && verdict.verdict !== "approve-fast") {
      if (!(await gate({ id: step.recipeId, phase: "step", stepIndex: i, seconds: COUNTDOWN_SECONDS }))) {
        return abortPlan("COUNTDOWN_ABORT", i, "aborted during a step countdown");
      }
    }
    if (killed()) return abortPlan("KILL_SWITCH", i, "kill-switch engaged mid-plan");

    let result = await runStep(step, i, 0);
    if (result.outcome === "blocked") {
      journal("PLAN.ABORTED", { stepIndex: i, recipeId: step.recipeId, detail: "step blocked by R11/allowlist — hard stop", extra: { code: "STEP_BLOCKED", surfaced: R11_SURFACE } });
      return finish("blocked", { surfaced: R11_SURFACE });
    }
    const failed = (r) => r.outcome === "fail" || r.outcome === "unbound";
    if (failed(result) && step.onFail === "retry-once") result = await runStep(step, i, 1);
    if (failed(result)) {
      if (step.onFail === "rollback-plan") {
        const rolledBack = await rollbackCompleted();
        journal("PLAN.ESCALATED", { stepIndex: i, detail: `step failed — plan rolled back in reverse order, escalating to IIS`, extra: { code: "STEP_FAILED_ROLLED_BACK", rolledBack } });
        return finish("escalated");
      }
      journal("PLAN.ESCALATED", { stepIndex: i, detail: "step failed — escalating to IIS", extra: { code: "STEP_FAILED" } });
      return finish("escalated");
    }
    completed.push({ stepIndex: i, recipeId: result.recipeId, outcome: result.outcome });

    // Optional extra per-step probe (belt over the tier-0 POST probe). Honest: a failed probe is a fail.
    if (step.successProbe && !dryRun) {
      const p = await runProbe(step.successProbe, runFn);
      journal("PLAN.STEP.POST", { stepIndex: i, recipeId: step.recipeId, detail: `successProbe ${p.pass ? "passed" : "failed"}: ${step.successProbe.description}`, extra: { probe: true, pass: p.pass, evidence: p.output } });
      if (!p.pass) {
        if (step.onFail === "rollback-plan") {
          const rolledBack = await rollbackCompleted();
          journal("PLAN.ESCALATED", { stepIndex: i, detail: "successProbe failed — plan rolled back, escalating to IIS", extra: { code: "STEP_PROBE_FAILED", rolledBack } });
        } else {
          journal("PLAN.ESCALATED", { stepIndex: i, detail: "successProbe failed — escalating to IIS", extra: { code: "STEP_PROBE_FAILED" } });
        }
        return finish("escalated");
      }
    }
  }

  if (killed()) return abortPlan("KILL_SWITCH", plan.steps.length, "kill-switch engaged before the goal probe");

  // Dry-run preview never claims success — no live change was made, so no PLAN.RESOLVED, ever.
  if (dryRun) {
    journal("PLAN.ABORTED", { detail: "dry-run preview complete — no live change was made, so no success is claimed", extra: { code: "DRY_RUN" } });
    return finish("dry-run");
  }

  // 6 — the goalProbe declares the outcome. Never step completion. Real-or-empty.
  const probe = await runProbe(plan.goalProbe, runFn);
  if (probe.blocked) {
    journal("PLAN.ABORTED", { detail: `goalProbe blocked (${probe.reason})`, extra: { code: probe.reason === "R11" ? "R11_BLOCKED" : "PROBE_NOT_ALLOWLISTED", surfaced: probe.surfaced } });
    return finish("blocked", { surfaced: probe.surfaced });
  }
  const changedSomething = completed.some((c) => c.outcome === "success");
  if (probe.pass && changedSomething) {
    journal("PLAN.RESOLVED", { detail: `goalProbe passed: ${plan.goalProbe.description}`, extra: { evidence: probe.output, noChange: false } });
    return finish("resolved", { evidence: probe.output });
  }
  if (probe.pass && !changedSomething) {
    // NO-OP-NEUTRAL is never counted as resolved-by-ARIA: the system was already healthy.
    journal("PLAN.RESOLVED", { detail: "goalProbe passed but no step changed anything — already healthy (not counted as an ARIA fix)", extra: { evidence: probe.output, noChange: true } });
    return finish("already-healthy", { evidence: probe.output });
  }
  journal("PLAN.ESCALATED", { detail: `goalProbe failed: ${plan.goalProbe.description} — escalating to IIS`, extra: { code: "GOAL_PROBE_FAILED", evidence: probe.output } });
  return finish("escalated", { evidence: probe.output });
}
