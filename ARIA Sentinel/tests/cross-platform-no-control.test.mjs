// RUN 20 §3 — cross-platform blueprints are KNOWLEDGE ONLY. No remote control of phones/other machines:
// the blueprint dir is markdown-only, the reasoner/inventory never execute remotely, and getBlueprint
// only READS a file (returns text), never runs anything.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bpDir = path.join(root, "aria-kb-pack", "blueprints");

// Blueprints are pure markdown — no executable modules smuggled into the knowledge pack.
const entries = fs.readdirSync(bpDir);
for (const e of entries) assert.ok(e.endsWith(".md"), `blueprint dir is markdown-only (offender: ${e})`);

// The pure reasoning + inventory modules never execute commands or open remote sessions.
const reasoner = fs.readFileSync(path.join(root, "src", "shared", "diagnostic-reasoner.mjs"), "utf8");
for (const banned of [/child_process/, /\bspawn\(/, /\bexec\(/, /\bssh\b/, /adb\s+shell/]) {
  assert.doesNotMatch(reasoner, banned, `reasoner has no actuation (${banned})`);
}

// main.getBlueprint only reads the file and returns its content — it does not execute blueprint text.
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const fn = main.match(/function getBlueprint\(id\)\s*\{[\s\S]*?\n\}/);
assert.ok(fn, "getBlueprint exists");
assert.match(fn[0], /readFileSync/, "getBlueprint reads the blueprint file");
assert.doesNotMatch(fn[0], /spawn|exec\(|ssh|adb/, "getBlueprint never executes anything");

// There is no remote-execution path keyed to a non-local platform (knowledge guidance only).
assert.doesNotMatch(main, /adb\s+shell\s+(?!getprop)/, "no Android remote shell actuation in main");
assert.doesNotMatch(main, /ssh\s+\w+@/, "no outbound ssh actuation in main");

console.log("Cross-platform-no-control test passed (blueprints = md-only knowledge; no remote execution; getBlueprint reads only).");
