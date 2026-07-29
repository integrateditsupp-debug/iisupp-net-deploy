// STAGE 3 S2 — resume-after-reboot, end to end. A reboot-requiring step (reset-network-stack) must:
//   · never report success on this side of the reboot
//   · leave the journal at a CLEAN step boundary carrying rebootPending
//   · arm the resume, then stop
// and at boot the replay must resume at the next step — but only with a live supervisor re-approval,
// an intact hash chain, and a plan that is not stale. Anything else rolls back and escalates.
// "Never half-applied" is enforced here, not hoped for.
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";
import { planResumeState, resumePlan, isRebootPending, pendingJournals, RESUME_STALE_MS } from "../src/main/plan-resume.mjs";
import { verifyChain, appendEntry } from "../src/shared/plan-journal.mjs";

const approve = () => ({ verdict: "approve", reason: "test", supervisorEvidence: {} });
const veto = () => ({ verdict: "veto", code: "COOLDOWN", reason: "too soon", supervisorEvidence: {} });
const NOW = 1_700_000_000_000;
const netPlan = () => ({
  id: "network-recovery-test",
  title: "Network recovery test",
  trigger: { kind: "detector-cluster", detail: "test" },
  steps: [
    { recipeId: "reset-network-stack", risk: "high", expectedImpact: [], onFail: "escalate" },
    { recipeId: "flush-dns", risk: "low", expectedImpact: [], onFail: "escalate" }
  ],
  goalProbe: { command: "(Resolve-DnsName example.com -ErrorAction SilentlyContinue | Measure-Object).Count", interpret: "count-positive", description: "a real name lookup succeeds end to end" },
  riskEnvelope: { level: "high", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// 1 — the reboot-pending predicate.
assert.equal(isRebootPending({ outcome: "reboot-pending" }), true);
assert.equal(isRebootPending({ outcome: "success", requiresReboot: true }), true);
assert.equal(isRebootPending({ outcome: "success" }), false);
assert.equal(isRebootPending(null), false);

// 2 — the executor stops at reboot-pending, journals a clean boundary, and arms the resume.
const armed = [];
const res = await executePlan(netPlan(), {
  mode: "confirmed", dryRunCheckbox: false,
  confirmPlan: async () => true, countdownGate: async () => true, supervise: approve,
  now: () => NOW,
  run: async () => ({ stdout: "Running", stderr: "", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "reboot-pending", requiresReboot: true, events: [] }),
  armResume: async (info) => armed.push(info)
});
assert.equal(res.outcome, "reboot-pending");
assert.notEqual(res.outcome, "resolved");
assert.equal(res.nextStepIndex, 1);
assert.equal(res.resumeAfterReboot, true);
assert.equal(armed.length, 1);
assert.deepEqual(armed[0], { planId: "network-recovery-test", planRunId: res.planRunId, nextStepIndex: 1 });
const last = res.journal[res.journal.length - 1];
assert.equal(last.event, "PLAN.STEP.POST", "the journal ends at a safe step boundary");
assert.equal(last.extra.rebootPending, true);
assert.equal(res.journal.some((e) => e.event === "PLAN.RESOLVED"), false, "nothing is declared fixed before the reboot");
assert.equal(verifyChain(res.journal).ok, true);

// 3 — at boot, the replay says: resume at step 2.
const state = planResumeState(res.journal, { now: NOW + 60_000 });
assert.equal(state.action, "resume");
assert.equal(state.nextStepIndex, 1);
assert.equal(state.rebootPending, true);
assert.equal(state.planId, "network-recovery-test");

// 4 — resuming requires a LIVE supervisor re-approval.
let resumedWith = null;
let out = await resumePlan({ entries: res.journal, now: NOW + 60_000, plan: netPlan(), supervise: approve, liveContext: () => ({ mode: "confirmed" }), onResume: (s) => { resumedWith = s; } });
assert.equal(out.resumed, true);
assert.equal(out.supervised, true);
assert.equal(out.nextStepIndex, 1);
assert.ok(resumedWith);

// 5 — a mid-plan veto against LIVE state ⇒ rollback + escalate, never a silent resume.
let escalated = null;
out = await resumePlan({ entries: res.journal, now: NOW + 60_000, plan: netPlan(), supervise: veto, onRollbackEscalate: (s) => { escalated = s; } });
assert.equal(out.resumed, false);
assert.equal(out.action, "rollback-escalate");
assert.match(out.reason, /supervisor veto/i);
assert.ok(escalated);

// 6 — no supervisor channel ⇒ refuse to resume (an unchecked resume is the half-applied failure mode).
out = await resumePlan({ entries: res.journal, now: NOW + 60_000, plan: netPlan() });
assert.equal(out.resumed, false);
assert.equal(out.reason, "no-supervisor-channel");

// 7 — a TAMPERED journal never resumes.
const tampered = res.journal.map((e, i) => (i === 1 ? { ...e, detail: "rewritten" } : e));
assert.equal(verifyChain(tampered).ok, false);
assert.equal(planResumeState(tampered, { now: NOW }).action, "rollback-escalate");
out = await resumePlan({ entries: tampered, now: NOW, plan: netPlan(), supervise: approve });
assert.equal(out.resumed, false);

// 8 — interrupted MID-step (the machine died during EXEC) ⇒ rollback + escalate, never resume.
const midStep = appendEntry(res.journal, { event: "PLAN.STEP.EXEC", planId: "network-recovery-test", planRunId: res.planRunId, stepIndex: 1, detail: "died here" }, () => NOW);
assert.equal(planResumeState(midStep, { now: NOW }).action, "rollback-escalate");

// 9 — a stale interrupted plan is handed to a human instead of silently resuming days later.
assert.equal(planResumeState(res.journal, { now: NOW + RESUME_STALE_MS + 1000 }).action, "rollback-escalate");
assert.equal(planResumeState(res.journal, { now: NOW + RESUME_STALE_MS + 1000 }).reason, "stale-plan");

// 10 — boot filter: terminal journals are skipped, broken ones are still triaged.
const terminal = appendEntry(res.journal, { event: "PLAN.RESOLVED", planId: "x", planRunId: "x", detail: "done" }, () => NOW);
assert.equal(pendingJournals([{ entries: terminal }]).length, 0);
assert.equal(pendingJournals([{ entries: res.journal }]).length, 1);
assert.equal(pendingJournals([{ entries: tampered }]).length, 1);
assert.equal(pendingJournals([{ entries: [] }]).length, 0);

console.log("plan-resume-wiring test passed (reboot-pending never claims success · clean journal boundary + armed resume · boot resumes only with live supervisor re-approval · tampered/mid-step/stale ⇒ rollback+escalate, never half-applied).");
