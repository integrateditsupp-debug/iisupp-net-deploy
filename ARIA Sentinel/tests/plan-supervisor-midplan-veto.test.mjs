// STAGE 3 S1 - supervisor re-checks every step and can veto mid-plan.
import assert from "node:assert/strict";
import { supervisorBeforeStep } from "../src/shared/autonomous-plan-engine.mjs";

const plan = { id: "p1", goal: "x" };
assert.equal(supervisorBeforeStep(plan, { id: "s1", action: "safe" }, { supervisor: () => ({ verdict: "approve" }) }).ok, true);
const veto = supervisorBeforeStep(plan, { id: "s2", action: "unsafe" }, { supervisor: () => ({ verdict: "veto", code: "SIDE_EFFECT" }) });
assert.equal(veto.ok, false);
assert.equal(veto.reason, "SIDE_EFFECT");
assert.equal(supervisorBeforeStep(plan, { id: "s3", action: "x" }, { killed: true }).reason, "kill-switch");

console.log("Plan-supervisor-midplan-veto test passed (per-step approval, veto, kill-switch).");
