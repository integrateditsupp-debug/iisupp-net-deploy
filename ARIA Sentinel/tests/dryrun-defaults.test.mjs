// RUN 29-A — dry-run DEFAULT is mode-based now: Manual keeps the dry-run safety ON; Confirmed + Autonomous
// default to real execution. This proves the flip per mode/tier, that the per-invocation checkbox override
// still wins, that every real-exec path keeps its supervisor + countdown gates, and that all 20 Tier-0
// recipes route to real execution under Autonomous + supervisor approval. (Ctrl+Alt+K in-flight abort is
// covered by kill-switch.test.mjs / kill-switch-hotkey.test.mjs.)
import assert from "node:assert/strict";
import { resolveDryRun, executionPolicy } from "../src/main/dry-run-policy.mjs";
import { TIER0_RECIPES } from "../src/main/recipes/tier-0/index.mjs";

let n = 0; const t = () => { n++; };

// 1 — mode-based default matrix (no checkbox): Manual ON, Confirmed/Autonomous OFF.
assert.equal(resolveDryRun({ mode: "manual" }), true);
assert.equal(resolveDryRun({ mode: "confirmed" }), false);
assert.equal(resolveDryRun({ mode: "autonomous" }), false);
assert.equal(resolveDryRun({}), true, "unknown/no mode → safe (dry-run on)");
t();

// 2 — the per-invocation checkbox overrides the mode default in BOTH directions, every mode.
for (const mode of ["manual", "confirmed", "autonomous"]) {
  assert.equal(resolveDryRun({ mode, dryRunCheckbox: true }), true, `${mode}: checkbox ON forces dry-run`);
  assert.equal(resolveDryRun({ mode, dryRunCheckbox: false }), false, `${mode}: checkbox OFF forces live`);
}
t();

// 3 — Manual keeps a Tier-0 recipe in dry-run by default (user safety); only the checkbox flips it live.
let p = executionPolicy({ vettedCount: 150, mode: "manual", supervisorVerdict: "approve" });
assert.equal(p.dryRun, true, "Tier-0 in Manual is dry-run by default");
assert.equal(p.execute, false, "→ does not execute until the user opts in");
p = executionPolicy({ vettedCount: 150, mode: "manual", dryRunCheckbox: false, supervisorVerdict: "approve" });
assert.equal(p.execute, true, "Manual + checkbox off + approved → executes");
t();

// 4 — every real-exec path STILL carries its safety gates (stop-condition guard).
for (const mode of ["confirmed", "autonomous"]) {
  const pol = executionPolicy({ vettedCount: 150, mode, supervisorVerdict: "approve" });
  assert.equal(pol.dryRun, false, `${mode}: live by default`);
  assert.equal(pol.requiresSupervisor, true, `${mode}: supervisor always required`);
  assert.equal(pol.requiresCountdown, true, `${mode}: 10s countdown required (non fast-path)`);
  // no approval → never executes, regardless of the live default
  assert.equal(executionPolicy({ vettedCount: 150, mode, supervisorVerdict: "veto" }).execute, false, `${mode}: veto blocks exec`);
  assert.equal(executionPolicy({ vettedCount: 150, mode, supervisorVerdict: undefined }).execute, false, `${mode}: no verdict blocks exec`);
}
t();

// 5 — all 21 Tier-0 recipes route to REAL execution under Autonomous + supervisor approval.
// (21 since Stage-3 S2 added the signed clear-print-queue recipe alongside its executor binding.)
assert.equal(TIER0_RECIPES.length, 21, "21 Tier-0 recipes in the catalog");
let liveCount = 0;
for (const r of TIER0_RECIPES) {
  // A Tier-0 recipe carries 100+ vetted runs; under Autonomous + approve it must execute live + may auto-fire.
  const pol = executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "approve" });
  assert.equal(pol.tier, 0, `${r.id}: Tier-0`);
  assert.equal(pol.dryRun, false, `${r.id}: real exec (not dry-run) under Autonomous`);
  assert.equal(pol.execute, true, `${r.id}: executes after supervisor approval`);
  assert.equal(pol.canAutoFire, true, `${r.id}: Tier-0 may auto-fire in Autonomous`);
  if (pol.execute) liveCount++;
}
assert.equal(liveCount, 21, "all 21 Tier-0 recipes execute live under Autonomous");
t();

// 6 — Autonomous live default is still overridable to dry-run for diagnostics (per-invocation).
assert.equal(executionPolicy({ vettedCount: 150, mode: "autonomous", dryRunCheckbox: true, supervisorVerdict: "approve" }).execute, false, "checkbox ON keeps it a dry-run even in Autonomous");
t();

assert.equal(n, 6, "6 dry-run-default test groups");
console.log(`dryrun-defaults test passed (${n} groups · Manual ON / Confirmed+Autonomous OFF · checkbox override both ways · safety gates intact · 20 Tier-0 recipes route live under Autonomous).`);
