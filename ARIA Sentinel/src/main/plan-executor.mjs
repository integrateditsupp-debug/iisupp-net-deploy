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
// S2 — resilience + durability (all OPT-IN via ctx: an executor call that injects none of them behaves
// exactly as it did in S1, which is why the S1 batteries stay green untouched).
import { planRestorePoint, createRestorePoint as createRestorePointReal, rollbackPosture } from "./restore-point.mjs";
import { buildEscalationPacket, deliverEscalation } from "./escalation-packet.mjs";
import { issueSignature, decideOnRecurrence, recordResolution } from "../shared/durability-ledger.mjs";
import { recipes as TIER0_CATALOG } from "./recipes/tier-0/catalog.mjs";
// S3 — earned autonomy + maintenance windows. Also OPT-IN via ctx: inject nothing and the executor
// behaves exactly as it did in S1/S2 (which is why every earlier battery stays green, untouched).
import { canRunUnattendedS3, recordPlanOutcome, autonomyLine } from "./plan-autonomy-ladder.mjs";
import { shouldDeferToWindow } from "./maintenance-window.mjs";

/** Does this recipe need a reboot for its full effect? (catalog truth — e.g. reset-network-stack) */
function requiresReboot(recipeId) {
  const id = String(recipeId || "");
  const entry = TIER0_CATALOG[id] || TIER0_CATALOG[String(ALIASES_BACK[id] || "")];
  return !!(entry && entry.requiresReboot);
}
// The catalog uses the recipe-facing ids; the executor canonicalises a couple of them.
const ALIASES_BACK = Object.freeze({ "restart-audio": "restart-audio-service", "flush-dns-cache": "flush-dns" });

export const PLAN_OUTCOMES = Object.freeze([
  "resolved", "already-healthy", "escalated", "aborted", "blocked", "invalid", "dry-run",
  "queued" // S3 — deferred to the user's maintenance window (nothing ran; it is re-proposed at the window)
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
  // S2 (F2) — outcome-level interprets. Real-or-empty: NO number / NO output never passes.
  if (spec.interpret === "count-zero") {
    const m = text.match(/-?\d+/);
    return !!m && Number(m[0]) === 0;
  }
  if (spec.interpret === "boolean-true") {
    const last = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || "";
    return last === "True";
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
  // S3 — PLAN-HISTORY LADDER, live. This is how a plan EARNS autonomy, and it is deliberately hard:
  //   • only a SUPERVISED (clicked), live, goalProbe-verified success counts +1 — an unattended success
  //     never inflates the count that granted the autonomy in the first place, and a dry-run never counts;
  //   • a human stopping the plan (kill-switch / countdown abort) and a mid-plan supervisor veto count −1.
  // Nothing is written here: the NEW ledger is returned and the caller persists it (ctx.persistPlanHistory).
  let unattendedRun = false;
  let dryRunFlag = false;
  const recordHistory = (kind) => {
    if (!kind || !ctx.planHistory) return null;
    const next = recordPlanOutcome(ctx.planHistory, (plan && plan.id) || "", kind, now());
    if (typeof ctx.persistPlanHistory === "function") { try { ctx.persistPlanHistory(next); } catch { /* never kills the plan */ } }
    return next;
  };
  const finish = (outcome, extraFields = {}) => {
    const { __history, ...rest } = extraFields;
    let kind = __history || null;
    if (!kind && outcome === "resolved" && !unattendedRun && !dryRunFlag) kind = "success";
    const planHistory = recordHistory(kind);
    return { outcome, planRunId, journal: entries, ...(planHistory ? { planHistory } : {}), ...rest };
  };
  // F1 — record every terminal outcome against the issue signature. `resolved:true` ONLY on a goalProbe
  // pass with a real change: that is the only thing that can ever start the 24h quiet window that earns
  // the words "durably resolved". Returns the NEW ledger (caller persists; nothing is written here).
  const recordDurability = (sig, resolved, evidence) => {
    if (!sig || !ctx.durabilityLedger) return null;
    const led = recordResolution(ctx.durabilityLedger, { signature: sig, planId: (plan && plan.id) || "", fixApplied: (plan && plan.id) || "", resolved, evidence, now: now() });
    if (typeof ctx.persistDurability === "function") { try { ctx.persistDurability(led); } catch { /* never kills the plan */ } }
    return led;
  };
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

  // 3 — S3 EARNED AUTONOMY. Unattended execution now exists, but it is EARNED, never assumed:
  //   ≥10 supervised successes for THIS plan · every step vetted Tier ≤1 · mode = Autonomous.
  // Autonomy removes the CLICK and nothing else — the plan-start countdown still runs (an unattended plan
  // is never silent), the supervisor still re-approves every step against LIVE state, the kill-switch still
  // aborts + rolls back, the dry-run checkbox still wins, and the durability ladder still refuses a repeat.
  // A plan that has not earned it is REFUSED (with the honest reasons), never silently downgraded to a run.
  let autonomy = null;
  if (ctx.unattended === true) {
    autonomy = canRunUnattendedS3({
      plan,
      planHistory: ctx.planHistory,
      vettedCountOf: typeof ctx.vettedCountOf === "function" ? ctx.vettedCountOf : () => 0,
      mode,
      unattendedEnabled: ctx.unattendedEnabled // undefined → S3 default (enabled); false → S1 semantics
    });
    if (!autonomy.allowed) {
      journal("PLAN.ABORTED", {
        detail: `unattended refused — ${autonomy.reasons[0] || "not earned"}`,
        extra: { code: "UNATTENDED_NOT_ENABLED", reasons: autonomy.reasons }
      });
      return finish("aborted", { autonomy });
    }
    unattendedRun = true;
  }

  // Dry-run resolution: the checkbox always wins; S1 executes in confirmed semantics.
  const dryRun = resolveDryRun({ mode: mode === "autonomous" ? "confirmed" : mode, dryRunCheckbox: ctx.dryRunCheckbox });
  dryRunFlag = dryRun;

  // 3a — MAINTENANCE WINDOW (S3). A disruptive plan that is running UNATTENDED waits for the user's window
  // instead of interrupting them mid-work ("it fixed it overnight" — honestly earned). An attended run, a
  // user-initiated run, a plan that opts out, a dry-run preview, or no configured window → no deferral is
  // invented and the plan proceeds under its normal gates.
  const windowDecision = shouldDeferToWindow({
    plan, window: ctx.maintenanceWindow, unattended: unattendedRun,
    now: now(), dateOf: ctx.dateOf, userInitiated: ctx.userInitiated === true
  });
  if (!dryRun && windowDecision.defer) {
    journal("PLAN.QUEUED", {
      detail: windowDecision.line,
      extra: { code: "MAINTENANCE_WINDOW", nextStart: windowDecision.nextStart, reason: windowDecision.reason }
    });
    return finish("queued", { window: windowDecision, autonomy: autonomy || undefined });
  }

  const supervise = typeof ctx.supervise === "function" ? ctx.supervise : superviseProposal;
  const executeStep = typeof ctx.executeStep === "function" ? ctx.executeStep : executeTier0;
  const runFn = ctx.run || defaultRun;
  const liveContext = typeof ctx.liveContext === "function"
    ? ctx.liveContext
    : () => ({ mode, history: ctx.history || [], recentAttempts: ctx.recentAttempts, vettedCatalog: ctx.vettedCatalog, now: now() });
  const completed = []; // { stepIndex, recipeId (canonical), outcome }
  // S2 — RESUME: continue an interrupted run at a safe step boundary. The journal chain is CONTINUED
  // (priorEntries), never restarted, and already-completed steps stay in `completed` so a later abort
  // still rolls THEM back in reverse order. Consent is re-asked (above): a reboot is not consent.
  for (const e of (Array.isArray(ctx.priorEntries) ? ctx.priorEntries : [])) {
    if (e && e.event === "PLAN.STEP.POST" && e.stepIndex != null && e.extra && e.extra.stepComplete) {
      completed.push({ stepIndex: Number(e.stepIndex), recipeId: resolveExecutorId(e.recipeId) || String(e.recipeId || ""), outcome: String(e.extra.outcome || "prior") });
    }
  }
  const startIndex = Number.isInteger(ctx.resumeFrom) && ctx.resumeFrom > 0 ? Math.min(ctx.resumeFrom, plan.steps.length) : 0;

  // The escalation evidence packet (S2): built at EVERY escalation exit when the caller wires it.
  // Content-blind + tamper-evident; nothing is auto-sent (no bridge → staged for Ahmad's one-click).
  const escalateWithPacket = async ({ reason, durability: dur, signature: sig, probeEvidence, restorePoint } = {}) => {
    if (!ctx.escalationBridge && ctx.wantEscalationPacket !== true) return null;
    const built = buildEscalationPacket({
      plan, planRunId, journal: entries, reason,
      probeEvidence: probeEvidence || "", issue: ctx.issue, signature: sig || undefined,
      durability: dur || undefined, restorePoint: restorePoint || restorePointResult, now: now()
    });
    if (!built.ok) return { ok: false, staged: false, delivered: false, reason: built.reason, line: "Escalation packet withheld — it could not be proven content-blind." };
    const delivery = await deliverEscalation({ packet: built.packet, bridge: ctx.escalationBridge });
    if (typeof ctx.onEscalationPacket === "function") { try { ctx.onEscalationPacket(built.packet, delivery); } catch { /* never kills the plan */ } }
    return { ok: true, packet: built.packet, ...delivery };
  };
  let restorePointResult = null;


  // 3b — 🔁 F1 DURABILITY PRE-FLIGHT. If this exact issue signature was "fixed" inside the recurrence
  // window and we are about to run the SAME fix again, we refuse: repeating a fix that did not hold is
  // the bug Ahmad named ("the issue comes back easily"). We escalate ONE rung instead.
  const signature = ctx.issue || ctx.signature ? (ctx.signature && ctx.signature.hash ? ctx.signature : issueSignature(ctx.issue)) : null;
  let durability = null;
  if (signature && ctx.durabilityLedger) {
    durability = decideOnRecurrence(ctx.durabilityLedger, signature.hash, now());
    if (durability.recurred && String(durability.lastFixPlanId || "") === String(plan.id)) {
      journal("PLAN.ESCALATED", {
        detail: `same issue returned within the durability window — NOT repeating "${plan.id}"; escalating to "${durability.rung}"`,
        extra: { code: "RECURRENCE_LADDER", rung: durability.rung, occurrences: durability.occurrences, recurred: true }
      });
      const esc = await escalateWithPacket({ reason: "recurrence-ladder-exhausted", durability, signature });
      return finish("escalated", { durability, escalation: esc });
    }
  }

  // 3c — RESTORE POINT decision (throttle-aware). Decided BEFORE consent so the plan card can say —
  // honestly, in advance — whether this run is protected by a system restore point or journal-only.
  const restoreDecision = planRestorePoint({
    plan,
    lastRestorePointAt: Number(ctx.lastRestorePointAt || 0),
    systemRestoreEnabled: ctx.systemRestoreEnabled !== false,
    now: now(),
    dryRun: resolveDryRun({ mode: mode === "autonomous" ? "confirmed" : mode, dryRunCheckbox: ctx.dryRunCheckbox })
  });

  // 4 — consent. No confirm channel → no consent → no execution (real-or-empty, never default-yes).
  // S3: an EARNED unattended plan skips the CLICK (that is the whole point of earned autonomy) — it skips
  // NOTHING else. It is announced on the live banner before the countdown, so it is never silent.
  if (killed()) { journal("PLAN.ABORTED", { detail: "kill-switch engaged before start", extra: { code: "KILL_SWITCH" } }); return finish("aborted", { __history: "abort" }); }
  if (unattendedRun) {
    journal("PLAN.STEP.PRE", {
      stepIndex: null,
      detail: autonomyLine(autonomy, plan, ctx.planHistory),
      extra: { unattended: true, autonomyEarned: true, supervisedSuccesses: (ctx.planHistory && ctx.planHistory.plans && ctx.planHistory.plans[plan.id] && ctx.planHistory.plans[plan.id].supervisedSuccesses) || 0, restorePoint: restoreDecision.decision, rollback: rollbackPosture({ plan, restorePoint: null }).line }
    });
    if (typeof ctx.onBanner === "function") {
      try { ctx.onBanner({ plan, planRunId, phase: "plan-start", unattended: true, restorePoint: restoreDecision, rollback: rollbackPosture({ plan, restorePoint: null }) }); } catch { /* the banner must never kill the plan */ }
    }
  } else {
    if (typeof ctx.confirmPlan !== "function") {
      journal("PLAN.ABORTED", { detail: "no confirm channel wired — refusing to assume consent", extra: { code: "NO_CONFIRM_CHANNEL" } });
      return finish("aborted");
    }
    let confirmed = false;
    try {
      confirmed = (await ctx.confirmPlan({
        plan, planRunId,
        restorePoint: restoreDecision,            // "I'll make a restore point" / "journal-only, and here's why"
        rollback: rollbackPosture({ plan, restorePoint: null }),
        durability: durability || undefined,      // "this is the 2nd time — I'll try a deeper fix"
        autonomy: autonomy || undefined,          // "still needs your click — 7/10 supervised successes"
        resumedFrom: startIndex > 0 ? startIndex : undefined
      })) === true;
    } catch { confirmed = false; }
    if (!confirmed) {
      journal("PLAN.ABORTED", { detail: "user declined the plan", extra: { code: "USER_DECLINED" } });
      return finish("aborted");
    }
  }

  // 5 — plan-start countdown ALWAYS (abort funnel: banner button, Stop, Ctrl+Alt+K via abortAll).
  const gate = typeof ctx.countdownGate === "function" ? ctx.countdownGate : defaultCountdownGate(ctx);
  if (!(await gate({ id: plan.id, phase: "plan-start", seconds: COUNTDOWN_SECONDS }))) {
    journal("PLAN.ABORTED", { detail: "aborted during the plan-start countdown", extra: { code: "COUNTDOWN_ABORT" } });
    return finish("aborted", { __history: "abort" });
  }
  journal("PLAN.APPROVED", {
    detail: unattendedRun ? "earned autonomy + plan-start countdown passed (unattended, banner live)" : "confirmed + plan-start countdown passed",
    extra: { mode, unattended: unattendedRun || undefined, resumedFrom: startIndex || undefined }
  });

  // 5b — RESTORE POINT (spec: before step 1, for any plan that touches system state). Throttle-aware:
  // if Windows refuses (1-per-24h) or System Restore is off, we DEGRADE HONESTLY to journal-only
  // rollback and journal exactly that — we never let the user believe they are protected when they
  // are not, and we never abort a plan just because a checkpoint wasn't possible.
  if (restoreDecision.decision === "create") {
    const mk = typeof ctx.createRestorePoint === "function" ? ctx.createRestorePoint : createRestorePointReal;
    restorePointResult = await mk({ planId: plan.id, run: runFn, now: now() });
    journal("PLAN.STEP.PRE", {
      stepIndex: null,
      detail: restorePointResult.created ? "restore point created before step 1" : `no restore point (${restorePointResult.reason}) — journal-only rollback for this run`,
      extra: { restorePoint: true, created: !!restorePointResult.created, degraded: !!restorePointResult.degraded, reason: restorePointResult.reason, rollback: rollbackPosture({ plan, restorePoint: restorePointResult }).line }
    });
  } else if (restoreDecision.decision === "journal-only") {
    journal("PLAN.STEP.PRE", {
      stepIndex: null,
      detail: `no restore point (${restoreDecision.reason}) — journal-only rollback for this run`,
      extra: { restorePoint: true, created: false, degraded: true, reason: restoreDecision.reason, rollback: rollbackPosture({ plan, restorePoint: null }).line }
    });
  }


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
    // A human stopping the plan is a trust signal AGAINST it: −1 on the autonomy ladder.
    return finish("aborted", { __history: (code === "KILL_SWITCH" || code === "COUNTDOWN_ABORT") ? "abort" : undefined });
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

  for (let i = startIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (killed()) return abortPlan("KILL_SWITCH", i, "kill-switch engaged mid-plan");

    // S2 — smallest-effective-hammer early exit: when the plan opts in (stopEarlyOnGoal) and a PREVIOUS
    // step already made a real change, probe the GOAL before escalating to the next (bigger) step and
    // stop if the user's problem is already gone (e.g. the DNS flush fixed it — skip the winsock reset).
    // Same honesty rules as the final probe: live runs only (dry-run never reaches here as resolved),
    // a blocked/failed probe never resolves, and no-change runs can never early-resolve.
    if (i > 0 && plan.stopEarlyOnGoal === true && !dryRun && completed.some((c) => c.outcome === "success")) {
      const early = await runProbe(plan.goalProbe, runFn);
      if (!early.blocked && early.pass) {
        journal("PLAN.RESOLVED", { detail: `goalProbe passed after step ${i - 1} — remaining ${plan.steps.length - i} step(s) skipped, goal already met: ${plan.goalProbe.description}`, extra: { evidence: early.output, noChange: false, earlyExit: true, stepsSkipped: plan.steps.length - i } });
        return finish("resolved", { evidence: early.output });
      }
    }

    // Per-step supervisor re-approval against CURRENT state (mid-plan drift → veto → rollbackPolicy).
    const verdict = supervise(
      { recipeId: step.recipeId, args: step.args, riskTier: step.risk, expectedImpact: step.expectedImpact, rollbackPlan: plan.rollbackPolicy },
      liveContext()
    );
    if (verdict.verdict === "veto") {
      journal("PLAN.STEP.PRE", { stepIndex: i, recipeId: step.recipeId, detail: `supervisor veto: ${verdict.code} — ${verdict.reason}`, extra: { veto: true, code: verdict.code } });
      const rolledBack = await rollbackCompleted();
      journal("PLAN.ESCALATED", { stepIndex: i, detail: `mid-plan supervisor veto (${verdict.code}) — escalating to IIS`, extra: { code: verdict.code, rolledBack } });
      return finish("escalated", { escalation: await escalateWithPacket({ reason: "supervisor-veto", durability, signature }), durabilityLedger: recordDurability(signature, false, ""), __history: "veto" });
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
        return finish("escalated", { escalation: await escalateWithPacket({ reason: "step-failed", durability, signature }), durabilityLedger: recordDurability(signature, false, "") });
      }
      journal("PLAN.ESCALATED", { stepIndex: i, detail: "step failed — escalating to IIS", extra: { code: "STEP_FAILED" } });
      return finish("escalated", { escalation: await escalateWithPacket({ reason: "step-failed", durability, signature }), durabilityLedger: recordDurability(signature, false, "") });
    }
    completed.push({ stepIndex: i, recipeId: result.recipeId, outcome: result.outcome });
    // Explicit step-outcome boundary: this is the entry the boot watchdog resumes FROM (last event =
    // STEP.POST = safe boundary) and it carries the honest outcome (success | no-op-neutral | dry-run).
    journal("PLAN.STEP.POST", {
      stepIndex: i, recipeId: result.recipeId,
      detail: `step outcome: ${result.outcome}`,
      extra: { outcome: result.outcome, stepComplete: true, rebootRequired: requiresReboot(result.recipeId) }
    });

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
        return finish("escalated", { escalation: await escalateWithPacket({ reason: "step-failed", durability, signature, probeEvidence: p.output }), durabilityLedger: recordDurability(signature, false, p.output) });
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
    const led = recordDurability(signature, true, probe.output);
    // Honest: a goalProbe pass = "resolved (monitoring)". "Durably resolved" is earned by 24h of quiet.
    return finish("resolved", { evidence: probe.output, durabilityLedger: led, durability: durability || undefined, restorePoint: restorePointResult || undefined });
  }
  if (probe.pass && !changedSomething) {
    // NO-OP-NEUTRAL is never counted as resolved-by-ARIA: the system was already healthy.
    journal("PLAN.RESOLVED", { detail: "goalProbe passed but no step changed anything — already healthy (not counted as an ARIA fix)", extra: { evidence: probe.output, noChange: true } });
    return finish("already-healthy", { evidence: probe.output });
  }
  journal("PLAN.ESCALATED", { detail: `goalProbe failed: ${plan.goalProbe.description} — escalating to IIS`, extra: { code: "GOAL_PROBE_FAILED", evidence: probe.output } });
  return finish("escalated", {
    evidence: probe.output,
    escalation: await escalateWithPacket({ reason: "goal-probe-failed", durability, signature, probeEvidence: probe.output }),
    durabilityLedger: recordDurability(signature, false, probe.output)
  });
}
