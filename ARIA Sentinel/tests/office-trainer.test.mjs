// Office/Adobe/PDF trainer foundation: clear user choice, confirm-before-action, backup-before-edit.
import assert from "node:assert/strict";
import {
  classifyTrainerIntent,
  trainerChoicesFor,
  buildWalkthrough,
  buildAutonomousTrainerPlan
} from "../src/shared/office-trainer.mjs";

let intent = classifyTrainerIntent("Help me write an Excel XLOOKUP formula");
assert.equal(intent.id, "excel_formula");
assert.equal(intent.app, "Excel");
assert.equal(intent.modifiesFile, true);

const choices = trainerChoicesFor("Help me write an Excel formula");
assert.deepEqual(choices.choices.map((c) => c.label), ["Walk me through it", "Resolve it for me"]);
assert.equal(choices.choices.find((c) => c.id === "resolve").requiresConfirmation, true);
assert.equal(choices.choices.find((c) => c.id === "resolve").backupRequiredBeforeModify, true);

const walkthrough = buildWalkthrough("How do I redact a PDF in Adobe?");
assert.equal(walkthrough.intent.id, "pdf_adobe");
assert.ok(walkthrough.steps.some((s) => /real redaction tools/i.test(s)), "PDF redaction guidance avoids fake black boxes");

let plan = buildAutonomousTrainerPlan("Fix my Excel formula", {
  confirmed: false,
  filePath: "C:\\Work\\Budget.xlsx",
  backupReady: true
});
assert.equal(plan.ok, false);
assert.equal(plan.reason, "confirmation-required");

plan = buildAutonomousTrainerPlan("Fix my Excel formula", {
  confirmed: true,
  filePath: "C:\\Work\\Budget.xlsx",
  backupReady: false
});
assert.equal(plan.ok, false);
assert.equal(plan.reason, "backup-required");

plan = buildAutonomousTrainerPlan("Fix my Excel formula", {
  confirmed: true,
  filePath: "C:\\Work\\Budget.xlsx",
  backupReady: true
});
assert.equal(plan.ok, true);
assert.equal(plan.backupRequired, true);
assert.equal(plan.macroExecutionAllowed, false, "trainer never executes unknown macros automatically");
assert.equal(plan.actionLogRequired, true);

plan = buildAutonomousTrainerPlan("Show me how to use the ARIA Sentinel admin console", {
  confirmed: true,
  actorAuthorized: true
});
assert.equal(plan.ok, true);
assert.equal(plan.backupRequired, false, "guidance-only Sentinel help does not require a file backup");

plan = buildAutonomousTrainerPlan("Grant RDP access", {
  confirmed: true,
  actorAuthorized: false
});
assert.equal(plan.ok, false);
assert.equal(plan.reason, "not-authorized");

console.log("Office trainer test passed (walkthrough/resolve choices, confirmation, backup-before-edit, no macro execution).");
