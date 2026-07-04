// STAGE 3 S1 - rollback runs in reverse order over completed rollback-capable steps.
import assert from "node:assert/strict";
import { rollbackPlan } from "../src/shared/autonomous-plan-engine.mjs";

const rollback = rollbackPlan([
  { id: "s1", rollback: "undo-1" },
  { id: "s2" },
  { id: "s3", rollback: "undo-3" }
]);
assert.deepEqual(rollback, [
  { stepId: "s3", action: "undo-3" },
  { stepId: "s1", action: "undo-1" }
]);

console.log("Plan-rollback-reverse-order test passed (reverse rollback, skips no-rollback steps).");
