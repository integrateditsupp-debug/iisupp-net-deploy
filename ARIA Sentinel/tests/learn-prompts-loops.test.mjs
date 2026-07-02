// The Learn lessons must be interactive + honest: "how to write prompts" teaches role/task/context/format and
// composes a REAL prompt from the user's own goal; "how AI loops work" teaches ask→read→refine→repeat with a
// worked example built from the user's own task. REAL-OR-EMPTY: no input → no fabricated prompt/example.
import assert from "node:assert/strict";
import { getFlow, resolveStep, composeLearnPrompt } from "../src/shared/walkthrough-steps.mjs";
let n = 0; const t = () => { n++; };

// 1 — "how to write prompts" teaches the 4 parts and collects the user's goal.
const prompts = getFlow("learn-prompts");
assert.ok(prompts, "learn-prompts flow exists");
const pText = JSON.stringify(prompts.steps.map((s) => ({ b: s.body, ti: s.title })));
for (const part of ["Role", "Task", "Context", "Format"]) assert.match(pText, new RegExp(part), `teaches ${part}`);
assert.ok(prompts.steps.some((s) => s.type === "input-text" && s.key === "goal"), "collects the user's goal");
t();

// 2 — it composes a REAL prompt from that goal (role/task/context/format), and re-asks if the goal is missing.
const copyStep = prompts.steps.find((s) => s.type === "copy");
assert.equal(typeof copyStep.compose, "function", "prompt lesson composes from the goal");
const composed = copyStep.compose({ goal: "summarize a contract in plain English" });
assert.ok(composed.includes("summarize a contract in plain English"), "composed prompt uses the real goal");
for (const part of ["Role:", "Task:", "Context:", "Format:"]) assert.ok(composed.includes(part), `composed prompt has ${part}`);
assert.equal(copyStep.compose({}), null, "missing goal → null (re-ask, no fabrication)");
assert.equal(resolveStep(copyStep, {}).ready, false, "copy not ready without the goal");
t();

// 3 — composeLearnPrompt is the shared, real composer.
assert.equal(composeLearnPrompt(""), null, "empty goal → null");
assert.ok(composeLearnPrompt("plan my week").includes("plan my week"), "real goal → real prompt");
t();

// 4 — "how AI loops work" teaches the loop and builds a worked example from the user's own task.
const loops = getFlow("learn-loops");
assert.ok(loops, "learn-loops flow exists");
const lText = JSON.stringify(loops.steps.map((s) => ({ b: s.body, ti: s.title })));
assert.match(lText, /Ask/i); assert.match(lText, /Read/i); assert.match(lText, /Refine/i); assert.match(lText, /Repeat/i);
assert.ok(loops.steps.some((s) => s.type === "input-text" && s.key === "loopTask"), "collects a task to try the loop on");
const example = loops.steps.find((s) => s.type === "display" && typeof s.compose === "function");
assert.ok(example, "loop lesson has a compose-backed worked example");
const built = example.compose({ loopTask: "write a friendly out-of-office message" });
assert.ok(built && built.includes("write a friendly out-of-office message"), "worked example uses the user's real task");
assert.equal(example.compose({}), null, "no task → null (real-or-empty, no fabricated example)");
t();

// 5 — HONESTY: the lessons make no fabricated claims (no fake outcomes / guarantees / 'you're an expert now').
const allLearn = JSON.stringify([prompts, loops]);
assert.ok(!/guarantee|you're now an expert|instantly master|100%/i.test(allLearn), "no fabricated claims in the lessons");
assert.ok(!/\$\s?\d/.test(allLearn), "lessons quote no invented price");
t();

assert.equal(n, 5, "5 learn-prompts-loops groups");
console.log(`learn-prompts-loops test passed (${n} groups · teaches role/task/context/format + the loop · composes real prompt/example from input · re-asks on missing · no fabricated claims).`);
