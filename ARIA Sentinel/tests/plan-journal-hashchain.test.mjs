// STAGE 3 S1 - hash-chained journal detects edits.
import assert from "node:assert/strict";
import { createJournal, appendJournal, verifyJournal } from "../src/shared/autonomous-plan-engine.mjs";

const plan = { id: "p1" };
let journal = createJournal(plan, { now: 1 });
journal = appendJournal(journal, { type: "STEP.OK", stepId: "s1", outcome: "ok" }, { now: 2 });
assert.equal(verifyJournal(journal).ok, true);
const tampered = journal.map((e) => ({ ...e }));
tampered[1].outcome = "changed";
assert.equal(verifyJournal(tampered).ok, false);
assert.equal(verifyJournal(tampered).reason, "entry-hash");

console.log("Plan-journal-hashchain test passed (append-only hash chain detects tamper).");
