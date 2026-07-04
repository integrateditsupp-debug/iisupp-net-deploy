// STAGE 3 S1 - goalProbe declares success/unknown but never executes steps.
import assert from "node:assert/strict";
import { goalProbe } from "../src/shared/autonomous-plan-engine.mjs";

assert.deepEqual(goalProbe({ satisfied: true }), { status: "satisfied", canExecute: false });
assert.deepEqual(goalProbe({ satisfied: false }), { status: "unsatisfied", canExecute: false });
assert.deepEqual(goalProbe({}), { status: "unknown", canExecute: false });

console.log("Plan-goalprobe-real-or-empty test passed (declarative probe only, no execution).");
