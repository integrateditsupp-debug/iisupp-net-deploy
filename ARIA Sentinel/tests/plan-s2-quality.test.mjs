// STAGE 3 S2 — the QUALITY behaviours at the plan layer, the ones Ahmad actually asked for:
// "resolve it so it does not come back", and "do not do more damage than the problem".
//   · a restore point is taken before a system-touching plan — or the plan says journal-only, honestly
//   · the plan STOPS the moment the user's problem is gone (no reboot-requiring hammer after a fix worked)
//   · a returning issue climbs the fix ladder instead of repeating the fix that did not hold
//   · an exhausted ladder goes straight to a human
//   · the goalProbe still declares success — never step completion, never a no-op
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";
import { emptyLedger, recordResolution, issueSignature } from "../src/main/durability-ledger.mjs";
import { getPlaybook } from "../src/main/resolution-playbooks.mjs";
import { verifyChain } from "../src/shared/plan-journal.mjs";

const H = 3600000;
const NOW = 10_000 * H;
const approve = () => ({ verdict: "approve", reason: "test", supervisorEvidence: {} });
const ctx = (extra = {}) => ({
  mode: "confirmed", dryRunCheckbox: false,
  confirmPlan: async () => true, countdownGate: async () => true, supervise: approve,
  now: () => NOW, ...extra
});

// --- 1: STOP-WHEN-GOAL-MET. The print plan's first step drains the queue ⇒ step 2 never runs. -------
const printPlan = getPlaybook("print-recovery");
assert.equal(printPlan.stopWhenGoalMet, true);
assert.equal(printPlan.steps.length, 2, "print recovery is now a real multi-step plan");
assert.equal(printPlan.steps[0].recipeId, "clear-print-queue");

let ran = [];
let res = await executePlan(printPlan, ctx({
  run: async () => ({ stdout: "0", stderr: "", exitCode: 0 }), // queue is drained
  executeStep: async (recipeId) => { ran.push(recipeId); return { recipeId, outcome: "success", events: [] }; }
}));
assert.equal(res.outcome, "resolved");
assert.equal(res.earlyStop, true);
assert.deepEqual(ran, ["clear-print-queue"], "the spooler restart was never needed, so it never ran");
const resolvedEntry = res.journal.find((e) => e.event === "PLAN.RESOLVED");
assert.equal(resolvedEntry.extra.stepsSkipped, 1);
assert.equal(verifyChain(res.journal).ok, true);

// --- 2: the problem is NOT gone after step 1 ⇒ the plan continues to step 2. -----------------------
ran = [];
let stuck = 3;
res = await executePlan(printPlan, ctx({
  run: async () => ({ stdout: String(stuck), stderr: "", exitCode: 0 }),
  executeStep: async (recipeId) => { ran.push(recipeId); if (recipeId === "restart-print-spooler") stuck = 0; return { recipeId, outcome: "success", events: [] }; }
}));
assert.deepEqual(ran, ["clear-print-queue", "restart-print-spooler"]);
assert.equal(res.outcome, "resolved");
assert.notEqual(res.earlyStop, true);

// --- 3: goalProbe still rules. Steps "succeed" but the user's problem remains ⇒ escalate. ----------
res = await executePlan(printPlan, ctx({
  run: async () => ({ stdout: "5", stderr: "", exitCode: 0 }), // 5 jobs still stuck, all the way through
  executeStep: async (recipeId) => ({ recipeId, outcome: "success", events: [] })
}));
assert.equal(res.outcome, "escalated", "step completion is not success — the outcome probe decides");
assert.ok(res.escalationPacket);

// --- 4: NO-OP-NEUTRAL is never a fix, even when the probe is happy. --------------------------------
res = await executePlan(printPlan, ctx({
  run: async () => ({ stdout: "0", stderr: "", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "no-op-neutral", events: [] })
}));
assert.equal(res.outcome, "already-healthy");
assert.notEqual(res.outcome, "resolved");

// --- 5: RESTORE POINT. The network plan touches system state, so it asks for one. ------------------
const netPlan = getPlaybook("network-recovery");
assert.equal(netPlan.riskEnvelope.touchesSystemState, true);
res = await executePlan(netPlan, ctx({
  lastRestorePointAt: NOW - 30 * H,
  run: async (cmd) => (/Measure-Object/i.test(String(cmd)) ? { stdout: "1", exitCode: 0 } : { stdout: "", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "success", events: [] })
}));
assert.equal(res.restorePoint.mode, "restore-point");
assert.ok(res.journal.some((e) => e.extra && e.extra.restorePoint === true), "the restore-point decision is journaled");

// …and when Windows throttles it, the plan says journal-only instead of pretending.
res = await executePlan(netPlan, ctx({
  lastRestorePointAt: NOW - 2 * H,
  run: async (cmd) => (/Measure-Object/i.test(String(cmd)) ? { stdout: "1", exitCode: 0 } : { stdout: "", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "success", events: [] })
}));
assert.equal(res.restorePoint.mode, "journal-only");
assert.equal(res.restorePoint.reason, "throttled-24h");
assert.match(res.restorePoint.note, /journal-only rollback/);

// --- 6: DURABILITY. The same issue returning inside 72h climbs a rung instead of repeating. --------
const issue = { issue: "printer stopped printing again" };
const sig = issueSignature(issue);
const ledger = recordResolution(emptyLedger(), { signature: sig.signature, fixApplied: "clear-print-queue", resolvedAt: NOW - 12 * H, rung: "symptom-recipe" });
res = await executePlan(printPlan, ctx({
  issue, durabilityLedger: ledger,
  run: async () => ({ stdout: "0", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "success", events: [] })
}));
assert.equal(res.durability.recurred, true);
assert.equal(res.durability.rung, "deeper-recipe");
assert.ok(res.journal.some((e) => e.extra && e.extra.durability === true && e.extra.recurred === true));

// …and when the ladder is exhausted, a human gets it immediately — no fourth attempt.
const exhausted = recordResolution(emptyLedger(), { signature: sig.signature, fixApplied: "root-cause-fix", resolvedAt: NOW - 1 * H, rung: "root-cause" });
let stepsRun = 0;
res = await executePlan(printPlan, ctx({
  issue, durabilityLedger: exhausted,
  run: async () => ({ stdout: "0", exitCode: 0 }),
  executeStep: async (recipeId) => { stepsRun++; return { recipeId, outcome: "success", events: [] }; }
}));
assert.equal(res.outcome, "escalated");
assert.equal(stepsRun, 0, "no step is attempted once the ladder is exhausted");
assert.equal(res.journal[res.journal.length - 1].extra.code, "DURABILITY_LADDER_EXHAUSTED");
assert.ok(res.escalationPacket, "the human gets the evidence packet");

// --- 7: a durable resolution is REPORTED, not assumed — the ledger hook receives the real outcome. -
const recorded = [];
res = await executePlan(printPlan, ctx({
  issue, durabilityLedger: emptyLedger(),
  run: async () => ({ stdout: "0", exitCode: 0 }),
  executeStep: async (recipeId) => ({ recipeId, outcome: "success", events: [] }),
  onResolved: (info) => recorded.push(info)
}));
assert.equal(res.outcome, "resolved");
assert.equal(recorded.length, 1);
assert.equal(recorded[0].planId, "print-recovery");
assert.ok(recorded[0].evidence);

console.log("plan-s2-quality test passed (stop when the problem is gone · goalProbe still rules · no-op never a fix · restore point or an honest journal-only note · recurrence climbs a rung · exhausted ladder goes straight to a human).");
