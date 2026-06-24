// Slice B — the execution-boundary dry-run gate (runRecipe / runTier0Fix in main.mjs both call this).
// Locks the precedence so production stays LIVE-by-mode WITHOUT ever losing the system-fixes-off safety:
//   1. system fixes not allowed (dev/unsigned build, or env =0) → ALWAYS preview, no matter what.
//   2. the mode-policy's explicit decision wins → Manual passes true (preview), Confirmed/Autonomous false (LIVE).
//   3. no caller decision → fall back to the legacy global "dryRun" toggle.
import assert from "node:assert/strict";
import { resolveActualDryRun } from "../src/main/dry-run-policy.mjs";

// 1. system fixes OFF → always preview, regardless of the caller or global flag.
assert.equal(resolveActualDryRun({ allowSystemFixes: false, optionDryRun: false, globalDryRun: false }), true,
  "system fixes off must preview even when the caller asks to run live");
assert.equal(resolveActualDryRun({ allowSystemFixes: false, optionDryRun: undefined, globalDryRun: false }), true);

// 2. system fixes ON → the caller's explicit decision wins over the legacy global toggle.
assert.equal(resolveActualDryRun({ allowSystemFixes: true, optionDryRun: false, globalDryRun: true }), false,
  "Confirmed/Autonomous (optionDryRun=false) must run LIVE even if the legacy global dryRun is on");
assert.equal(resolveActualDryRun({ allowSystemFixes: true, optionDryRun: true, globalDryRun: false }), true,
  "Manual / explicit dry-run (optionDryRun=true) must preview even with the global toggle off");

// 3. system fixes ON, no caller decision → fall back to the global toggle.
assert.equal(resolveActualDryRun({ allowSystemFixes: true, optionDryRun: undefined, globalDryRun: true }), true);
assert.equal(resolveActualDryRun({ allowSystemFixes: true, optionDryRun: undefined, globalDryRun: false }), false);

// defaults: nothing supplied → safe (preview), because allowSystemFixes defaults false.
assert.equal(resolveActualDryRun(), true, "default with no args must be safe (preview)");

console.log("actual-dryrun-precedence test passed (7 cases · system-fixes-off always previews · mode decision wins · global fallback).");
