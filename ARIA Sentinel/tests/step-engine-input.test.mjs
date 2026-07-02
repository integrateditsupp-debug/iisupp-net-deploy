// The interactive step engine — the input-collection Ahmad asked for. Proves: the six step types exist; a flow
// is an ordered list of typed steps; answers are carried forward; a `copy` step composes a REAL prompt from the
// user's own inputs; and a MISSING answer re-asks (compose returns null) rather than fabricating a value.
import assert from "node:assert/strict";
import {
  STEP_TYPES, FLOWS, getFlow, flowStep, stepKey, isStepAnswered, resolveStep,
  composeFirstPrompt, composeLearnPrompt
} from "../src/shared/walkthrough-steps.mjs";
let n = 0; const t = () => { n++; };

// 1 — the six interactive step types are defined.
assert.deepEqual([...STEP_TYPES].sort(), ["choice", "confirm", "copy", "display", "input-text", "open"], "6 step types");
t();

// 2 — every step in every flow uses a known type + collects with a key where it should.
for (const flow of Object.values(FLOWS)) {
  assert.ok(Array.isArray(flow.steps) && flow.steps.length, `${flow.id} has steps`);
  for (const s of flow.steps) {
    assert.ok(STEP_TYPES.includes(s.type), `${flow.id}: known step type ${s.type}`);
    if (["input-text", "choice", "confirm"].includes(s.type)) assert.ok(s.key, `${flow.id}: ${s.type} has a key`);
    if (s.type === "choice") assert.ok(Array.isArray(s.options) && s.options.length >= 2, `${flow.id}: choice has options`);
    if (s.type === "open") assert.ok(/^https:\/\//.test(s.url) && s.note, `${flow.id}: open has an official url + a user-click note`);
  }
}
t();

// 3 — answers carry forward: composeFirstPrompt builds from the user's REAL inputs (name + goal), role/task/context/format.
const answers = { name: "Sam", goal: "write", goalDetail: "draft replies to customer emails", comfort: "2", budget: "free", device: "windows" };
const prompt = composeFirstPrompt(answers);
assert.ok(prompt.includes("Sam"), "prompt carries the name forward");
assert.ok(prompt.includes("draft replies to customer emails"), "prompt carries the goal detail forward");
for (const part of ["Role:", "Task:", "Context:", "Format:"]) assert.ok(prompt.includes(part), `prompt has ${part}`);
t();

// 4 — REAL-OR-EMPTY: a missing goal re-asks (returns null), never fabricates a prompt.
assert.equal(composeFirstPrompt({ name: "Sam" }), null, "no goal → null (re-ask, not fabricate)");
assert.equal(composeLearnPrompt(""), null, "no learn goal → null");
t();

// 5 — resolveStep marks a compose-backed step ready ONLY when its inputs exist.
const copyStep = getFlow("claude-setup").steps.find((s) => s.type === "copy");
assert.equal(resolveStep(copyStep, {}).ready, false, "copy not ready with no answers");
assert.equal(resolveStep(copyStep, {}).text, null, "copy text null with no answers (no fabrication)");
const ready = resolveStep(copyStep, answers);
assert.equal(ready.ready, true, "copy ready once answered");
assert.ok(ready.text.includes("draft replies to customer emails"), "resolved copy contains the user's real words");
t();

// 6 — stepKey / isStepAnswered drive the "block Next until answered" behaviour.
const nameStep = getFlow("claude-setup").steps.find((s) => s.type === "input-text");
assert.equal(stepKey(nameStep), "name", "stepKey returns the collecting key");
assert.equal(isStepAnswered(nameStep, {}), false, "unanswered input not answered");
assert.equal(isStepAnswered(nameStep, { name: "Sam" }), true, "answered input is answered");
assert.equal(isStepAnswered({ type: "display", title: "x" }, {}), true, "display collects nothing → always 'answered'");
// flowStep bounds.
assert.equal(flowStep("claude-setup", -1), null, "index below range → null");
assert.equal(flowStep("claude-setup", 9999), null, "index past end → null");
t();

assert.equal(n, 6, "6 step-engine-input groups");
console.log(`step-engine-input test passed (${n} groups · 6 typed steps · answers carried forward · real composed prompt from real inputs · missing answer re-asks (null) · bounds).`);
