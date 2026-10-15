// PROD 2026-10-14 (audit M25) — the customer policy overlay is REACHABLE now.
//
// Before: applyPolicyOverlay() was exported and never called, VALID_RECIPE_IDS knew only the registry ids (a Tier-0
// id in recipes_disabled was silently dropped), and customer.json was read once at launch. Now a loader reads
// ~/.aria-sentinel/policy.json at launch, on change (fs.watch) and daily, through the SAME strict parser; Tier-0
// catalog ids + executor bindings can be disabled; customer.json is re-read daily.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadPolicyFile, parsePolicyOverlay, isRecipeAllowedByPolicy, VALID_RECIPE_IDS, POLICY_FILE_NAME } from "../src/shared/policy.mjs";
import { TIER0_IDS } from "../src/main/recipes/tier-0/catalog.mjs";
import { TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
let groups = 0; const g = () => { groups++; };

// 1 — the loader: absent / unreadable → the empty overlay with source "none"; present → parsed through the strict gate.
const absent = loadPolicyFile("/nope/policy.json", { readFileSync: () => { throw new Error("ENOENT"); } });
assert.equal(absent.present, false); assert.equal(absent.source, "none");
assert.deepEqual(absent.overlay.recipes_disabled, []);
const memfs = { readFileSync: () => JSON.stringify({ recipes_disabled: ["dns-fail-v1", "restart-print-spooler", "flush-dns", "rm -rf /", "*"], business_hours: { start: 9, end: 17 }, exec_command: "calc.exe" }) };
const loaded = loadPolicyFile("/x/policy.json", memfs);
assert.equal(loaded.present, true); assert.equal(loaded.source, "file");
assert.deepEqual(loaded.overlay.recipes_disabled, ["dns-fail-v1", "restart-print-spooler", "flush-dns"], "registry + Tier-0 executor + Tier-0 catalog ids survive; junk is dropped");
assert.deepEqual(loaded.overlay.business_hours, { start: 9, end: 17, tz: "" });
assert.ok(!("exec_command" in loaded.overlay), "an injected key does not exist in the result");
assert.equal(isRecipeAllowedByPolicy(loaded.overlay, "restart-print-spooler"), false, "a disabled Tier-0 executor is refused");
assert.equal(isRecipeAllowedByPolicy(loaded.overlay, "restart-audio"), true);
const garbage = loadPolicyFile("/x/policy.json", { readFileSync: () => "{not json" });
assert.equal(garbage.present, true); assert.deepEqual(garbage.overlay.recipes_disabled, [], "unparseable file → no-op overlay, never a throw");
assert.equal(POLICY_FILE_NAME, "policy.json");
g();

// 2 — every Tier-0 catalog id and executor binding is a valid policy target (and the registry ids still are).
for (const id of TIER0_IDS) assert.ok(VALID_RECIPE_IDS.has(id), `tier-0 catalog id ${id} is policy-addressable`);
for (const id of TIER0_EXECUTOR_IDS) assert.ok(VALID_RECIPE_IDS.has(id), `executor binding ${id} is policy-addressable`);
assert.ok(VALID_RECIPE_IDS.has("dns-fail-v1"));
assert.deepEqual(parsePolicyOverlay({ recipes_disabled: ["check-disk-smart"] }).recipes_disabled, ["check-disk-smart"]);
g();

// 3 — main.mjs wiring: loaded at launch, watched, daily; customer.json re-read daily; the launch is QUIET when no policy exists.
assert.match(main, /const POLICY_FILE = path\.join\(os\.homedir\(\), "\.aria-sentinel", POLICY_FILE_NAME\);/);
assert.match(main, /loadPolicyOverlayFromDisk\("launch"\);\s*\n\s*watchPolicyFile\(\);/, "launch load + watch");
assert.match(main, /setInterval\(\(\) => \{ loadPolicyOverlayFromDisk\("daily"\); reloadCustomerConfig\(\); \}, 24 \* 60 \* 60 \* 1000\)/, "daily re-read of both");
assert.match(main, /fs\.watch\(dir, \{ persistent: false \}, \(_ev, name\) => \{ if \(String\(name \|\| ""\) === POLICY_FILE_NAME\) loadPolicyOverlayFromDisk\("file-change"\); \}\)/, "file change applies immediately");
assert.match(main, /if \(present\) logEvent\("POLICY", `Policy file applied/, "a present policy logs");
assert.match(main, /else if \(prevActive\) logEvent\("POLICY", `Policy file removed/, "…a removed one logs…");
assert.doesNotMatch(main, /No policy file \(\$\{reason\}\)/, "…and an absent one is silent (no per-launch noise)");
assert.match(main, /isRecipeAllowedByPolicy\(store\.get\("policyOverlay"\) \|\| null, recipeId\)/, "runRecipe still enforces the stored overlay");
g();

assert.equal(groups, 3);
console.log(`policy-overlay-loader test passed (${groups} groups · file loader through the strict gate · Tier-0 ids addressable · launch/watch/daily wiring, quiet when absent).`);
