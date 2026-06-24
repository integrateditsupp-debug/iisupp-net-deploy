// RUN 23 §6 — vetted-tier execution policy + recipe-history ledger.
import assert from "node:assert/strict";
import { vettedTier, resolveDryRun, executionPolicy, recordOutcome, vettedCountOf, emptyHistory } from "../src/main/dry-run-policy.mjs";

// Tier thresholds.
assert.equal(vettedTier(150), 0);
assert.equal(vettedTier(100), 0);
assert.equal(vettedTier(99), 1);
assert.equal(vettedTier(10), 1);
assert.equal(vettedTier(9), 2);
assert.equal(vettedTier(0), 2);

// RUN 29-A — dry-run default is now MODE-based: checkbox always wins; default ON in Manual, OFF in
// Confirmed/Autonomous. (Tier still governs allowed/auto-fire below, just not the dry-run default.)
assert.equal(resolveDryRun({ mode: "manual", dryRunCheckbox: true }), true, "checkbox on wins");
assert.equal(resolveDryRun({ mode: "manual", dryRunCheckbox: false }), false, "checkbox off wins (live in manual)");
assert.equal(resolveDryRun({ mode: "manual" }), true, "Manual default dry-run ON");
assert.equal(resolveDryRun({ mode: "confirmed" }), false, "Confirmed default dry-run OFF");
assert.equal(resolveDryRun({ mode: "autonomous" }), false, "Autonomous default dry-run OFF");
assert.equal(resolveDryRun({}), true, "no mode → defaults to Manual (safe)");

// Tier-0 in Autonomous, supervisor approves → executes + may auto-fire, no Ahmad prompt.
let p = executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "approve" });
assert.equal(p.tier, 0);
assert.equal(p.execute, true);
assert.equal(p.canAutoFire, true);
assert.equal(p.requiresAhmadPrompt, false);

// Tier-0 fast-path skips the countdown.
assert.equal(executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "approve-fast" }).requiresCountdown, false);
assert.equal(executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "approve" }).requiresCountdown, true);

// Tier-1 needs Confirmed minimum (tier gate unchanged); in Confirmed it now defaults to live (dry-run OFF).
assert.equal(executionPolicy({ vettedCount: 50, mode: "manual", supervisorVerdict: "approve" }).allowed, false);
assert.equal(executionPolicy({ vettedCount: 50, mode: "confirmed", supervisorVerdict: "approve" }).dryRun, false, "RUN 29-A: Tier-1 in Confirmed defaults to live");
p = executionPolicy({ vettedCount: 50, mode: "confirmed", supervisorVerdict: "approve" });
assert.equal(p.allowed, true);
assert.equal(p.execute, true, "Confirmed + approved → executes live by default");
assert.equal(p.canAutoFire, false, "Tier-1 never auto-fires");
// but the checkbox can still force dry-run back ON even in Confirmed
assert.equal(executionPolicy({ vettedCount: 50, mode: "confirmed", dryRunCheckbox: true, supervisorVerdict: "approve" }).execute, false, "checkbox ON forces dry-run → no exec");

// Tier-2 is manual-only with an Ahmad prompt; blocked in confirmed/autonomous.
assert.equal(executionPolicy({ vettedCount: 5, mode: "confirmed", supervisorVerdict: "approve" }).allowed, false);
p = executionPolicy({ vettedCount: 5, mode: "manual", dryRunCheckbox: false, supervisorVerdict: "approve" });
assert.equal(p.allowed, true);
assert.equal(p.requiresAhmadPrompt, true);
assert.equal(p.execute, true);

// Dry-run + veto both block execution.
assert.equal(executionPolicy({ vettedCount: 150, mode: "autonomous", dryRunCheckbox: true, supervisorVerdict: "approve" }).execute, false);
assert.equal(executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "veto" }).execute, false);

// recipe-history ledger: success +1, veto/abort −1 (floored), tier recomputed.
let h = emptyHistory();
for (let i = 0; i < 12; i++) h = recordOutcome(h, "restart-print-spooler", "success", NOWish(i));
assert.equal(vettedCountOf(h, "restart-print-spooler"), 12);
assert.equal(h.recipes["restart-print-spooler"].tier, 1);
h = recordOutcome(h, "restart-print-spooler", "veto");
assert.equal(vettedCountOf(h, "restart-print-spooler"), 11);
let z = recordOutcome(emptyHistory(), "x", "abort");
assert.equal(vettedCountOf(z, "x"), 0, "floored at 0");

// 🔒 R11 — outcomes for an off-limits recipe id are never recorded.
const guarded = recordOutcome(emptyHistory(), "C:/Private pics and Vids/x", "success");
assert.equal(Object.keys(guarded.recipes).length, 0);

function NOWish(i) { return 1_700_000_000_000 + i * 1000; }
console.log("Dry-run-policy test passed (tiers · dry-run default · mode gates · auto-fire · countdown skip · ledger ±1 · R11).");
