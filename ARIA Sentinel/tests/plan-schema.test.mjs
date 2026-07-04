// STAGE 3 S1 - plan schema: Confirmed-mode only, no red-risk or R11 plans.
import assert from "node:assert/strict";
import { validatePlan, evaluatePlanStart } from "../src/shared/autonomous-plan-engine.mjs";

const plan = { id: "p1", mode: "confirmed", goal: "Restore DNS", steps: [{ id: "s1", action: "flush dns", rollback: "none", risk: "green" }] };
assert.equal(validatePlan(plan).ok, true);
assert.equal(evaluatePlanStart(plan, { mode: "confirmed" }).ok, true);
assert.equal(evaluatePlanStart({ ...plan, mode: "autonomous" }, { mode: "autonomous" }).reason, "confirmed-only");
assert.ok(validatePlan({ ...plan, steps: [{ id: "s1", action: "x", risk: "red" }] }).errors.includes("step-0-red-risk-blocked"));
assert.ok(validatePlan({ ...plan, goal: "C:\\Users\\a\\private pics and vids" }).errors.includes("r11-blocked"));

console.log("Plan-schema test passed (confirmed-only schema, red-risk block, R11 block).");
