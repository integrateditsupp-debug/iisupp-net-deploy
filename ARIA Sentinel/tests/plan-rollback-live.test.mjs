// STAGE 3 S2 — reverse-order rollback, LIVE, plus the escalation evidence packet that goes with it.
// A multi-step plan that fails at the last step must undo what it did in REVERSE order through the
// tier-0 wrapper (never a raw spawn), keep the hash chain intact across the rollback entries, and hand
// a human a content-blind packet. A kill-switch mid-plan does the same thing, immediately.
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";
import { verifyChain } from "../src/shared/plan-journal.mjs";

const approve = () => ({ verdict: "approve", reason: "test", supervisorEvidence: {} });
const step = (recipeId, onFail = "rollback-plan") => ({ recipeId, risk: "low", expectedImpact: [], onFail });
const plan = () => ({
  id: "triple-recovery",
  title: "Three-step recovery",
  trigger: { kind: "detector-cluster", detail: "test" },
  steps: [step("restart-print-spooler"), step("restart-bluetooth"), step("restart-audio")],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "the spooler is running again (test probe)" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// A runner that records every command and answers service probes with "Running".
function tracker() {
  const calls = [];
  return { calls, run: async (cmd) => { calls.push(String(cmd)); return { stdout: "Running", stderr: "", exitCode: 0 }; } };
}
const baseCtx = (extra = {}) => ({
  mode: "confirmed",
  dryRunCheckbox: false,
  confirmPlan: async () => true,
  countdownGate: async () => true,
  supervise: approve,
  now: () => 1000,
  ...extra
});

// 1 — fail at step 3 ⇒ steps 2 then 1 roll back, in that order, through the wrapper.
let t = tracker();
let res = await executePlan(plan(), baseCtx({
  run: t.run,
  executeStep: async (recipeId) => (recipeId === "restart-audio"
    ? { recipeId, outcome: "fail", events: [] }
    : { recipeId, outcome: "success", events: [] }),
  issue: { issue: "sound and printing both broken" }
}));
assert.equal(res.outcome, "escalated");
const rollbacks = res.journal.filter((e) => e.event === "PLAN.STEP.ROLLBACK");
assert.deepEqual(rollbacks.map((e) => e.stepIndex), [1, 0], "reverse order: step 2 then step 1");
assert.deepEqual(rollbacks.map((e) => e.recipeId), ["restart-bluetooth", "restart-print-spooler"]);
assert.ok(rollbacks.every((e) => e.extra.planRollback === true && e.extra.recovered === true));
assert.ok(t.calls.includes("Start-Service bthserv") && t.calls.includes("Start-Service Spooler"), "rollback ran the real allowlisted service commands");
assert.equal(t.calls.some((c) => /Restart-Service/i.test(c)), false, "rollback never re-runs the remediation");

// 2 — the hash chain survives the rollback entries (tamper-evidence is not suspended on failure).
assert.equal(verifyChain(res.journal).ok, true);
assert.equal(res.journal[res.journal.length - 1].event, "PLAN.ESCALATED");

// 3 — the escalation packet rides along: content-blind, staged, never invents a ticket.
const pkt = res.escalationPacket;
assert.ok(pkt, "an escalation packet is built for a human");
assert.equal(pkt.outcome, "escalated");
assert.equal(pkt.journal.hashChainOk, true);
assert.ok(pkt.stepsAttempted > 0);
assert.equal(pkt.rollback.attempted, true);
assert.equal(pkt.rollback.recovered, 2);
assert.equal(pkt.ticketRef, "", "no ticket is invented — the bridge fills it in only if it files one");
assert.equal(pkt.delivery.sent, false);
assert.equal(pkt.delivery.staged, true);
assert.ok(pkt.signature && pkt.signature.code, "the issue is carried as a symbolic signature, not the user's words");

// 4 — kill-switch mid-plan: abort + reverse rollback of what already ran.
let killed = false;
t = tracker();
res = await executePlan(plan(), baseCtx({
  run: t.run,
  isKilled: () => killed,
  executeStep: async (recipeId) => { killed = true; return { recipeId, outcome: "success", events: [] }; }
}));
assert.equal(res.outcome, "aborted");
const aborted = res.journal[res.journal.length - 1];
assert.equal(aborted.event, "PLAN.ABORTED");
assert.equal(aborted.extra.code, "KILL_SWITCH");
assert.equal(aborted.extra.rolledBack, true);
assert.deepEqual(res.journal.filter((e) => e.event === "PLAN.STEP.ROLLBACK").map((e) => e.stepIndex), [0]);
assert.equal(verifyChain(res.journal).ok, true);

// 5 — escalate-only plans do NOT roll back (the policy is honoured, not overridden).
const p = plan();
p.rollbackPolicy = "escalate-only";
t = tracker();
res = await executePlan(p, baseCtx({
  run: t.run,
  executeStep: async (recipeId) => (recipeId === "restart-audio" ? { recipeId, outcome: "fail", events: [] } : { recipeId, outcome: "success", events: [] })
}));
assert.equal(res.outcome, "escalated");
assert.equal(res.journal.some((e) => e.event === "PLAN.STEP.ROLLBACK"), false);
assert.equal(t.calls.some((c) => /Start-Service/i.test(c)), false);

// 6 — dry-run never rolls back a change it never made, and never claims success.
res = await executePlan(plan(), baseCtx({
  dryRunCheckbox: true,
  run: tracker().run,
  executeStep: async (recipeId) => ({ recipeId, outcome: "dry-run", events: [] })
}));
assert.equal(res.outcome, "dry-run");
assert.equal(res.journal.some((e) => e.event === "PLAN.RESOLVED"), false);

console.log("plan-rollback-live test passed (reverse-order rollback through the wrapper · hash chain intact · kill-switch aborts + rolls back · escalate-only honoured · dry-run claims nothing · escalation packet staged, content-blind, no invented ticket).");
