// TASK 3 — "Resolve it for me" must run the matched fix LOCALLY through the gated control plane, with
// Confirmed-grade gating and NEVER a silent autonomous escalation. Structural proof of the wiring + safety.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = rd("src", "renderer", "renderer.js");
const main = rd("src", "main", "main.mjs");
const preload = rd("src", "main", "preload.cjs");
let n = 0; const t = () => { n++; };

// 1 — the recipe card exposes a "Resolve it for me" control wired to the supervised-fix bridge. (2026-07-02:
// the vetted apply now flows through the shared resolveViaSupervisor helper — still Confirmed-grade gating.)
assert.match(renderer, /data-resolve-fix=/, "recipe card has a Resolve-it-for-me control");
assert.match(renderer, /Resolve it for me/, "button label present");
assert.match(renderer, /async function resolveViaSupervisor\(recipeId, risk, statusEl\)/, "shared gated-apply helper exists");
assert.match(renderer, /sentinel\.supervisedFix\?\.\(\{ recipeId, risk: risk \|\| "medium", mode: "confirmed" \}\)/, "resolve calls supervisedFix with Confirmed-grade gating");
assert.match(renderer, /resolveViaSupervisor\(recipeId, risk, statusEl\)/, "recipe card routes its vetted apply through the gated helper");
t();

// 2 — preload exposes supervisedFix → the gated IPC (not the raw run-recipe).
assert.match(preload, /supervisedFix:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("sentinel:supervised-fix"/, "preload routes supervisedFix to the supervised-fix control plane");
t();

// 3 — SAFETY: a resolve action may only request manual/confirmed; it can NEVER escalate to autonomous.
assert.match(main, /requested === "manual"\s*\|\|\s*requested === "confirmed"/, "mode override clamped to manual|confirmed");
assert.doesNotMatch(main, /requested === "autonomous"/, "resolve never honors an autonomous override");
t();

// 4 — the gated pipeline is intact: R11 → supervisor → execution policy → countdown → kill-switch.
const fn = main.match(/function runSupervisedFix[\s\S]*?\n\}/)[0];
assert.match(fn, /isBlockedPath\(/, "R11 private-folder guard");
assert.match(fn, /superviseProposal\(/, "supervisor critic");
assert.match(fn, /executionPolicy\(/, "execution policy (tier/mode gate)");
assert.match(fn, /startActionCountdown\(/, "10s countdown before any live apply");
assert.match(main, /sentinel:abort-countdown/, "kill-switch can abort the countdown");
t();

// 5 — TASK 4: the chat answer also offers the Sentinel-only "Resolve it for me" chip, gated the same way.
assert.match(renderer, /function appendResolveChip/, "chat resolve chip exists");
assert.match(renderer, /aria-chat-resolve-btn/, "chat resolve chip styled hook");
assert.match(renderer, /supervisedFix\(\{ recipeId, mode: "confirmed" \}\)/, "chat chip runs the gated supervised fix (confirmed)");
t();

assert.equal(n, 5, "5 resolve-for-me groups");
console.log(`resolve-for-me test passed (${n} groups · recipe-card + chat chip → supervisedFix(confirmed) · never-autonomous clamp · R11+supervisor+policy+countdown+kill-switch intact).`);
