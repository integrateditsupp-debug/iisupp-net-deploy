// STAGE 3 S1 — journal replay IS the resume logic ("never half-applied"): a boot-time watchdog
// replays the journal and either resumes at a safe step boundary or rolls back + escalates.
// S1 ships the pure decision (resumeDecision); the S2 watchdog wires it to startup-registrar.
import assert from "node:assert/strict";
import { appendEntry, resumeDecision, replayState, verifyChain } from "../src/shared/plan-journal.mjs";

const NOW = 1_760_000_000_000;
let clock = NOW;
const now = () => (clock += 1000);
const base = { planId: "print-recovery", planRunId: "r1" };

function journalOf(events) {
  let j = [];
  for (const e of events) j = appendEntry(j, { ...base, ...e }, now);
  return j;
}

// 1 — crash at a SAFE boundary (last event = STEP.POST) → resume at the next step.
let j = journalOf([
  { event: "PLAN.PROPOSED", detail: "proposed" },
  { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0, recipeId: "restart-print-spooler" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "restart-print-spooler" },
  { event: "PLAN.STEP.POST", stepIndex: 0, recipeId: "restart-print-spooler", extra: { outcome: "success" } }
]);
let d = resumeDecision(j);
assert.equal(d.action, "resume");
assert.equal(d.nextStepIndex, 1);
assert.equal(d.reason, "safe-step-boundary");
assert.deepEqual(replayState(j).completedSteps, [0]);

// 2 — crash MID-STEP (last event = STEP.EXEC) → NEVER resume: rollback + escalate.
j = journalOf([
  { event: "PLAN.PROPOSED" },
  { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0 },
  { event: "PLAN.STEP.EXEC", stepIndex: 0 }
]);
d = resumeDecision(j);
assert.equal(d.action, "rollback-escalate");
assert.equal(d.reason, "interrupted-mid-step");
assert.equal(d.stepIndex, 0);

// crash between PRE and EXEC is equally unsafe.
j = journalOf([{ event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" }, { event: "PLAN.STEP.PRE", stepIndex: 0 }]);
assert.equal(resumeDecision(j).action, "rollback-escalate");

// crash mid-ROLLBACK → still rollback-escalate (finish the cleanup, never re-run steps).
j = journalOf([
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0 }, { event: "PLAN.STEP.EXEC", stepIndex: 0 }, { event: "PLAN.STEP.POST", stepIndex: 0 },
  { event: "PLAN.STEP.ROLLBACK", stepIndex: 0 }
]);
assert.equal(resumeDecision(j).action, "rollback-escalate");

// 3 — approved but no step started (reboot right after approval) → resume at step 0.
j = journalOf([{ event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" }]);
d = resumeDecision(j);
assert.equal(d.action, "resume");
assert.equal(d.nextStepIndex, 0);

// 4 — proposed-only (user never approved) → nothing to resume, nothing to roll back.
j = journalOf([{ event: "PLAN.PROPOSED" }]);
assert.deepEqual(resumeDecision(j), { action: "none", reason: "not-approved" });

// 5 — terminal journals are settled: RESOLVED / ABORTED / ESCALATED → no action on boot.
for (const event of ["PLAN.RESOLVED", "PLAN.ABORTED", "PLAN.ESCALATED"]) {
  j = journalOf([{ event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" }, { event }]);
  assert.deepEqual(resumeDecision(j), { action: "none", reason: "already-terminal" });
}

// 6 — a TAMPERED journal is never trusted for resume → rollback + escalate.
j = journalOf([
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0 }, { event: "PLAN.STEP.EXEC", stepIndex: 0 }, { event: "PLAN.STEP.POST", stepIndex: 0 }
]);
const tampered = j.map((e) => ({ ...e }));
tampered[2].recipeId = "swapped-recipe";
assert.equal(verifyChain(tampered).ok, false);
d = resumeDecision(tampered);
assert.equal(d.action, "rollback-escalate");
assert.equal(d.reason, "journal-tampered");

// 7 — empty journal → none.
assert.deepEqual(resumeDecision([]), { action: "none", reason: "empty-journal" });

console.log("plan-resume-after-reboot test passed (safe-boundary resume · mid-step rollback · terminal settled · tamper distrust).");
