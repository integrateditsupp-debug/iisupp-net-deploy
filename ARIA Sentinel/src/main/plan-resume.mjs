// STAGE 3 S2 — resume-after-reboot. The "it fixed itself overnight" moment, earned honestly.
// A step like reset-network-stack only takes effect after a reboot, so the executor stops at that
// step with outcome "reboot-pending" and leaves the journal at a CLEAN STEP BOUNDARY. On the next
// boot the watchdog replays the journal and this module decides, from evidence only:
//   resume            — chain intact + last entry is a safe boundary → continue at the next step
//   rollback-escalate — chain tampered, or we died MID-step → undo what we did and hand to a human
//   none              — nothing pending (terminal, never approved, or empty)
// "Never half-applied" (spec exit criterion 3) is enforced here, not hoped for.
//
// Resuming is NOT a bypass of the safety stack: the caller must re-run the supervisor against LIVE
// state for the next step, and `resumePlan` refuses to hand back a resume without that callback.
// 🔒 R11 at the resume layer too — a blocked plan id never resumes. Pure + node-safe.
import { isBlockedPath, R11_SURFACE } from "../shared/path-guard.mjs";
import { resumeDecision, replayState, verifyChain } from "../shared/plan-journal.mjs";

export const RESUME_STALE_MS = 7 * 24 * 60 * 60 * 1000; // a plan older than a week is not resumed silently
export const REBOOT_PENDING_OUTCOME = "reboot-pending";

/** True when a step result means "applied, but only a reboot can make it real". */
export function isRebootPending(stepResult) {
  return !!stepResult && (stepResult.outcome === REBOOT_PENDING_OUTCOME || stepResult.requiresReboot === true);
}

/**
 * Read a journal and say what should happen at boot.
 * @param {Array} entries  replayed journal entries (hash-chained)
 * @param {{now?:number, bootedAt?:number}} opts
 * @returns {{action:"resume"|"rollback-escalate"|"none", reason:string, nextStepIndex?:number,
 *            planId:string, planRunId:string, rebootPending:boolean, completedSteps:number[], surfaced?:string}}
 */
export function planResumeState(entries, opts = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const state = replayState(list);
  const base = {
    planId: state.planId || "",
    planRunId: state.planRunId || "",
    completedSteps: state.completedSteps || [],
    rebootPending: list.some((e) => e && e.extra && e.extra.rebootPending === true)
  };
  // 🔒 R11 — check #1 at this layer as well.
  if (isBlockedPath(base.planId) || isBlockedPath(base.planRunId)) {
    return { action: "none", reason: "R11-blocked", surfaced: R11_SURFACE, ...base };
  }
  const decision = resumeDecision(list);
  if (decision.action !== "resume") return { action: decision.action, reason: decision.reason, ...base };

  // Age guard: an ancient interrupted plan is escalated for a human look, never silently resumed.
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const lastTs = list.length ? Date.parse(list[list.length - 1].ts || "") : NaN;
  if (Number.isFinite(lastTs) && now - lastTs > RESUME_STALE_MS) {
    return { action: "rollback-escalate", reason: "stale-plan", ...base };
  }
  return { action: "resume", reason: decision.reason, nextStepIndex: decision.nextStepIndex, ...base };
}

/**
 * Boot-time entry point. Injectable everything, so a reboot is testable without a reboot.
 * @param {{entries:Array, now?:number, supervise?:Function, liveContext?:Function, plan?:object,
 *          onResume?:Function, onRollbackEscalate?:Function}} args
 * @returns {Promise<{resumed:boolean, action:string, reason:string, nextStepIndex:number|null, supervised:boolean}>}
 */
export async function resumePlan(args = {}) {
  const state = planResumeState(args.entries, { now: args.now });
  const out = { resumed: false, action: state.action, reason: state.reason, nextStepIndex: state.nextStepIndex == null ? null : state.nextStepIndex, supervised: false, planRunId: state.planRunId };

  if (state.action === "rollback-escalate") {
    if (typeof args.onRollbackEscalate === "function") { try { await args.onRollbackEscalate(state); } catch { /* never throw at boot */ } }
    return out;
  }
  if (state.action !== "resume") return out;

  // A resume without a live supervisor re-approval is exactly the "half-applied, unchecked" failure
  // mode the spec forbids. No supervisor → no resume.
  const plan = args.plan || null;
  const step = plan && Array.isArray(plan.steps) ? plan.steps[state.nextStepIndex] : null;
  if (typeof args.supervise !== "function" || !step) {
    out.action = "rollback-escalate";
    out.reason = typeof args.supervise !== "function" ? "no-supervisor-channel" : "next-step-missing";
    if (typeof args.onRollbackEscalate === "function") { try { await args.onRollbackEscalate({ ...state, reason: out.reason }); } catch { /* same */ } }
    return out;
  }
  const context = typeof args.liveContext === "function" ? args.liveContext() : {};
  const verdict = args.supervise(
    { recipeId: step.recipeId, args: step.args, riskTier: step.risk, expectedImpact: step.expectedImpact, rollbackPlan: plan.rollbackPolicy },
    context
  );
  out.supervised = true;
  if (!verdict || verdict.verdict === "veto") {
    out.action = "rollback-escalate";
    out.reason = `supervisor veto on resume: ${(verdict && verdict.code) || "NO_VERDICT"}`;
    if (typeof args.onRollbackEscalate === "function") { try { await args.onRollbackEscalate({ ...state, reason: out.reason }); } catch { /* same */ } }
    return out;
  }
  if (typeof args.onResume === "function") { try { await args.onResume({ ...state, verdict }); } catch { /* same */ } }
  out.resumed = true;
  return out;
}

/** Cheap boot-time filter: which journals are worth replaying at all (chain intact + not terminal). */
export function pendingJournals(journals = []) {
  return (Array.isArray(journals) ? journals : []).filter((j) => {
    const entries = Array.isArray(j && j.entries) ? j.entries : [];
    if (!entries.length) return false;
    if (!verifyChain(entries).ok) return true; // a broken chain still needs the rollback-escalate path
    return !replayState(entries).terminal;
  });
}
