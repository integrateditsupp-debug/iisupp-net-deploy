// STAGE 3 S1 - resume after reboot requires a valid journal and supervisor on next step.
import assert from "node:assert/strict";
import { createJournal, appendJournal, resumePlan } from "../src/shared/autonomous-plan-engine.mjs";

const plan = { id: "p1", steps: [{ id: "s1" }, { id: "s2" }] };
let journal = createJournal(plan, { now: 1 });
journal = appendJournal(journal, { type: "STEP.OK", stepId: "s1" }, { now: 2 });
let resumed = resumePlan(plan, journal);
assert.equal(resumed.ok, true);
assert.deepEqual(resumed.completedStepIds, ["s1"]);
assert.equal(resumed.nextStepId, "s2");
assert.equal(resumed.requiresSupervisor, true);

const bad = journal.map((e) => ({ ...e, prevHash: "bad" }));
assert.equal(resumePlan(plan, bad).ok, false);

console.log("Plan-resume-after-reboot test passed (valid journal resumes, tamper blocks).");
