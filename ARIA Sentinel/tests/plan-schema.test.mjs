// STAGE 3 S1 — Resolution Plan schema: R11 is check #1, bound-step enforcement, probe honesty,
// and every authored playbook validates against the LIVE executor bindings. Pure — nothing spawns.
import assert from "node:assert/strict";
import { validatePlan, validateProbe, STEP_ON_FAIL, ROLLBACK_POLICIES } from "../src/shared/resolution-plan.mjs";
import { resolveExecutorId } from "../src/main/tier-0-executor.mjs";
import { PLAYBOOKS, PLAYBOOK_IDS, getPlaybook, validateAllPlaybooks } from "../src/main/resolution-playbooks.mjs";

const isBound = (r) => !!resolveExecutorId(r);
const goodPlan = () => ({
  id: "test-plan",
  title: "Test plan",
  trigger: { kind: "user-request", detail: "test" },
  steps: [
    { recipeId: "flush-dns", risk: "low", expectedImpact: [], onFail: "escalate" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "rollback-plan" }
  ],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler is running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// 1 — a well-formed plan with live-bound steps validates.
let v = validatePlan(goodPlan(), { isBound });
assert.equal(v.ok, true, v.errors.join("; "));

// 2 — 🔒 R11 is check #1: even a structurally broken plan returns R11_BLOCKED first, not INVALID.
v = validatePlan({ id: "x!", steps: "nope", title: "notes in C:\\Private pics and Vids\\plan.txt" });
assert.equal(v.ok, false);
assert.equal(v.code, "R11_BLOCKED");
assert.equal(v.surfaced, "1 personal folder excluded");

// R11 anywhere in the plan (a step arg, a probe command) also blocks.
const sneaky = goodPlan();
sneaky.steps[0].args = { logDir: "C:\\private PICS and vids\\x" };
assert.equal(validatePlan(sneaky, { isBound }).code, "R11_BLOCKED");

// 3 — S1 bound-step enforcement: reset-network-stack is a real catalog recipe but has NO live
// executor binding, so a plan using it is invalid (S1 runs only bound, vetted recipes).
const unbound = goodPlan();
unbound.steps[0].recipeId = "reset-network-stack";
v = validatePlan(unbound, { isBound });
assert.equal(v.ok, false);
assert.ok(v.errors.some((e) => e.includes("reset-network-stack") && e.includes("no live Tier-0 executor binding")));

// 4 — shape errors: empty steps, bad onFail, bad rollbackPolicy, missing goalProbe.
assert.equal(validatePlan({ ...goodPlan(), steps: [] }, { isBound }).ok, false);
const badFail = goodPlan(); badFail.steps[0].onFail = "explode";
assert.ok(validatePlan(badFail, { isBound }).errors.some((e) => e.includes("onFail")));
assert.ok(validatePlan({ ...goodPlan(), rollbackPolicy: "yolo" }, { isBound }).errors.some((e) => e.includes("rollbackPolicy")));
const noProbe = goodPlan(); delete noProbe.goalProbe;
assert.ok(validatePlan(noProbe, { isBound }).errors.some((e) => e.includes("goalProbe")));

// 5 — probe honesty: a probe without a description (what it PROVES) is invalid; bad interpret too.
assert.ok(validateProbe({ command: "(Get-Service X).Status", interpret: "service-running" }).some((e) => e.includes("description")));
assert.ok(validateProbe({ command: "x", interpret: "vibes", description: "d" }).some((e) => e.includes("interpret")));
assert.deepEqual(validateProbe({ command: "(Get-Service X).Status", interpret: "service-running", description: "svc running" }), []);

// 6 — vocabulary locks (the executor's control flow depends on these).
assert.deepEqual([...STEP_ON_FAIL], ["retry-once", "rollback-plan", "escalate"]);
assert.deepEqual([...ROLLBACK_POLICIES], ["reverse-order", "escalate-only"]);

// 7 — the 3 authored playbooks: present, valid against the LIVE bindings, honest probe descriptions.
assert.deepEqual([...PLAYBOOK_IDS].sort(), ["audio-recovery", "network-recovery", "print-recovery"]);
const results = validateAllPlaybooks();
for (const id of PLAYBOOK_IDS) {
  assert.equal(results[id].ok, true, `${id}: ${results[id].errors.join("; ")}`);
  assert.ok(PLAYBOOKS[id].goalProbe.description.length > 10, `${id} goalProbe must state what it proves`);
  for (const s of PLAYBOOKS[id].steps) assert.ok(isBound(s.recipeId), `${id} step ${s.recipeId} must be live-bound`);
}

// 8 — getPlaybook returns a deep copy (authored source is immutable) and null for unknown ids.
const copy = getPlaybook("network-recovery");
copy.title = "mutated";
assert.equal(PLAYBOOKS["network-recovery"].title.startsWith("Network recovery"), true);
assert.equal(getPlaybook("nope"), null);

console.log("plan-schema test passed (R11 first · bound-step S1 rule · probe honesty · 3 playbooks validate).");
