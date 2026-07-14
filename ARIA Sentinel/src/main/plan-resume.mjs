// STAGE 3 S2 — RESUME-AFTER-REBOOT WIRING. S1 shipped the pure decision (plan-journal.resumeDecision);
// this is the boot-time watchdog that USES it, so a plan is never left half-applied:
//   · crash/reboot at a SAFE step boundary (last event = STEP.POST) → offer to RESUME at the next step
//   · crash MID-step, or a TAMPERED chain                            → ROLL BACK + escalate, never resume
//   · terminal / never-approved journals                             → nothing to do
// "It fixed it overnight" is only honest if the un-finishable case is equally honest: we roll back and
// tell the user (+ evidence packet), we never quietly leave the machine in a half-changed state.
//
// Consent survives nothing: a reboot is NOT consent. A resumed run goes back through executePlan with
// the same Confirmed-mode gates (confirmPlan + plan-start countdown) — it simply skips the steps the
// journal PROVES were completed, and keeps the SAME hash-chain (priorEntries) so the audit trail is one
// unbroken chain across the reboot.
// 🔒 R11 is check #1 (a journal path/id that references the off-limits folder is dropped, not read).
// Pure + injectable: `listJournals` / `readJournal` are passed in; no fs in this module.
import { isBlockedPath } from "../shared/path-guard.mjs";
import { fromJsonl, resumeDecision, replayState, verifyChain } from "../shared/plan-journal.mjs";
import { buildEscalationPacket, deliverEscalation } from "./escalation-packet.mjs";
import { TIER0_COMMANDS, resolveExecutorId, validateTier0Command, defaultRun } from "./tier-0-executor.mjs";

export const RESUME_ACTIONS = Object.freeze(["resume", "rollback-escalate", "none"]);

async function safeRun(run, cmd) {
  try { return (await run(cmd)) || { stdout: "", stderr: "", exitCode: 1 }; }
  catch { return { stdout: "", stderr: "run-threw", exitCode: 1 }; }
}

/** Steps the journal PROVES completed, newest first — the reverse-order rollback list. */
export function completedStepsOf(entries) {
  const out = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e && e.event === "PLAN.STEP.POST" && e.extra && e.extra.stepComplete && e.stepIndex != null) {
      out.push({ stepIndex: Number(e.stepIndex), recipeId: resolveExecutorId(e.recipeId) || String(e.recipeId || ""), outcome: String(e.extra.outcome || "") });
    }
  }
  return out.reverse();
}

/**
 * Scan every journal on disk and classify it. Never throws; a corrupt file is reported, not fatal.
 * @param {{listJournals:()=>string[], readJournal:(id:string)=>string}} io
 * @returns {Array<{planRunId:string, planId:string, action:string, reason:string, nextStepIndex?:number, entries:Array}>}
 */
export function scanInterruptedPlans({ listJournals, readJournal } = {}) {
  const ids = typeof listJournals === "function" ? (listJournals() || []) : [];
  const out = [];
  for (const id of ids) {
    if (isBlockedPath(String(id))) continue; // 🔒 R11 — never even read it.
    let entries = [];
    try { entries = fromJsonl(readJournal(id)); } catch { entries = []; }
    if (!entries.length) continue;
    const decision = resumeDecision(entries);
    if (decision.action === "none") continue;
    const state = replayState(entries);
    out.push({
      planRunId: state.planRunId || String(id),
      planId: state.planId || "",
      action: decision.action,
      reason: decision.reason,
      nextStepIndex: decision.nextStepIndex,
      stepIndex: decision.stepIndex,
      chainIntact: verifyChain(entries).ok,
      entries
    });
  }
  return out;
}

/**
 * Roll back a half-applied plan found at boot, in REVERSE completion order, then escalate with the
 * evidence packet. Mirrors the executor's rollback semantics exactly (service steps are brought back to
 * Running; one-way steps such as a DNS flush or a winsock reset are journaled honestly as having no
 * inverse). Never throws, never re-runs a remediation step.
 * @returns {{rolledBack:Array, escalation:object|null, line:string}}
 */
export async function rollbackInterrupted(found, { plan, run, bridge, appendJournal, now = Date.now } = {}) {
  const runner = run || defaultRun;
  const at = typeof now === "function" ? now : () => now;
  const rolledBack = [];
  for (const c of completedStepsOf(found.entries)) {
    const spec = TIER0_COMMANDS[c.recipeId];
    if (spec && spec.kind === "service" && spec.service) {
      const cmd = `Start-Service ${spec.service}`;
      if (isBlockedPath(cmd) || !validateTier0Command(cmd)) {
        rolledBack.push({ ...c, recovered: false, note: "rollback command rejected; manual intervention needed" });
        continue;
      }
      await safeRun(runner, cmd);
      const probe = await safeRun(runner, spec.probe);
      const running = String((probe && probe.stdout) || "").trim().split(/\r?\n/).filter(Boolean).pop() === "Running";
      rolledBack.push({ ...c, recovered: running, note: running ? `recovered ${spec.service}` : `manual intervention needed for ${spec.service}` });
    } else {
      rolledBack.push({ ...c, recovered: false, note: "no rollback applicable (one-way step — e.g. a DNS flush or a winsock reset has no inverse)" });
    }
    if (typeof appendJournal === "function") {
      try { appendJournal({ event: "PLAN.STEP.ROLLBACK", planId: found.planId, planRunId: found.planRunId, stepIndex: c.stepIndex, recipeId: c.recipeId, detail: rolledBack[rolledBack.length - 1].note, extra: { planRollback: true, bootRecovery: true, recovered: rolledBack[rolledBack.length - 1].recovered } }); } catch { /* journaling never blocks recovery */ }
    }
  }

  const built = buildEscalationPacket({
    plan: plan || { id: found.planId, title: found.planId, steps: [], goalProbe: null, rollbackPolicy: "reverse-order" },
    planRunId: found.planRunId, journal: found.entries,
    reason: found.reason === "journal-tampered" ? "interrupted-unsafe" : "interrupted-unsafe",
    now: at()
  });
  const escalation = built.ok ? { ok: true, packet: built.packet, ...(await deliverEscalation({ packet: built.packet, bridge })) } : { ok: false, staged: false, delivered: false, reason: built.reason };
  if (typeof appendJournal === "function") {
    try { appendJournal({ event: "PLAN.ESCALATED", planId: found.planId, planRunId: found.planRunId, detail: "interrupted mid-step by a reboot/crash — rolled back, not resumed; escalated to IIS", extra: { code: "INTERRUPTED_UNSAFE", bootRecovery: true, rolledBack: rolledBack.length } }); } catch { /* same */ }
  }
  return {
    rolledBack,
    escalation,
    line: "A fix was interrupted before it finished, so I undid what I'd already changed and told IIS — your PC is not left half-changed."
  };
}

/**
 * Build the executor context for a SAFE resume: same chain, skip the proven steps, re-ask consent.
 * (The caller passes this into executePlan — the plan still goes through confirmPlan + countdown.)
 */
export function resumeContext(found) {
  return {
    planRunId: found.planRunId,
    priorEntries: found.entries,
    resumeFrom: Number(found.nextStepIndex) || 0,
    resumed: true,
    // The user-facing truth: we are NOT silently continuing — we ask again, then pick up where we left off.
    line: `I was part-way through "${found.planId}" when the PC restarted. I can pick up at step ${(Number(found.nextStepIndex) || 0) + 1} — nothing runs until you say go.`
  };
}

/** Boot entry point: classify everything, roll back what is unsafe, hand back what can be resumed. */
export async function runBootRecovery(io = {}, ctx = {}) {
  const found = scanInterruptedPlans(io);
  const resumable = [];
  const recovered = [];
  for (const f of found) {
    if (f.action === "resume") resumable.push(resumeContext(f));
    else if (f.action === "rollback-escalate") recovered.push(await rollbackInterrupted(f, ctx));
  }
  return {
    scanned: found.length,
    resumable,
    recovered,
    line: found.length === 0
      ? "No interrupted fixes found at startup."
      : `${resumable.length} fix(es) can be picked up where they left off; ${recovered.length} were rolled back because they were interrupted mid-step.`
  };
}
