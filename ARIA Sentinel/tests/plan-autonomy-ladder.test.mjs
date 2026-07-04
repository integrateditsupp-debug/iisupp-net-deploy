// STAGE 3 S1 - autonomy ladder: plans are Confirmed only, never Autonomous.
import assert from "node:assert/strict";
import { autonomyDecision, AUTONOMY_LADDER } from "../src/shared/autonomous-plan-engine.mjs";

assert.deepEqual(AUTONOMY_LADDER, ["manual", "confirmed", "autonomous"]);
assert.equal(autonomyDecision({ mode: "confirmed", planRequested: true }).ok, true);
assert.equal(autonomyDecision({ mode: "manual", planRequested: true }).reason, "plans-confirmed-only");
assert.equal(autonomyDecision({ mode: "autonomous", planRequested: true }).reason, "plans-confirmed-only");
assert.equal(autonomyDecision({ mode: "weird" }).reason, "unknown-mode");

console.log("Plan-autonomy-ladder test passed (plan execution limited to Confirmed mode).");
