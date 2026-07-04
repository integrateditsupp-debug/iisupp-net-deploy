// STAGE 3 S1 - R11 and kill-switch are first-class hard stops.
import assert from "node:assert/strict";
import { evaluatePlanStart, supervisorBeforeStep } from "../src/shared/autonomous-plan-engine.mjs";

const plan = { id: "p1", mode: "confirmed", goal: "Fix DNS", steps: [{ id: "s1", action: "flush dns" }] };
assert.equal(evaluatePlanStart(plan, { mode: "confirmed", killed: true }).reason, "kill-switch");
assert.equal(evaluatePlanStart({ ...plan, goal: "C:\\Users\\a\\private pics and vids" }, { mode: "confirmed" }).ok, false);
assert.equal(supervisorBeforeStep(plan, { id: "s1", action: "C:\\Users\\a\\private pics and vids" }).reason, "r11-blocked");

console.log("Plan-r11-and-killswitch test passed (kill-switch and R11 block before execution).");
