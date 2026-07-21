// STAGE 3 (ARE) Feeds - PLAN-LEVEL autonomous-resolution rate FROM the hash-chained plan journal.
// Rule 14: real-or-empty and un-inflatable. Journals are built with the REAL appendEntry (real hash chain),
// so every honesty guard is exercised against a genuine journal, not a hand-rolled stub:
//   resolved-fix counts | already-healthy(noChange) excluded | dry-run excluded | pre-exec abort excluded |
//   mid-exec abort = attempted-not-deflected | escalated = attempted-not-deflected | interrupted excluded |
//   a TAMPERED "RESOLVED" can never inflate the rate | empty input => null (never a fabricated %).
import assert from "node:assert/strict";
import { appendEntry } from "../src/shared/plan-journal.mjs";
import {
  classifyPlanRun, planDeflectionRate, planDeflectionStats, planDeflectionTile,
  planProofFeed, autonomousResolutionRate, PLAN_DEFLECTION_SCHEMA
} from "../src/shared/plan-deflection.mjs";

let SEQ = 0;
const clk = () => Date.UTC(2026, 6, 17, 0, 0, SEQ++); // deterministic, monotonic timestamps

function build(events) {
  let j = [];
  for (const f of events) j = appendEntry(j, f, clk);
  return j;
}

// ---- Journal builders (mirror plan-executor's real emission conventions) ----------------------------
const resolvedFix = () => build([
  { event: "PLAN.PROPOSED", planId: "p", detail: "t" },
  { event: "PLAN.APPROVED", detail: "ok" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "flush-dns" },
  { event: "PLAN.STEP.POST", stepIndex: 0, extra: { probe: true, pass: true } },
  { event: "PLAN.RESOLVED", detail: "goalProbe passed", extra: { noChange: false } }
]);
const alreadyHealthy = () => build([
  { event: "PLAN.PROPOSED", planId: "p" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.RESOLVED", detail: "already healthy", extra: { noChange: true } }
]);
const escalated = () => build([
  { event: "PLAN.PROPOSED", planId: "p" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0 },
  { event: "PLAN.ESCALATED", detail: "goalProbe failed", extra: { code: "GOAL_PROBE_FAILED" } }
]);
const abortedMidExec = () => build([
  { event: "PLAN.PROPOSED", planId: "p" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0 },
  { event: "PLAN.STEP.ROLLBACK", stepIndex: 0, extra: { recovered: true } },
  { event: "PLAN.ABORTED", stepIndex: 0, extra: { code: "STEP_BLOCKED", rolledBack: true } }
]);
const abortedPreExec = () => build([
  { event: "PLAN.PROPOSED", planId: "p" },
  { event: "PLAN.ABORTED", detail: "user declined", extra: { code: "USER_DECLINED" } }
]);
const dryRun = () => build([
  { event: "PLAN.PROPOSED", planId: "p" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.ABORTED", detail: "dry-run preview complete", extra: { code: "DRY_RUN" } }
]);
const interrupted = () => build([
  { event: "PLAN.PROPOSED", planId: "p" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0 } // crashed mid-step: no terminal entry
]);

// ---- Real-or-empty: no journals => null, never a fabricated % ----------------------------------------
assert.equal(planDeflectionRate([]), null, "no plans => null (empty-state, not a fake number)");
assert.equal(planDeflectionStats([]).deflectionPct, null);
assert.equal(planDeflectionStats([]).attempted, 0);
assert.equal(planDeflectionTile([]).value, null, "tile shows '--', never a fabricated %");
assert.equal(planProofFeed([]).autonomousResolutionPct, null);
assert.equal(planProofFeed([]).plansAttempted, null, "feed is null (not 0) with no attempts");
assert.equal(planDeflectionStats([]).schema, PLAN_DEFLECTION_SCHEMA);

// ---- Classification is correct + total ---------------------------------------------------------------
assert.equal(classifyPlanRun(resolvedFix()).status, "resolved-fix");
assert.equal(classifyPlanRun(resolvedFix()).deflected, true);
assert.equal(classifyPlanRun(alreadyHealthy()).status, "already-healthy");
assert.equal(classifyPlanRun(alreadyHealthy()).deflected, false, "no-op-neutral is NEVER a fix");
assert.equal(classifyPlanRun(escalated()).status, "escalated");
assert.equal(classifyPlanRun(abortedMidExec()).status, "aborted-executed");
assert.equal(classifyPlanRun(abortedPreExec()).status, "aborted-pre-execution");
assert.equal(classifyPlanRun(dryRun()).status, "dry-run");
assert.equal(classifyPlanRun(interrupted()).status, "interrupted");
assert.equal(classifyPlanRun([]).status, "empty");

// ---- The rate: resolved-fix / live-attempts, honest denominator --------------------------------------
// 2 fixed, 1 escalated, 1 mid-exec abort => 4 attempts, 2 deflected => 50%.
// The already-healthy / dry-run / pre-exec-abort / interrupted plans must NOT change it.
let stats = planDeflectionStats([
  resolvedFix(), resolvedFix(), escalated(), abortedMidExec(),
  alreadyHealthy(), dryRun(), abortedPreExec(), interrupted()
]);
assert.equal(stats.attempted, 4, "denominator = only plans that reached a live attempt");
assert.equal(stats.resolved, 2, "numerator = goalProbe-proven, real-change fixes only");
assert.equal(stats.deflectionPct, 50, "2 of 4 real attempts => 50%");
assert.equal(stats.escalated, 1);
assert.equal(stats.abortedDuringExecution, 1);
assert.equal(stats.alreadyHealthy, 1);
assert.equal(stats.dryRun, 1);
assert.equal(stats.abortedPreExecution, 1);
assert.equal(stats.interrupted, 1);
assert.equal(autonomousResolutionRate([resolvedFix(), escalated()]), 50, "buyer alias = same real number");

// ---- Un-inflatable: a TAMPERED "RESOLVED" cannot count ----------------------------------------------
const forged = resolvedFix();
forged[forged.length - 1] = { ...forged[forged.length - 1], detail: "FORGED - hand-edited after signing" };
assert.equal(classifyPlanRun(forged).status, "untrusted", "broken hash chain => untrusted, not resolved");
// One forged 'resolved' + one honest escalation => 0 trusted fixes of 1 attempt => 0%, never 50/100%.
const withForged = planDeflectionStats([forged, escalated()]);
assert.equal(withForged.resolved, 0, "a forged RESOLVED adds NOTHING to the numerator");
assert.equal(withForged.untrusted, 1);
assert.equal(withForged.deflectionPct, 0, "tamper can only drag the rate down/stay honest, never inflate it");

// ---- A real 0% is real (measured, not fabricated) ---------------------------------------------------
assert.equal(planDeflectionRate([escalated()]), 0, "one honest escalation => a real 0%");
assert.equal(planDeflectionRate([resolvedFix()]), 100, "one real end-to-end fix => a real 100%");

// ---- Feed shape is real-or-empty when populated ------------------------------------------------------
const feed = planProofFeed([resolvedFix(), resolvedFix(), escalated()]);
assert.equal(feed.autonomousResolutionPct, 67, "2 of 3 => 67%");
assert.equal(feed.plansFixed, 2);
assert.equal(feed.plansAttempted, 3);
assert.equal(feed.plansEscalated, 1);

console.log("plan-deflection test passed (plan-level autonomous-resolution rate FROM the journal - real-or-empty, un-inflatable: tamper/dry-run/no-change/pre-exec-abort/interrupted all excluded; goalProbe-proven real-change fixes are the only numerator).");
